import { createContext, useContext } from "react";

import type {
  Character,
  Entity,
  EntityKind,
  Location,
  Project,
  Script,
  World,
} from "@/data/model";

import type { DocRef } from "./docRef";

/** Everything the window of one story has loaded; documents read it instead of refetching. */
export type ProjectData = {
  project: Project;
  script: Script;
  chars: Character[];
  locs: Location[];
  worlds: World[];
  /** Documents in the story trash, by kind. */
  trash: Record<EntityKind, Entity[]>;
  doc: DocRef;
  docSegment: string;
  /** Scene with the caret in «Текст сценария», for the scene list of the navigator. */
  currentScene: number | null;
  setCurrentScene: (scene: number | null) => void;
};

export const ProjectContext = createContext<ProjectData | null>(null);

export function useProjectData(): ProjectData {
  const data = useContext(ProjectContext);
  if (data === null) throw new Error("useProjectData вне окна истории.");
  return data;
}
