// Sample data of the source `fixtures`. demo.json is shared with `./scripts/dev.sh seed`, which also
// reads its top-level `points`; the store of this source starts without points.
import type {
  Character,
  CommentMessage,
  CommentThread,
  Draft,
  Location,
  Note,
  Project,
  Script,
  Suggestion,
  World,
} from "./model";

import demo from "./demo.json";

/** A message as the sample keeps it: whose it is follows from the signed-in e-mail. */
export type FixtureMessage = Omit<CommentMessage, "own"> & { email: string };
export type FixtureThread = Omit<CommentThread, "own" | "replies"> & {
  email: string;
  replies: FixtureMessage[];
};

export const FIXTURES = demo as unknown as {
  projects: Omit<Project, "draftsCount" | "openDraftId">[];
  scripts: Script[];
  characters: Character[];
  locations: Location[];
  worlds: World[];
  notes: Note[];
  comments: FixtureThread[];
  suggestions: Suggestion[];
  drafts: Draft[];
};
