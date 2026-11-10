import { useCustomMutation } from "@refinedev/core";

import type { Note } from "@/data/model";
import type { ScreenplayDoc } from "@/editor/document.ts";

// Files of a story through the `custom` operations of the data source (design of
// story-data-web, decision 7): an upload checked by the core (type, size, antivirus, text), the
// import of a manuscript into the screenplay of a draft and a new story from a manuscript. The `fixtures`
// source refuses them: they need the core.

/** Manuscripts the core imports (openspec/specs/api/story-import). */
export const MANUSCRIPT_TYPES = ".fountain,.fdx,.starc,.docx,.txt";

export type UploadedFile = { id: string; name: string };

export type Upload = {
  projectId: string;
  file: File;
  purpose: "chat" | "import";
  /** The conversation of a chat file. */
  sessionId?: string;
};

export type FileOperation =
  | { operation: "upload"; payload: Upload }
  | { operation: "import"; payload: { draftId: string; fileId: string } }
  | { operation: "createFromFile"; payload: { title: string; file: File } }
  | { operation: "noteFromUpload"; payload: { projectId: string; file: File } }
  | { operation: "noteFromChatFile"; payload: { fileId: string } }
  | { operation: "removeNoteFile"; payload: { noteId: string } }
  | { operation: "noteTextFromFile"; payload: { noteId: string } }
  | { operation: "fileContent"; payload: { fileId: string } };

/** Files that become notes (openspec/specs/api/stories, «Заметка из файла»): the same as chat files. */
export const NOTE_FILE_TYPES = ".docx,.pdf,.txt,.md,.fountain,.fdx,.starc";

/** A new story: its id and the id of «Драфт 1». */
export type NewStory = { id: string; draftId: string };

const quiet = { successNotification: false, errorNotification: false } as const;

export function useStoryFiles() {
  const { mutateAsync } = useCustomMutation();
  const run = async <T>(op: FileOperation): Promise<T> => {
    const { data } = await mutateAsync({
      url: op.operation,
      method: "post",
      values: op.payload,
      meta: { operation: op.operation },
      ...quiet,
    });
    return data as T;
  };
  return {
    upload: (payload: Upload) =>
      run<UploadedFile>({ operation: "upload", payload }),
    /** Replaces the screenplay by the manuscript; returns the new text. */
    importInto: (draftId: string, fileId: string) =>
      run<{ text: ScreenplayDoc }>({
        operation: "import",
        payload: { draftId, fileId },
      }),
    /** A new story from a manuscript. */
    createFromFile: (title: string, file: File) =>
      run<NewStory>({
        operation: "createFromFile",
        payload: { title, file },
      }),
    /** A note of the story from a file, with the file as its original. */
    noteFromUpload: (projectId: string, file: File) =>
      run<Note>({ operation: "noteFromUpload", payload: { projectId, file } }),
    /** A note from a file of a conversation, with a copy of the file. */
    noteFromChatFile: (fileId: string) =>
      run<Note>({ operation: "noteFromChatFile", payload: { fileId } }),
    /** Deletes the original of a note for good; the note keeps its title and text. */
    removeNoteFile: (noteId: string) =>
      run<Note>({ operation: "removeNoteFile", payload: { noteId } }),
    /** Replaces the text of a note with the text read again from its original. */
    noteTextFromFile: (noteId: string) =>
      run<Note>({ operation: "noteTextFromFile", payload: { noteId } }),
    /** The bytes of a stored file. */
    content: (fileId: string) =>
      run<Blob>({ operation: "fileContent", payload: { fileId } }),
  };
}
