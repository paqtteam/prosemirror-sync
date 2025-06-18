import { useMemo } from "react";
import type { SyncApi } from "../client";
import { type UseSyncOptions, useTiptapSync } from "../tiptap";
import {
  type Block,
  BlockNoteEditor,
  type BlockNoteEditorOptions,
  nodeToBlock,
} from "@blocknote/core";
import { Schema } from "prosemirror-model";

interface BlockNoteEditorInterface {
  readonly pmSchema: Schema;
}

interface BlockNoteEditorCreator<Editor extends BlockNoteEditorInterface> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (options: any) => Editor;
}

export type BlockNoteSyncOptions<
  Editor extends BlockNoteEditorInterface = BlockNoteEditor,
> = UseSyncOptions & {
  /**
   * If you pass options into the editor, you should pass them here, to ensure
   * the initialContent is parsed with the correct schema.
   */
  editorOptions?: Partial<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Omit<BlockNoteEditorOptions<any, any, any>, "initialContent">
  >;
  /**
   * The BlockNoteEditor from your installed version of BlockNote.
   * If you see an error like:
   * ```
   * Property 'options' is protected but type 'BlockNoteEditor<BSchema, ISchema, SSchema>' is not a class derived from 'BlockNoteEditor<BSchema, ISchema, SSchema>'.
   * ```
   * You can pass your own BlockNoteEditor version here.
   * This is a workaround for the types of your editor not matching the editor
   * version used by prosemirror-sync.
   */
  BlockNoteEditor?: BlockNoteEditorCreator<Editor>;
};

export function useBlockNoteSync<
  Editor extends BlockNoteEditorInterface = BlockNoteEditor,
>(syncApi: SyncApi, id: string, opts?: BlockNoteSyncOptions<Editor>) {
  const sync = useTiptapSync(syncApi, id, opts);
  const Editor =
    opts?.BlockNoteEditor ??
    (BlockNoteEditor as unknown as BlockNoteEditorCreator<Editor>);
  const editor = useMemo(() => {
    if (sync.initialContent === null) return null;
    const editor = Editor.create({
      ...opts?.editorOptions,
      _headless: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: Block<any, any, any>[] = [];

    // Convert the prosemirror document to BlockNote blocks.
    // inspired by https://github.com/TypeCellOS/BlockNote/blob/main/packages/server-util/src/context/ServerBlockNoteEditor.ts#L42
    const pmNode = editor.pmSchema.nodeFromJSON(sync.initialContent);
    if (pmNode.firstChild) {
      pmNode.firstChild.descendants((node) => {
        blocks.push(nodeToBlock(node, editor.pmSchema));
        return false;
      });
    }
    return Editor.create({
      ...opts?.editorOptions,
      _tiptapOptions: {
        ...opts?.editorOptions?._tiptapOptions,
        extensions: [
          ...(opts?.editorOptions?._tiptapOptions?.extensions ?? []),
          sync.extension,
        ],
      },
      initialContent: blocks.length > 0 ? blocks : undefined,
    });
  }, [sync.initialContent]);

  if (sync.isLoading) {
    return {
      editor: null,
      isLoading: true,
      /**
       * Create the document without waiting to hear from the server.
       * Warning: Only call this if you just created the document id.
       * It's safer to wait until loading is false.
       * It's also best practice to pass in the same initial content everywhere,
       * so if two clients create the same document id, they'll both end up
       * with the same initial content. Otherwise the second client will
       * throw an exception on the snapshot creation.
       */
      create: sync.create,
    } as const;
  }
  if (!editor) {
    return {
      editor: null,
      isLoading: false,
      create: sync.create!,
    } as const;
  }
  return {
    editor,
    isLoading: false,
  } as const;
}
