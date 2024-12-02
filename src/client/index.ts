import {
  ApiFromModules,
  Expand,
  FunctionReference,
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
  syncApi() {
    return {
      submitSnapshot: mutationGeneric({
        args: {
          id: v.string(),
          version: v.number(),
          content: v.string(),
        },
        handler: async (ctx, args) => {
          return ctx.runMutation(this.component.lib.submitSnapshot, args);
        },
      }),
      getVersion: queryGeneric({
        args: { id: v.string() },
        handler: async (ctx, args) => {
          return ctx.runQuery(this.component.lib.getVersion, args);
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
          return ctx.runMutation(this.component.lib.submitSteps, args);
        },
      }),
      get: queryGeneric({
        args: {
          id: v.string(),
          version: v.optional(v.number()),
          ignoreSteps: v.optional(v.boolean()),
        },
        handler: async (ctx, args) => {
          return ctx.runQuery(this.component.lib.get, args);
        },
      }),
      getSteps: queryGeneric({
        args: {
          id: v.string(),
          version: v.number(),
        },
        handler: async (ctx, args) => {
          return ctx.runQuery(this.component.lib.getSteps, args);
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
