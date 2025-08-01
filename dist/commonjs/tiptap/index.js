import { useConvex, useMutation, useQuery, } from "convex/react";
import { Extension, } from "@tiptap/core";
import * as collab from "@tiptap/pm/collab";
import { Step } from "@tiptap/pm/transform";
import { useCallback, useMemo, useRef } from "react";
// How many steps we will attempt to sync in one request.
const MAX_STEPS_SYNC = 1000;
const SNAPSHOT_DEBOUNCE_MS = 1000;
export function useTiptapSync(syncApi, id, opts) {
    const log = opts?.debug ? console.debug : () => { };
    const convex = useConvex();
    const initial = useInitialState(syncApi, id);
    const extension = useMemo(() => {
        const { loading, ...initialState } = initial;
        if (loading || !initialState.initialContent)
            return null;
        return syncExtension(convex, id, syncApi, initialState, opts);
        // // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [convex, id, initial.loading, initial.initialContent]);
    const submitSnapshot = useMutation(syncApi.submitSnapshot).withOptimisticUpdate((localQueryStore, args) => {
        // This update will allow the useInitialState to respond immediately to
        // creating documents, as if it came from the server.
        const existing = localQueryStore.getQuery(syncApi.getSnapshot, { id });
        if (!existing?.content) {
            localQueryStore.setQuery(syncApi.getSnapshot, { id }, {
                version: args.version,
                content: args.content,
            });
        }
        const version = localQueryStore.getQuery(syncApi.latestVersion, { id });
        if (version === null) {
            localQueryStore.setQuery(syncApi.latestVersion, { id }, args.version);
        }
    });
    const create = useCallback(async (content) => {
        log("Creating new document", { id });
        await submitSnapshot({
            id,
            version: 1,
            content: JSON.stringify(content),
        });
    }, [convex, id]);
    if (initial.loading) {
        return {
            extension: null,
            isLoading: true,
            initialContent: null,
            /**
             * Create the document without waiting to hear from the server.
             * Warning: Only call this if you just created the document id.
             * It's safer to wait until loading is false.
             * It's also best practice to pass in the same initial content everywhere,
             * so if two clients create the same document id, they'll both end up
             * with the same initial content. Otherwise the second client will
             * throw an exception on the snapshot creation.
             */
            create,
        };
    }
    if (!initial.initialContent) {
        return {
            extension: null,
            isLoading: false,
            initialContent: null,
            create,
        };
    }
    return {
        extension: extension,
        isLoading: false,
        initialContent: initial.initialContent,
    };
}
export function syncExtension(convex, id, syncApi, initialState, opts) {
    const log = opts?.debug ? console.debug : () => { };
    let snapshotTimer;
    const trySubmitSnapshot = (version, content) => {
        if (snapshotTimer) {
            clearTimeout(snapshotTimer);
        }
        snapshotTimer = setTimeout(() => {
            void convex
                .mutation(syncApi.submitSnapshot, { id, version, content })
                .catch(opts?.onSyncError);
        }, opts?.snapshotDebounceMs ?? SNAPSHOT_DEBOUNCE_MS);
    };
    let active = false;
    let pending;
    let watch;
    async function trySync(editor) {
        const serverVersion = watch?.localQueryResult();
        if (serverVersion === undefined) {
            return;
        }
        if (serverVersion && serverVersion > collab.getVersion(editor.state)) {
            clearTimeout(snapshotTimer);
            snapshotTimer = undefined;
        }
        if (active) {
            if (!pending) {
                let resolve = () => { };
                let reject = () => { };
                const promise = new Promise((res, rej) => {
                    resolve = res;
                    reject = rej;
                });
                pending = { resolve, reject, promise };
            }
            return pending.promise;
        }
        active = true;
        try {
            if (await doSync(editor, convex, syncApi, id, serverVersion, initialState, opts?.debug)) {
                const version = collab.getVersion(editor.state);
                const content = JSON.stringify(editor.state.doc.toJSON());
                if (collab.sendableSteps(editor.state)) {
                    throw new Error("Synced but still have sendable steps");
                }
                trySubmitSnapshot(version, content);
            }
        }
        catch (error) {
            if (opts?.onSyncError) {
                opts.onSyncError(error);
            }
            else {
                throw error;
            }
        }
        finally {
            active = false;
            if (pending) {
                const { resolve, reject } = pending;
                pending = undefined;
                trySync(editor).then(resolve, reject);
            }
        }
    }
    let unsubscribe;
    return Extension.create({
        name: "convex-sync",
        onDestroy() {
            log("destroying");
            unsubscribe?.();
        },
        onCreate() {
            if (initialState.restoredSteps?.length) {
                // TODO: verify that restoring local steps works
                log("Restoring local steps", initialState.restoredSteps);
                const tr = this.editor.state.tr;
                for (const step of initialState.restoredSteps) {
                    tr.step(Step.fromJSON(this.editor.schema, step));
                }
                this.editor.view.dispatch(tr);
            }
            watch = convex.watchQuery(syncApi.latestVersion, { id });
            unsubscribe = watch.onUpdate(() => {
                void trySync(this.editor);
            });
            void trySync(this.editor);
        },
        onUpdate() {
            void trySync(this.editor);
        },
        addProseMirrorPlugins() {
            log("Adding collab plugin", {
                version: initialState.initialVersion,
            });
            return [
                collab.collab({
                    version: initialState.initialVersion,
                }),
            ];
        },
    });
}
async function doSync(editor, convex, syncApi, id, serverVersion, initialState, debug) {
    const log = debug ? console.debug : () => { };
    if (serverVersion === null) {
        if (initialState.initialVersion <= 1) {
            // This is a new document, so we can create it on the server.
            // Note: this should only happen if the initial version is loaded from
            // a local cache. Creating a new document on the client will set the
            // initial version to 1 optimistically.
            log("Syncing new document", { id });
            await convex.mutation(syncApi.submitSnapshot, {
                id,
                version: initialState.initialVersion,
                content: JSON.stringify(initialState.initialContent),
            });
        }
        else {
            // TODO: Handle deletion gracefully
            throw new Error("Syncing a document that doesn't exist server-side");
        }
    }
    const version = collab.getVersion(editor.state);
    if (serverVersion !== null && serverVersion > version) {
        log("Updating to server version", {
            id,
            version,
            serverVersion,
        });
        const steps = await convex.query(syncApi.getSteps, {
            id,
            version,
        });
        receiveSteps(editor, steps.steps.map((step) => Step.fromJSON(editor.schema, JSON.parse(step))), steps.clientIds);
    }
    let anyChanges = false;
    while (true) {
        const sendable = collab.sendableSteps(editor.state);
        if (!sendable) {
            break;
        }
        const steps = sendable.steps
            .slice(0, MAX_STEPS_SYNC)
            .map((step) => JSON.stringify(step.toJSON()));
        log("Sending steps", { steps, version: sendable.version });
        const result = await convex.mutation(syncApi.submitSteps, {
            id,
            steps,
            version: sendable.version,
            clientId: sendable.clientID,
        });
        if (result.status === "synced") {
            anyChanges = true;
            // We replay the steps locally to avoid refetching them.
            receiveSteps(editor, steps.map((step) => Step.fromJSON(editor.schema, JSON.parse(step))), steps.map(() => sendable.clientID));
            log("Synced", {
                steps,
                version,
                newVersion: collab.getVersion(editor.state),
            });
            continue;
        }
        if (result.status === "needs-rebase") {
            receiveSteps(editor, result.steps.map((step) => Step.fromJSON(editor.schema, JSON.parse(step))), result.clientIds);
            log("Rebased", {
                steps,
                newVersion: collab.getVersion(editor.state),
            });
        }
    }
    return anyChanges;
}
function receiveSteps(editor, steps, clientIds) {
    editor.view.dispatch(collab.receiveTransaction(editor.state, steps, clientIds, {
        mapSelectionBackward: true,
    }));
}
export function useInitialState(syncApi, id, cacheKeyPrefix) {
    const serverRef = useRef({ id });
    const cachedState = useMemo(() => {
        return getCachedState(id, cacheKeyPrefix);
    }, [id, cacheKeyPrefix]);
    const serverInitial = useQuery(syncApi.getSnapshot, serverRef.current.snapshot && serverRef.current.id === id ? "skip" : { id });
    const snapshot = useMemo(() => {
        return (serverInitial &&
            serverInitial.content !== null && {
            initialContent: JSON.parse(serverInitial.content),
            initialVersion: serverInitial.version,
        });
    }, [serverInitial]);
    if (snapshot || serverRef.current.id !== id) {
        serverRef.current = { id, snapshot: snapshot || undefined };
    }
    const data = serverRef.current.snapshot || cachedState;
    if (data) {
        return {
            loading: false,
            ...data,
        };
    }
    if (!cachedState && serverInitial?.content === null) {
        // We couldn't find it locally or on the server.
        // We could dynamically create a new document here,
        // not sure if that's generally the right pattern (vs. explicit creation).
        return {
            loading: false,
            initialContent: null,
        };
    }
    return {
        loading: true,
    };
}
function getCachedState(id, cacheKeyPrefix) {
    // TODO: Verify that this works
    const cacheKey = `${cacheKeyPrefix ?? "convex-sync"}-${id}`;
    const cache = sessionStorage.getItem(cacheKey);
    if (cache) {
        const { content, version, steps } = JSON.parse(cache);
        return {
            initialContent: content,
            initialVersion: Number(version),
            restoredSteps: (steps ?? []),
        };
    }
}
//# sourceMappingURL=index.js.map