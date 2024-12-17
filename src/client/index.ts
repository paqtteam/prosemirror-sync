import {
  ApiFromModules,
  Expand,
  FunctionReference,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";
import { Mounts } from "../component/_generated/api";
import { vClientId } from "../component/schema";

export type SyncApi = ApiFromModules<{
  sync: ReturnType<Prosemirror["syncApi"]>;
}>["sync"];

// e.g. `ctx` from a Convex mutation or action.
export type RunMutationCtx = {
  runMutation: GenericMutationCtx<GenericDataModel>["runMutation"];
};

export class Prosemirror {
  constructor(public component: UseApi<Mounts>) {}
  /**
   * Create a new document with the given ID and content.
   *
   * @param ctx - A Convex mutation context.
   * @param id - The document ID.
   * @param content - The document content. Should be ProseMirror JSON.
   * @returns A promise that resolves when the document is created.
   */
  create(ctx: RunMutationCtx, id: string, content: object) {
    return ctx.runMutation(this.component.lib.submitSnapshot, {
      id,
      version: 1,
      content: JSON.stringify(content),
    });
  }
  syncApi<DataModel extends GenericDataModel>(opts?: {
    checkRead?: (
      ctx: GenericQueryCtx<DataModel>,
      id: string
    ) => void | Promise<void>;
    checkWrite?: (
      ctx: GenericMutationCtx<DataModel>,
      id: string
    ) => void | Promise<void>;
    onSnapshot?: (
      ctx: GenericMutationCtx<DataModel>,
      id: string,
      snapshot: string,
      version: number
    ) => void | Promise<void>;
  }) {
    return {
      getSnapshot: queryGeneric({
        args: {
          id: v.string(),
          version: v.optional(v.number()),
        },
        returns: v.union(
          v.object({
            content: v.null(),
          }),
          v.object({
            content: v.string(),
            version: v.number(),
          })
        ),
        handler: async (ctx, args) => {
          if (opts?.checkRead) {
            await opts.checkRead(ctx, args.id);
          }
          return ctx.runQuery(this.component.lib.getSnapshot, args);
        },
      }),
      submitSnapshot: mutationGeneric({
        args: {
          id: v.string(),
          version: v.number(),
          content: v.string(),
        },
        returns: v.null(),
        handler: async (ctx, args) => {
          if (opts?.checkWrite) {
            await opts.checkWrite(ctx, args.id);
          }
          if (opts?.onSnapshot) {
            await opts.onSnapshot(ctx, args.id, args.content, args.version);
          }
          await ctx.runMutation(this.component.lib.submitSnapshot, args);
        },
      }),
      latestVersion: queryGeneric({
        args: { id: v.string() },
        returns: v.union(v.null(), v.number()),
        handler: async (ctx, args) => {
          if (opts?.checkRead) {
            await opts.checkRead(ctx, args.id);
          }
          return ctx.runQuery(this.component.lib.latestVersion, args);
        },
      }),
      getSteps: queryGeneric({
        args: {
          id: v.string(),
          version: v.number(),
        },
        handler: async (ctx, args) => {
          if (opts?.checkRead) {
            await opts.checkRead(ctx, args.id);
          }
          return ctx.runQuery(this.component.lib.getSteps, args);
        },
      }),
      submitSteps: mutationGeneric({
        args: {
          id: v.string(),
          version: v.number(),
          clientId: vClientId,
          steps: v.array(v.string()),
        },
        handler: async (ctx, args) => {
          if (opts?.checkWrite) {
            await opts.checkWrite(ctx, args.id);
          }
          return ctx.runMutation(this.component.lib.submitSteps, args);
        },
      }),
    };
  }
}

/* Type utils follow */

export type UseApi<API> = Expand<{
  [mod in keyof API]: API[mod] extends FunctionReference<
    infer FType,
    "public",
    infer FArgs,
    infer FReturnType,
    infer FComponentPath
  >
    ? FunctionReference<FType, "internal", FArgs, FReturnType, FComponentPath>
    : UseApi<API[mod]>;
}>;
