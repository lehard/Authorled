import { createContext, useContext } from "react";

import type {
  Character,
  Draft,
  Entity,
  EntityKind,
  Location,
  Note,
  Project,
  Script,
  World,
} from "@/data/model";

import type { ScreenplayDoc } from "@/editor/document.ts";
import type { SaveStatus } from "@/screens/shared/useAutosave";

import type { DocRef } from "./docRef";

/** A request to the co-author from a document, waiting for the chat to send it. */
export type CoauthorRequest = { id: string; text: string };

/** Everything the window of one story has loaded; documents read it instead of refetching. */
export type ProjectData = {
  project: Project;
  /** The open draft: everything else here belongs to it. */
  draft: Draft;
  script: Script;
  chars: Character[];
  locs: Location[];
  worlds: World[];
  /** Drafts of the story outside the trash, oldest first. */
  drafts: Draft[];
  /** Notes of the story outside the trash, the same in every draft. */
  notes: Note[];
  /** Documents of the draft, drafts and notes of the story in the trash. */
  trash: Record<EntityKind, Entity[]> & { draft: Draft[]; note: Note[] };
  doc: DocRef;
  docSegment: string;
  /**
   * The working copy of the screenplay text: the editor, the cards and the navigator read and
   * change it; it is saved with a delay (scene-outline-and-cards, decision 1).
   */
  text: ScreenplayDoc;
  setText: (text: ScreenplayDoc) => void;
  textStatus: SaveStatus;
  /** Scene with the caret in «Текст сценария», for the scene list of the navigator. */
  currentScene: number | null;
  setCurrentScene: (scene: number | null) => void;
  /** Shows the chat where it is hidden (narrow screens); on wide screens it is always shown. */
  openChat: () => void;
  /**
   * Sends `text` to the co-author in the current conversation, as if the author typed it, and
   * opens the chat (web/workspace, «Проверки над выделением»). Throws while `coauthorBusy`: the
   * screens do not offer it then.
   */
  askCoauthor: (text: string) => void;
  /** The co-author is answering, or the chat cannot send yet: no request goes now. */
  coauthorBusy: boolean;
  /**
   * «Открыть свежую версию» after a conflict: reads the story again and opens the document anew
   * from the saved data; unsaved edits of the window are dropped.
   */
  openFresh: () => void;
  /** Grows with every fresh opening; the open document is remounted by it. */
  generation: number;
  /**
   * What the field «Поиск по истории» holds: it outlives the navigator, which a narrow screen
   * closes after every jump (web/workspace, «Переход к совпадению из поиска по истории»).
   */
  searchText: string;
  setSearchText: (text: string) => void;
  /** ⌘K asked for the field: it takes the caret, even if the navigator opens only now. */
  searchFocusAsked: boolean;
  /** The field took the caret: the next opening of the navigator does not take it again. */
  searchFocusTaken: () => void;
};

export const ProjectContext = createContext<ProjectData | null>(null);

export function useProjectData(): ProjectData {
  const data = useContext(ProjectContext);
  if (data === null) throw new Error("useProjectData вне окна истории.");
  return data;
}
