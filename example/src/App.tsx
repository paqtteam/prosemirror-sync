import "./App.css";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import { api } from "../convex/_generated/api";
import { Content, Extension } from "@tiptap/core";
import { useSync } from "@convex-dev/prosemirror-sync/tiptap";

const defaultExtensions = [
  StarterKit,
  TaskItem.configure({
    nested: true,
  }),
  TaskList,
  Placeholder,
  Typography,
  Underline,
];

function App(props: { id: string }) {
  const sync = useSync(api.example, props.id);
  return (
    <>
      <h1>Prosemirror + ConvexSync</h1>
      <div className="card">
        {sync.isLoading ? (
          <p>Loading...</p>
        ) : sync.initialContent !== null ? (
          <TipTap
            syncExtension={sync.extension}
            initialContent={sync.initialContent}
          />
        ) : (
          <button
            onClick={() => {
              sync.create({
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Write something..." }],
                  },
                ],
              });
            }}
          >
            Create document (id: {props.id})
          </button>
        )}
      </div>
    </>
  );
}

function TipTap(props: { syncExtension: Extension; initialContent: Content }) {
  const editor = useEditor({
    extensions: [...defaultExtensions, props.syncExtension],
    content: props.initialContent,
  });

  return (
    <>
      <EditorContent editor={editor} />
    </>
  );
}

export default App;
