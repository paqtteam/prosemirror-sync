import { ConvexReactClient } from "convex/react";
import { type AnyExtension, type Content, type JSONContent } from "@tiptap/core";
import { SyncApi } from "../client";
export type UseSyncOptions = {
    onSyncError?: (error: Error) => void;
    snapshotDebounceMs?: number;
    debug?: boolean;
};
export declare function useTiptapSync(syncApi: SyncApi, id: string, opts?: UseSyncOptions): {
    readonly extension: null;
    readonly isLoading: true;
    readonly initialContent: null;
    /**
     * Create the document without waiting to hear from the server.
     * Warning: Only call this if you just created the document id.
     * It's safer to wait until loading is false.
     * It's also best practice to pass in the same initial content everywhere,
     * so if two clients create the same document id, they'll both end up
     * with the same initial content. Otherwise the second client will
     * throw an exception on the snapshot creation.
     */
    readonly create: (content: JSONContent) => Promise<void>;
} | {
    readonly extension: null;
    readonly isLoading: false;
    readonly initialContent: null;
    readonly create: (content: JSONContent) => Promise<void>;
} | {
    readonly extension: AnyExtension;
    readonly isLoading: false;
    readonly initialContent: string | JSONContent | JSONContent[];
    readonly create?: undefined;
};
export declare function syncExtension(convex: ConvexReactClient, id: string, syncApi: SyncApi, initialState: InitialState, opts?: UseSyncOptions): AnyExtension;
type InitialState = {
    initialContent: Content;
    initialVersion: number;
    restoredSteps?: object[];
};
export declare function useInitialState(syncApi: SyncApi, id: string, cacheKeyPrefix?: string): {
    initialContent: Content;
    initialVersion: number;
    restoredSteps?: object[];
    loading: boolean;
} | {
    loading: boolean;
    initialContent: null;
} | {
    loading: boolean;
    initialContent?: undefined;
};
export {};
//# sourceMappingURL=index.d.ts.map