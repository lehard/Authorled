import { createContext, useContext } from "react";

import type {
  Character,
  Draft,
  Entity,
  EntityKind,
  Location,
  Project,
  Script,
  World,
} from "@/data/model";

import type { ScreenplayDoc } from "@/editor/document.ts";
import type { SaveStatus } from "@/screens/shared/useAutosave";

import type { DocRef } from "./docRef";

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
  /** Documents of the draft and drafts of the story in the trash. */
  trash: Record<EntityKind, Entity[]> & { draft: Draft[] };
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
   * «Открыть свежую версию» after a conflict: reads the story again and opens the document anew
   * from the saved data; unsaved edits of the window are dropped.
   */
  openFresh: () => void;
  /** Grows with every fresh opening; the open document is remounted by it. */
  generation: number;
};

export const ProjectContext = createContext<ProjectData | null>(null);

export function useProjectData(): ProjectData {
  const data = useContext(ProjectContext);
  if (data === null) throw new Error("useProjectData вне окна истории.");
  return data;
}
