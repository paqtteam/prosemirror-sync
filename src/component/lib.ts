import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

const MAX_DELTA_FETCH = 1000;

export const sync = mutation({
  args: {
    id: v.string(),
    version: v.number(),
    clientId: v.string(),
    steps: v.array(v.string()),
  },
  returns: v.union(
    v.object({
      status: v.literal("needs-rebase"),
      clientIds: v.array(v.string()),
      steps: v.array(v.string()),
    }),
    v.object({ status: v.literal("synced") })
  ),
  handler: async (ctx, args) => {
    const changes = await ctx.db
      .query("deltas")
      .withIndex("id_version", (q) =>
        q.eq("id", args.id).gt("version", args.version)
      )
      .take(MAX_DELTA_FETCH);
    if (changes.length > 0) {
      const [steps, clientIds] = stepsAndClientIds(changes);
      return { status: "needs-rebase", clientIds, steps } as const;
    }
    await ctx.db.insert("deltas", {
      id: args.id,
      version: args.version + args.steps.length,
      clientId: args.clientId,
      steps: args.steps,
    });
    return { status: "synced" } as const;
  },
});

function stepsAndClientIds(deltas: Doc<"deltas">[]) {
  const clientIds = [];
  const steps = [];
  for (const delta of deltas) {
    for (const step of delta.steps) {
      clientIds.push(delta.clientId);
      steps.push(step);
    }
  }
  return [steps, clientIds];
}

export const get = query({
  args: {
    id: v.string(),
    version: v.optional(v.number()),
    ignoreSteps: v.optional(v.boolean()),
  },
  returns: v.object({
    snapshot: v.union(v.string(), v.null()),
    steps: v.array(v.string()),
    clientIds: v.array(v.string()),
    version: v.number(),
  }),
  handler: async (ctx, args) => {
    const snapshot = await ctx.db
      .query("snapshots")
      .withIndex("id_version", (q) =>
        q.eq("id", args.id).lte("version", args.version ?? Infinity)
      )
      .order("desc")
      .first();
    if (!snapshot) {
      return {
        snapshot: null,
        steps: [],
        clientIds: [],
        version: 0,
      };
    }
    const [steps, clientIds] =
      snapshot.version === args.version || args.ignoreSteps
        ? [[], []]
        : await fetchSteps(ctx, args.id, snapshot.version, args.version);
    return {
      snapshot: snapshot.content,
      steps,
      clientIds,
      version: snapshot.version + steps.length,
    };
  },
});

async function fetchSteps(
  ctx: QueryCtx,
  id: string,
  afterVersion: number,
  targetVersion?: number
) {
  const deltas = await ctx.db
    .query("deltas")
    .withIndex("id_version", (q) =>
      q
        .eq("id", id)
        .gt("version", afterVersion)
        .lte("version", targetVersion ?? Infinity)
    )
    .take(MAX_DELTA_FETCH);
  if (deltas.length > 0) {
    const firstDelta = deltas[0];
    if (firstDelta.version - firstDelta.steps.length > afterVersion) {
      throw new Error(
        `Missing steps ${afterVersion + 1}...${
          firstDelta.version - firstDelta.steps.length
        }`
      );
    } else if (firstDelta.version - firstDelta.steps.length < afterVersion) {
      firstDelta.steps = firstDelta.steps.slice(
        afterVersion - (firstDelta.version - firstDelta.steps.length)
      );
    }
  }
  const [steps, clientIds] = stepsAndClientIds(deltas);
  if (deltas.length === MAX_DELTA_FETCH) {
    console.warn(
      `Max delta fetch reached: ${id} ${afterVersion}...${
        targetVersion ?? "end"
      } stopped at ${deltas[deltas.length - 1].version}`
    );
    return [steps, clientIds];
  }
  const lastDelta = deltas[deltas.length - 1];
  if (targetVersion && (!lastDelta || lastDelta.version < targetVersion)) {
    const nextDelta = await ctx.db
      .query("deltas")
      .withIndex("id_version", (q) =>
        q.eq("id", id).gt("version", lastDelta.version)
      )
      .first();
    if (!nextDelta) {
      throw new Error(
        `Missing steps ${lastDelta ? lastDelta.version + 1 : afterVersion}...${targetVersion}`
      );
    }
    for (const step of nextDelta.steps.slice(
      0,
      targetVersion - lastDelta.version
    )) {
      steps.push(step);
      clientIds.push(nextDelta.clientId);
    }
  }
  if (targetVersion && steps.length !== targetVersion - afterVersion) {
    throw new Error(
      `Steps mismatch ${afterVersion}...${targetVersion}: ${steps.length}`
    );
  }
  return [steps, clientIds];
}

export const getSteps = query({
  args: { id: v.string(), version: v.number() },
  returns: v.object({
    steps: v.array(v.string()),
    clientIds: v.array(v.string()),
    version: v.number(),
  }),
  handler: async (ctx, args) => {
    const [steps, clientIds] = await fetchSteps(ctx, args.id, args.version);
    return { steps, clientIds, version: args.version + steps.length };
  },
});
