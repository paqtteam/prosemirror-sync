import { components } from "./_generated/api";
import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";

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
