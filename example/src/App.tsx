import "./App.css";
import { useConvex } from "convex/react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { api } from "../convex/_generated/api";
import { Content, getSchema } from "@tiptap/core";
import { Step } from "prosemirror-transform";
import { useMemo } from "react";
import { sync, useInitialState } from "./sync";

const defaultExtensions = [
  StarterKit,
  Placeholder.configure({
    placeholder: "Write something…",
  }),
];

function App() {
  const id = "1";
  const schema = getSchema(defaultExtensions);
  const initial = useInitialState(api.example, schema, id);
  const convex = useConvex();
  return (
    <>
      <h1>Convex Prosemirror Component Example</h1>
      <div className="card">
        {initial.loading ? (
          <p>Loading...</p>
        ) : initial.content ? (
          <TipTap {...initial} id={id} />
        ) : (
          <button
            onClick={() => {
              convex.mutation(api.example.submitSnapshot, {
                id,
                version: 1,
                content: JSON.stringify({
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Hi" }],
                    },
                  ],
                }),
              });
            }}
          >
            Create document {id}
          </button>
        )}
        <p>
          See <code>example/convex/example.ts</code> for all the ways to use
          this component
        </p>
      </div>
    </>
  );
}

function TipTap(props: {
  id: string;
  content: Content;
  version: number;
  steps: Step[];
  clientId: string | number;
}) {
  const convex = useConvex();
  // TODO: Is memoization necessary here? Just persistent extension?
  const extensions = useMemo(
    () => [
      ...defaultExtensions,
      sync(convex, props.id, {
        syncApi: api.example,
        schema: getSchema(defaultExtensions),
        initialVersion: props.version,
        clientId: props.clientId,
        restoredSteps: props.steps,
      }),
    ],
    [convex, props.id, props.version, props.clientId, props.steps]
  );
  const editor = useEditor({
    extensions,
    content: props.content,
    // content: "<p>Hi</p>",
  });

  return (
    <>
      <EditorContent editor={editor} />
    </>
  );
}

export default App;
