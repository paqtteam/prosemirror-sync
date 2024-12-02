import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { vClientId } from "./schema";

const MAX_DELTA_FETCH = 1000;

export const submitSnapshot = mutation({
  args: { id: v.string(), version: v.number(), content: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("snapshots")
      .withIndex("id_version", (q) =>
        q.eq("id", args.id).eq("version", args.version)
      )
      .first();
    if (existing) {
      if (existing.content === args.content) {
        return;
      }
      throw new Error(
        `Snapshot ${args.id} at version ${args.version} already exists ` +
          `with different content: ${existing.content} !== ${args.content}`
      );
    }
    await ctx.db.insert("snapshots", {
      id: args.id,
      version: args.version,
      content: args.content,
    });
  },
});

export const getLatestVersion = query({
  args: { id: v.string() },
  returns: v.union(v.null(), v.number()),
  handler: async (ctx, args) => {
    return ctx.db
      .query("snapshots")
      .withIndex("id_version", (q) => q.eq("id", args.id))
      .order("desc")
      .first()
      .then((s) => s?.version ?? null);
  },
});

export const submitSteps = mutation({
  args: {
    id: v.string(),
    version: v.number(),
    clientId: vClientId,
    steps: v.array(v.string()),
  },
  returns: v.union(
    v.object({
      status: v.literal("needs-rebase"),
      clientIds: v.array(vClientId),
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
  return [steps, clientIds] as const;
}

export const get = query({
  args: {
    id: v.string(),
    version: v.optional(v.number()),
    ignoreSteps: v.optional(v.boolean()),
  },
  returns: v.union(
    v.object({
      content: v.null(),
    }),
    v.object({
      content: v.string(),
      steps: v.array(v.string()),
      clientIds: v.array(vClientId),
      version: v.number(),
    })
  ),
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
        content: null,
      };
    }
    const [steps, clientIds] =
      snapshot.version === args.version || args.ignoreSteps
        ? [[], []]
        : await fetchSteps(ctx, args.id, snapshot.version, args.version);
    return {
      content: snapshot.content,
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
    return [steps, clientIds] as const;
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
    for (let i = 0; i < targetVersion - lastDelta.version; i++) {
      steps.push(nextDelta.steps[i]);
      clientIds.push(nextDelta.clientId);
    }
  }
  if (targetVersion && steps.length !== targetVersion - afterVersion) {
    throw new Error(
      `Steps mismatch ${afterVersion}...${targetVersion}: ${steps.length}`
    );
  }
  return [steps, clientIds] as const;
}

export const getSteps = query({
  args: { id: v.string(), version: v.number() },
  returns: v.object({
    steps: v.array(v.string()),
    clientIds: v.array(vClientId),
    version: v.number(),
  }),
  handler: async (ctx, args) => {
    const [steps, clientIds] = await fetchSteps(ctx, args.id, args.version);
    return { steps, clientIds, version: args.version + steps.length };
  },
});
