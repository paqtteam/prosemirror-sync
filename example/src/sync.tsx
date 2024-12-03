import { ConvexReactClient, useQuery, Watch } from "convex/react";
import { Extension } from "@tiptap/react";
import { Content, Editor } from "@tiptap/core";
import * as collab from "@tiptap/pm/collab";
import { Schema } from "@tiptap/pm/model";
import { Step } from "@tiptap/pm/transform";
import { useState } from "react";
import { SyncApi } from "../../src/client";

export function sync(
  convex: ConvexReactClient,
  id: string,
  opts: {
    syncApi: SyncApi;
    schema: Schema;
    initialVersion: number;
    clientId: string | number;
    restoredSteps?: Step[];
  }
) {
  console.debug("Initializing sync", { opts });
  let active: boolean = false;
  let pending:
    | { resolve: () => void; reject: () => void; promise: Promise<void> }
    | undefined;
  let watch: Watch<number | null> | undefined;

  async function trySync(editor: Editor) {
    const serverVersion = watch?.localQueryResult();
    if (serverVersion === undefined) {
      console.debug("No server version yet", { watch, editor });
      return;
    }
    if (serverVersion === null) {
      // TODO: Handle deletion gracefully
      throw new Error("Syncing a document that doesn't exist server-side");
    }
    if (active) {
      console.debug("Already syncing");
      if (!pending) {
        console.debug("Adding a pending sync");
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
        console.debug("Updating to server version", {
          id,
          version,
          serverVersion,
        });
        const steps = await convex.query(opts.syncApi.getSteps, {
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
        const result = await convex.mutation(opts.syncApi.submitSteps, {
          id,
          steps,
          version: sendable.version,
          clientId: opts.clientId,
        });
        if (result.status === "synced") {
          // We replay the steps locally to avoid refetching them.
          receiveSteps(
            editor,
            steps.map((step) => Step.fromJSON(editor.schema, JSON.parse(step))),
            steps.map(() => opts.clientId)
          );
          console.debug("Synced", {
            steps,
            version,
            newVersion: collab.getVersion(editor.state),
          });
          break;
        }
        if (result.status === "needs-rebase") {
          console.debug("Rebasing", {
            steps: result.steps,
            clientIds: result.clientIds,
          });
          receiveSteps(
            editor,
            result.steps.map((step) =>
              Step.fromJSON(editor.schema, JSON.parse(step))
            ),
            result.clientIds
          );
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
    const versionBefore = collab.getVersion(editor.state);
    const docBefore = editor.state.doc.toJSON();
    console.debug("Receiving steps", {
      steps: steps.map((step) => JSON.stringify(step.toJSON())),
      numSteps: steps.length,
      editable: editor.view.editable,
      doc: editor.state.doc,
      content: editor.state.doc.textContent,
      clientIds,
      versionBefore,
      docBefore,
    });
    editor.view.dispatch(
      collab.receiveTransaction(editor.state, steps, clientIds, {
        mapSelectionBackward: true,
      })
    );
    const versionAfter = collab.getVersion(editor.state);
    console.debug("Received steps", {
      versionBefore,
      versionAfter,
    });
  }

  let unsubscribe: (() => void) | undefined;

  return Extension.create({
    name: "convex-sync",
    onDestroy() {
      console.log("destroying");
      unsubscribe?.();
    },
    onCreate() {
      console.log("on create", JSON.stringify(this.editor.state.doc.toJSON()));
      if (opts.restoredSteps) {
        console.debug("restored steps", opts.restoredSteps);
        // TODO: verify that restoring steps works
        for (const step of opts.restoredSteps) {
          this.editor.state.tr.step(step);
        }
      }
      watch = convex.watchQuery(opts.syncApi.getVersion, { id });
      unsubscribe = watch.onUpdate(() => {
        console.debug("Server version updated", watch!.localQueryResult());
        trySync(this.editor);
      });
      trySync(this.editor);
    },
    onBeforeCreate() {
      console.log("before create", this.editor);
    },
    onUpdate() {
      console.log("update", this.editor.state.doc.textContent);
      trySync(this.editor);
    },
    // onTransaction({ editor, transaction }) {
    //   console.log("transaction", editor.state.doc.textContent);
    //   trySync(editor);
    // },
    addProseMirrorPlugins() {
      console.log("Adding collab plugin", {
        clientID: opts.clientId,
        version: opts.initialVersion,
      });
      return [
        collab.collab({
          clientID: opts.clientId,
          version: opts.initialVersion,
        }),
      ];
    },
  });
}

export function useInitialState(
  syncApi: SyncApi,
  schema: Schema,
  id: string,
  cacheKeyPrefix?: string
) {
  const [initial, setInitial] = useState(() =>
    getCachedState(schema, id, cacheKeyPrefix)
  );
  const serverInitial = useQuery(
    syncApi.get,
    initial ? "skip" : { id, ignoreSteps: true }
  );
  if (initial) {
    return {
      loading: false,
      ...initial,
    };
  }
  if (serverInitial && serverInitial.content === null) {
    // We couldn't find it locally or on the server.
    // We could dynamically create a new document here,
    // not sure if that's generally the right pattern (vs. explicit creation).
    return {
      loading: false,
      content: null,
    };
  }
  if (serverInitial && serverInitial.content !== null) {
    // TODO: Handle steps gracefully
    // const snapshot = schema.nodeFromJSON(JSON.parse(serverInitial.content));
    // const steps = serverInitial.steps.map((step) =>
    //   Step.fromJSON(schema, JSON.parse(step))
    // );
    // const node = steps.reduce<Node>((node, step) => {
    //   const result = step.apply(node);
    //   if (!result.doc) {
    //     throw new Error(
    //       result.failed ?? `Failed to apply step: ${JSON.stringify(step)}`
    //     );
    //   }
    //   return result.doc;
    // }, snapshot);
    console.debug("serverInitial", serverInitial);
    setInitial({
      // content: node.toJSON(),
      content: JSON.parse(serverInitial.content) as Content,
      version: serverInitial.version,
      steps: [],
      clientId: crypto.randomUUID(),
    });
  }
  console.debug("loading", { serverInitial });
  return {
    loading: true,
  };
}

function getCachedState(schema: Schema, id: string, cacheKeyPrefix?: string) {
  // TODO: Verify that this works
  const cacheKey = `${cacheKeyPrefix ?? "convex-sync"}-${id}`;
  const cache = sessionStorage.getItem(cacheKey);
  if (cache) {
    const { content, version, steps, clientId } = JSON.parse(cache);
    return {
      content: JSON.parse(content) as Content,
      // The server-persisted version of the content
      version: Number(version),
      // The user's local unconfirmedsteps
      steps:
        steps?.map((step: string) => Step.fromJSON(schema, JSON.parse(step))) ??
        [],
      clientId: clientId as string | number,
    };
  }
}
