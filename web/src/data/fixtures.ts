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
// Every comment of the samples is written by a person: the co-author comments only through the core.
export type FixtureMessage = Omit<CommentMessage, "own" | "kind"> & {
  email: string;
};
export type FixtureThread = Omit<CommentThread, "own" | "replies"> & {
  email: string;
  replies: FixtureMessage[];
};

export const FIXTURES = demo as unknown as {
  projects: Omit<
    Project,
    "draftsCount" | "openDraftId" | "role" | "ownerName"
  >[];
  // The sample has no core: a script's document id is given when the store is filled.
  scripts: Omit<Script, "documentId">[];
  characters: Character[];
  locations: Location[];
  worlds: World[];
  /** Sample notes have no originals: files need the core. */
  notes: Omit<Note, "file">[];
  comments: FixtureThread[];
  // Suggestions of the sample are the co-author's: who suggests is given when the store is filled.
  suggestions: Omit<Suggestion, "authorKind" | "authorName">[];
  drafts: Draft[];
};

/**
 * Words written by day for the source `fixtures` (openspec/specs/api/writing): 30 days, the last
 * one is today, null is a day without saves. The words of a screenplay are a sample too: the
 * frontend does not count words (design of writing-goals, decision 8).
 */
export const WRITING_SAMPLE = {
  dailyGoal: 500,
  days: [
    420,
    610,
    null,
    380,
    0,
    520,
    700,
    null,
    null,
    450,
    530,
    300,
    -120,
    640,
    510,
    null,
    280,
    560,
    600,
    350,
    null,
    480,
    720,
    260,
    505,
    null,
    390,
    610,
    440,
    340,
  ] as (number | null)[],
  storyWords: 9640,
};
