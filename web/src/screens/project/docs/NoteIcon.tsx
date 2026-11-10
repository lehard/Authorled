import {
  Clapperboard,
  FileText,
  FileType,
  ScrollText,
  StickyNote,
} from "lucide-react";

import type { NoteFile } from "@/data/model";

import { noteFileKind } from "./noteFile";

/** The icon of a note by the kind of its original (the same as noteIcon, for JSX). */
export function NoteIcon({
  file,
  className,
}: {
  file: NoteFile | null;
  className?: string;
}) {
  if (file === null) return <StickyNote className={className} />;
  switch (noteFileKind(file)) {
    case "pdf":
      return <FileText className={className} />;
    case "docx":
      return <FileType className={className} />;
    case "md":
    case "txt":
      return <ScrollText className={className} />;
    case "script":
      return <Clapperboard className={className} />;
  }
}
