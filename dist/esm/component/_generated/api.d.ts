/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as lib from "../lib.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  lib: typeof lib;
}>;
export type Mounts = {
  lib: {
    deleteDocument: FunctionReference<
      "mutation",
      "public",
      { id: string },
      null
    >;
    deleteSnapshots: FunctionReference<
      "mutation",
      "public",
      { afterVersion?: number; beforeVersion?: number; id: string },
      null
    >;
    deleteSteps: FunctionReference<
      "mutation",
      "public",
      {
        afterVersion?: number;
        beforeTs: number;
        deleteNewerThanLatestSnapshot?: boolean;
        id: string;
      },
      null
    >;
    getSnapshot: FunctionReference<
      "query",
      "public",
      { id: string; version?: number },
      { content: null } | { content: string; version: number }
    >;
    getSteps: FunctionReference<
      "query",
      "public",
      { id: string; version: number },
      {
        clientIds: Array<string | number>;
        steps: Array<string>;
        version: number;
      }
    >;
    latestVersion: FunctionReference<
      "query",
      "public",
      { id: string },
      null | number
    >;
    submitSnapshot: FunctionReference<
      "mutation",
      "public",
      {
        content: string;
        id: string;
        pruneSnapshots?: boolean;
        version: number;
      },
      null
    >;
    submitSteps: FunctionReference<
      "mutation",
      "public",
      {
        clientId: string | number;
        id: string;
        steps: Array<string>;
        version: number;
      },
      | {
          clientIds: Array<string | number>;
          status: "needs-rebase";
          steps: Array<string>;
        }
      | { status: "synced" }
    >;
  };
};
// For now fullApiWithMounts is only fullApi which provides
// jump-to-definition in component client code.
// Use Mounts for the same type without the inference.
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
