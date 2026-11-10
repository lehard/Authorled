import {
  Clapperboard,
  FileText,
  FileType,
  type LucideIcon,
  ScrollText,
  StickyNote,
} from "lucide-react";

import type { NoteFile } from "@/data/model";

/**
 * The kind of the original of a note by the extension of its name (design of note-originals-view,
 * decision 7): the formats of NOTE_FILE_TYPES, the only ones the core takes into notes.
 */
export type NoteFileKind = "pdf" | "docx" | "md" | "txt" | "script";

const KINDS: Record<string, NoteFileKind> = {
  pdf: "pdf",
  docx: "docx",
  md: "md",
  txt: "txt",
  fountain: "script",
  fdx: "script",
  starc: "script",
};

export function noteFileKind(file: NoteFile): NoteFileKind {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const kind = KINDS[extension];
  if (kind === undefined)
    throw new Error(`Оригинал заметки «${file.name}» неизвестного вида.`);
  return kind;
}

/** Originals shown as they are on the tab «Оригинал»; the others show the text for the co-author only. */
export function hasOriginalView(file: NoteFile): boolean {
  const kind = noteFileKind(file);
  return kind === "pdf" || kind === "docx" || kind === "md";
}

const ICONS: Record<NoteFileKind, LucideIcon> = {
  pdf: FileText,
  docx: FileType,
  md: ScrollText,
  txt: ScrollText,
  script: Clapperboard,
};

/** The icon of a note in the navigator and the list: the kind of its original, or a note of the author's own. */
export function noteIcon(file: NoteFile | null): LucideIcon {
  return file === null ? StickyNote : ICONS[noteFileKind(file)];
}

/** The size of a file for the author: «233 КБ», «1,5 МБ». */
export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`;
}

/** Saves the bytes of a file under its own name. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
