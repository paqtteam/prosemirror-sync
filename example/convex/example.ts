import { v } from "convex/values";
import { components } from "./_generated/api";
import { mutation } from "./_generated/server";
import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { getSchema } from "@tiptap/core";
import { Transform, Step } from "@tiptap/pm/transform";
import { extensions } from "../src/extensions";

const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);
export const {
  getSnapshot,
  submitSnapshot,
  latestVersion,
  getSteps,
  submitSteps,
} = prosemirrorSync.syncApi({
  checkRead(ctx, id) {
    // const user = await userFromAuth(ctx);
    // ...validate that the user can read this document
  },
  checkWrite(ctx, id) {
    // const user = await userFromAuth(ctx);
    // ...validate that the user can write to this document
  },
  onSnapshot(ctx, id, snapshot, version) {
    // ...do something with the snapshot, like store a copy in another table,
    // save a text version of the document for text search, or generate
    // embeddings for vector search.
  },
});

// This is an example of how to modify a document using the transform fn.
export const transformExample = mutation({
  args: {
    id: v.string(),
  },
  handler: async (ctx, { id }) => {
    const schema = getSchema(extensions);
    const node = await prosemirrorSync.transform(ctx, id, schema, (node) => {
      const tr = new Transform(node);
      tr.insert(0, schema.text("Hello world"));
      return tr;
    });
    return node.toJSON();
  },
});

// This is an example of how to manually transform the document.
export const manualTransform = mutation({
  args: {
    id: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { id, text }) => {
    const snapshot = await ctx.runQuery(
      components.prosemirrorSync.lib.getSnapshot,
      {
        id,
      }
    );
    if (!snapshot.content) {
      throw new Error("Document not found");
    }
    const content = JSON.parse(snapshot.content);
    const schema = getSchema(extensions);
    const serverVersion = new Transform(schema.nodeFromJSON(content));
    const stepsResult = await ctx.runQuery(
      components.prosemirrorSync.lib.getSteps,
      { id, version: snapshot.version }
    );
    if (stepsResult.steps.length > 0) {
      for (const step of stepsResult.steps) {
        serverVersion.step(Step.fromJSON(schema, JSON.parse(step)));
      }
    }
    let version = stepsResult.version;
    while (true) {
      const tr = new Transform(serverVersion.doc);
      tr.insert(0, schema.text(text));

      const result = await ctx.runMutation(
        components.prosemirrorSync.lib.submitSteps,
        {
          id,
          clientId: "server function",
          version,
          steps: tr.steps.map((step) => JSON.stringify(step.toJSON())),
        }
      );
      if (result.status === "synced") {
        await ctx.runMutation(components.prosemirrorSync.lib.submitSnapshot, {
          id,
          version: version + tr.steps.length,
          content: JSON.stringify(tr.doc.toJSON()),
        });
        return tr.doc.toJSON();
      }
      for (const step of result.steps) {
        serverVersion.step(Step.fromJSON(schema, JSON.parse(step)));
      }
      version += result.steps.length;
    }
  },
});
