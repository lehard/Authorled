import { useCustomMutation } from "@refinedev/core";

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
  | { operation: "createFromFile"; payload: { title: string; file: File } };

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
  };
}
