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
import { v, VString } from "convex/values";
import { Mounts } from "../component/_generated/api";
import { vClientId } from "../component/schema";

export type SyncApi = ApiFromModules<{
  sync: ReturnType<ProsemirrorSync["syncApi"]>;
}>["sync"];

// e.g. `ctx` from a Convex mutation or action.
export type RunMutationCtx = {
  runMutation: GenericMutationCtx<GenericDataModel>["runMutation"];
};

export class ProsemirrorSync<Id extends string = string> {
  /**
   * Backend API for the ProsemirrorSync component.
   * Responsible for exposing the `sync` API to the client, and having
   * convenience methods for interacting with the component from the backend.
   *
   * Typically used like:
   *
   * ```ts
   * const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);
   * export const {
   * ... // see {@link syncApi} docstring for details
   * } = prosemirrorSync.syncApi({...});
   * ```
   *
   * @param component - Generally `components.prosemirrorSync` from
   * `./_generated/api` once you've configured it in `convex.config.ts`.
   */
  constructor(public component: UseApi<Mounts>) {}
  /**
   * Create a new document with the given ID and content.
   *
   * @param ctx - A Convex mutation context.
   * @param id - The document ID.
   * @param content - The document content. Should be ProseMirror JSON.
   * @returns A promise that resolves when the document is created.
   */
  create(ctx: RunMutationCtx, id: Id, content: object) {
    return ctx.runMutation(this.component.lib.submitSnapshot, {
      id,
      version: 1,
      content: JSON.stringify(content),
    });
  }
  /**
   * Expose the sync API to the client for use with the `useTiptapSync` hook.
   * If you export these in `convex/prosemirror.ts`, pass `api.prosemirror`
   * to the `useTiptapSync` hook.
   *
   * It allows you to define optional read and write permissions, along with
   * a callback when new snapshots are available.
   *
   * You can pass the optional type argument `<DataModel>` to have the `ctx`
   * parameter specific to your tables.
   *
   * ```ts
   * import { DataModel } from "./convex/_generated/dataModel";
   * // ...
   * export const { ... } = prosemirrorSync.syncApi<DataModel>({...});
   * ```
   *
   * To define just one function to use for both, you can define it like this:
   * ```ts
   * async function checkPermissions(ctx: QueryCtx, id: string) {
   *   const user = await getAuthUser(ctx);
   *   if (!user || !(await canUserAccessDocument(user, id))) {
   *     throw new Error("Unauthorized");
   *   }
   * }
   * ```
   * @param opts - Optional callbacks.
   * @returns functions to export, so the `useTiptapSync` hook can use them.
   */
  syncApi<DataModel extends GenericDataModel>(opts?: {
    checkRead?: (
      ctx: GenericQueryCtx<DataModel>,
      id: Id
    ) => void | Promise<void>;
    checkWrite?: (
      ctx: GenericMutationCtx<DataModel>,
      id: Id
    ) => void | Promise<void>;
    onSnapshot?: (
      ctx: GenericMutationCtx<DataModel>,
      id: Id,
      snapshot: string,
      version: number
    ) => void | Promise<void>;
  }) {
    const id = v.string() as VString<Id>;
    return {
      getSnapshot: queryGeneric({
        args: {
          id,
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
          id,
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
        args: { id },
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
          id,
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
          id,
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
