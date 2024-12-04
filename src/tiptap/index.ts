import { ConvexReactClient, useConvex, Watch } from "convex/react";
import { Content, Editor, Extension, JSONContent } from "@tiptap/core";
import * as collab from "@tiptap/pm/collab";
import { Step } from "@tiptap/pm/transform";
import { useEffect, useMemo, useState } from "react";
import { SyncApi } from "../client";

const log: typeof console.log = console.debug;

export function useSync(syncApi: SyncApi, id: string) {
  const convex = useConvex();
  const initial = useInitialState(syncApi, id);
  const extension = useMemo(() => {
    const { loading, ...initialState } = initial;
    if (loading || !initialState.initialContent) return null;
    return sync(convex, id, syncApi, initialState);
    // // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convex, id, initial.loading, initial.initialContent]);
  if (initial.loading) {
    return {
      extension: null,
      isLoading: true,
      initialContent: null,
    } as const;
  }
  if (!initial.initialContent) {
    return {
      extension: null,
      isLoading: false,
      initialContent: null,
      create: (initial: JSONContent) =>
        convex.mutation(syncApi.submitSnapshot, {
          id,
          version: 1,
          content: JSON.stringify(initial),
        }),
    } as const;
  }
  return {
    extension: extension!,
    isLoading: false,
    initialContent: initial.initialContent,
  } as const;
}

export function sync(
  convex: ConvexReactClient,
  id: string,
  syncApi: SyncApi,
  initialState: InitialState
) {
  let active: boolean = false;
  let pending:
    | { resolve: () => void; reject: () => void; promise: Promise<void> }
    | undefined;
  let watch: Watch<number | null> | undefined;

  async function trySync(editor: Editor) {
    const serverVersion = watch?.localQueryResult();
    if (serverVersion === undefined) {
      return;
    }
    if (serverVersion === null) {
      // TODO: Handle deletion gracefully
      throw new Error("Syncing a document that doesn't exist server-side");
    }
    if (active) {
      if (!pending) {
        let resolve = () => {};
        let reject = () => {};
        const promise = new Promise<void>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        pending = { resolve, reject, promise };
      }
      return pending.promise;
    }
    active = true;
    try {
      const version = collab.getVersion(editor.state);
      if (serverVersion > version) {
        log("Updating to server version", {
          id,
          version,
          serverVersion,
        });
        const steps = await convex.query(syncApi.getSteps, {
          id,
          version,
        });
        receiveSteps(
          editor,
          steps.steps.map((step) =>
            Step.fromJSON(editor.schema, JSON.parse(step))
          ),
          steps.clientIds
        );
      }
      while (true) {
        const sendable = collab.sendableSteps(editor.state);
        if (!sendable) {
          break;
        }
        const steps = sendable.steps.map((step) =>
          JSON.stringify(step.toJSON())
        );
        log("Sending steps", { steps, version: sendable.version });
        const result = await convex.mutation(syncApi.submitSteps, {
          id,
          steps,
          version: sendable.version,
          clientId: sendable.clientID,
        });
        if (result.status === "synced") {
          // We replay the steps locally to avoid refetching them.
          receiveSteps(
            editor,
            steps.map((step) => Step.fromJSON(editor.schema, JSON.parse(step))),
            steps.map(() => sendable.clientID)
          );
          log("Synced", {
            steps,
            version,
            newVersion: collab.getVersion(editor.state),
          });
          break;
        }
        if (result.status === "needs-rebase") {
          receiveSteps(
            editor,
            result.steps.map((step) =>
              Step.fromJSON(editor.schema, JSON.parse(step))
            ),
            result.clientIds
          );
          log("Rebased", {
            steps,
            newVersion: collab.getVersion(editor.state),
          });
        }
      }
    } finally {
      active = false;
      if (pending) {
        const { resolve, reject } = pending;
        pending = undefined;
        trySync(editor).then(resolve, reject);
      }
    }
  }
  function receiveSteps(
    editor: Editor,
    steps: Step[],
    clientIds: (string | number)[]
  ) {
    editor.view.dispatch(
      collab.receiveTransaction(editor.state, steps, clientIds, {
        mapSelectionBackward: true,
      })
    );
  }

  let unsubscribe: (() => void) | undefined;

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
        // this.editor.view.dispatch(tr);
      }
      watch = convex.watchQuery(syncApi.getVersion, { id });
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

type InitialState = {
  initialContent: Content;
  initialVersion: number;
  restoredSteps?: object[];
};

export function useInitialState(
  syncApi: SyncApi,
  id: string,
  cacheKeyPrefix?: string
) {
  const [initial, setInitial] = useState<InitialState | undefined>(() =>
    getCachedState(id, cacheKeyPrefix)
  );
  const [loading, setLoading] = useState(!initial);
  const convex = useConvex();
  useEffect(() => {
    if (initial) return;
    convex
      .query(syncApi.get, {
        id,
        ignoreSteps: true,
      })
      .then((serverInitial) => {
        if (serverInitial.content !== null) {
          log("Got initial state from server", {
            initialContent: serverInitial.content,
            initialVersion: serverInitial.version,
          });
          setInitial({
            initialContent: JSON.parse(serverInitial.content) as Content,
            initialVersion: serverInitial.version,
          });
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error getting initial state", error);
        setLoading(false);
        setTimeout(() => setLoading(true), 1000); // Retry in 1 second
      });
  }, [initial]);
  if (initial) {
    return {
      loading: false,
      ...initial,
    };
  }
  if (!loading) {
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

function getCachedState(
  id: string,
  cacheKeyPrefix?: string
): InitialState | undefined {
  // TODO: Verify that this works
  const cacheKey = `${cacheKeyPrefix ?? "convex-sync"}-${id}`;
  const cache = sessionStorage.getItem(cacheKey);
  if (cache) {
    const { content, version, steps } = JSON.parse(cache);
    return {
      initialContent: content as Content,
      initialVersion: Number(version),
      restoredSteps: (steps ?? []) as object[],
    };
  }
}
