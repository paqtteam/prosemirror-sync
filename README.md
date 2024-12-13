# Convex Prosemirror Component

[![npm version](https://badge.fury.io/js/@convex-dev%2Fprosemirror-sync.svg)](https://badge.fury.io/js/@convex-dev%2Fprosemirror-sync)

This is a [Convex Component](https://convex.dev/components) that syncs a
[ProseMirror](https://prosemirror.net/) document between clients.

Features:

- Safely merges changes between clients via OT rebasing.
- Simple React hook to fetch the initial document and keep it in sync via a
  TipTap extension.

Coming soon:

- [ ] Server-side entrypoints for authorizing reads & writes, and responding to
      new snapshots.
- [ ] Client-driven snapshotting / compaction. On some debounced interval, send
      up the latest server-synced version of the document to the server. This
      allows new clients to avoid loading all the intermediate steps, without
      needing to read & write the full document on every delta.
- [ ] Offline editing support: cache the document and local changes in
      `sessionStorage` and sync when back online (only for active browser tab).
  - [ ] Also save snapshots (but not local edits) to `localStorage` so new tabs
        can see and edit documents offline (but won't see edits from other tabs
        until they're back online). A future implementation could sync CRDTs
        instead of OT to support this.
- [ ] Better readme:
  - [ ] Intro: example code snippets
  - [ ] Why should you use this component?
  - [ ] Links to Stack post & other resources.

Future features likely won't make the v1 cut but could be added later:

- Configuration for debouncing snapshot generation & syncing deltas (to reduce
  bandwidth and function calls).
- Vacuuming controls for old deltas & snapshots.
- Implementing it as a ProseMirror plugin instead of a TipTap extension, so raw
  ProseMirror usecases can also use it.
- Handling edge cases, such as old clients with local changes on top of an older
  version of the document where the steps necessary for them to rebase their
  changes have since been vacuumed.
- Type parameter for the document ID for more type safety for folks using Convex
  IDs as their document IDs. Maybe even providing the validator for the document
  ID to the component client constructor.
- Drop clientIds entirely and just use two UUIDs locally to differentiate our
  changes from server-applied changes.
- Add an optional authorId to the data model to track who made which changes.

Missing features that aren't currently planned:

- Supporting documents larger than 1 Megabyte.
- Offline support that syncs changes between browser tabs or peer-to-peer.
- Syncing Yjs documents instead of ProseMirror steps. That would be done by a
  different Yjs-specific component.
- Syncing presence (e.g. showing other users' names and cursor in the UI). This
  is another thing a Yjs-oriented ProseMirror component could tackle.

## Running the example locally

In one terminal, run:

```sh
npm install
cd example
npm install
# Involves signing into Convex if necessary and deploying to a Convex.
npm run dev
```

And in another terminal, run:

```sh
npm run dev:frontend
```

<!-- START: Include on https://convex.dev/components -->

Found a bug? Feature request? [File it here](https://github.com/get-convex/prosemirror-sync/issues).

## Pre-requisite: Convex

You'll need an existing Convex project to use the component.
Convex is a hosted backend platform, including a database, serverless functions,
and a ton more you can learn about [here](https://docs.convex.dev/get-started).

Run `npm create convex` or follow any of the [quickstarts](https://docs.convex.dev/home) to set one up.

## Installation

Install the component package:

```ts
npm install @convex-dev/prosemirror-sync
```

Create a `convex.config.ts` file in your app's `convex/` folder and install the component by calling `use`:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import prosemirror from "@convex-dev/prosemirror-sync/convex.config";

const app = defineApp();
app.use(prosemirror);

export default app;
```

## Usage

```ts
import { components } from "./_generated/api";
import { Prosemirror } from "@convex-dev/prosemirror-sync";

const prosemirror = new Prosemirror(components.prosemirror, {
  ...options,
});
```

See more example usage in [example.ts](./example/convex/example.ts).

<!-- END: Include on https://convex.dev/components -->
