import "./App.css";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { api } from "../convex/_generated/api";
import { Content, Extension, getSchema } from "@tiptap/core";
import { useSync } from "./sync";

const defaultExtensions = [
  StarterKit,
  Placeholder.configure({
    placeholder: "Write something…",
  }),
];
const schema = getSchema(defaultExtensions);

function App() {
  const id = "3";
  const sync = useSync(id, {
    syncApi: api.example,
    schema,
  });
  return (
    <>
      <h1>Convex Prosemirror Component Example</h1>
      <div className="card">
        {sync.isLoading ? (
          <p>Loading...</p>
        ) : sync.content !== null ? (
          <TipTap
            syncExtension={sync.extension}
            content={sync.content}
            key={id}
          />
        ) : (
          <button
            onClick={() => {
              sync.create("<p>Write something...</p>");
            }}
          >
            Create document {id}
          </button>
        )}
      </div>
    </>
  );
}

function TipTap(props: { syncExtension: Extension; content: Content }) {
  const editor = useEditor({
    extensions: [...defaultExtensions, props.syncExtension],
    content: props.content,
  });

  return (
    <>
      <EditorContent editor={editor} />
    </>
  );
}

export default App;
