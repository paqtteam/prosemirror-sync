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

export class Prosemirror {
  constructor(public component: UseApi<Mounts>) {}
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
      snapshot: string
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
          await ctx.runMutation(this.component.lib.submitSnapshot, args);
          if (opts?.onSnapshot) {
            await opts.onSnapshot(ctx, args.id, args.content);
          }
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
