import {
  ApiFromModules,
  Expand,
  FilterApi,
  FunctionReference,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { GenericId, v } from "convex/values";
import { api } from "../component/_generated/api";
import { vClientId } from "../component/schema";

export type SyncApi = ApiFromModules<{
  sync: ReturnType<Prosemirror["syncApi"]>;
}>["sync"];

export class Prosemirror {
  constructor(
    public component: UseApi<typeof api>,
  ) {}
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

type RunQueryCtx = {
  runQuery: GenericQueryCtx<GenericDataModel>["runQuery"];
};
type RunMutationCtx = {
  runMutation: GenericMutationCtx<GenericDataModel>["runMutation"];
};

export type OpaqueIds<T> = T extends GenericId<infer _T> | string
  ? string
  : T extends (infer U)[]
    ? OpaqueIds<U>[]
    : T extends ArrayBuffer
      ? ArrayBuffer
      : T extends object
        ? { [K in keyof T]: OpaqueIds<T[K]> }
        : T;

export type UseApi<API> = Expand<{
  [mod in keyof API]: API[mod] extends FunctionReference<
    infer FType,
    "public",
    infer FArgs,
    infer FReturnType,
    infer FComponentPath
  >
    ? FunctionReference<
        FType,
        "internal",
        OpaqueIds<FArgs>,
        OpaqueIds<FReturnType>,
        FComponentPath
      >
    : UseApi<API[mod]>;
}>;
