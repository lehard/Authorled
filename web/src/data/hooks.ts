import { useList, useOne, type CrudFilter } from "@refinedev/core";

import {
  ENTITY_RESOURCE,
  type CommentThread,
  type Draft,
  type Entity,
  type EntityKind,
  type Note,
  type Point,
  type Project,
  type Script,
  type Suggestion,
  type Version,
  type VersionContent,
  type VersionTarget,
} from "./model";

// Queries of the workspace. Screens read data only through these and Refine mutations.

const deleted = (inTrash: boolean): CrudFilter => ({
  field: "deletedAt",
  operator: inTrash ? "nnull" : "null",
  value: null,
});

export function useProjects(inTrash: boolean) {
  const { result, query } = useList<Project>({
    resource: "projects",
    filters: [deleted(inTrash)],
    sorters: [{ field: inTrash ? "deletedAt" : "updatedAt", order: "desc" }],
    pagination: { mode: "off" },
  });
  return { projects: result.data, query };
}

export function useProject(id: string) {
  const { result, query } = useOne<Project>({ resource: "projects", id });
  return { project: result, query };
}

export function useScript(draftId: string) {
  const { result, query } = useOne<Script>({
    resource: "scripts",
    id: draftId,
  });
  return { script: result, query };
}

export function useEntities<T extends Entity = Entity>(
  kind: EntityKind,
  draftId: string,
  inTrash = false,
) {
  const { result, query } = useList<T>({
    resource: ENTITY_RESOURCE[kind],
    filters: [
      { field: "draftId", operator: "eq", value: draftId },
      deleted(inTrash),
    ],
    pagination: { mode: "off" },
  });
  return { items: result.data, query };
}

/** Notes of a story, oldest first; `inTrash` lists the deleted ones. */
export function useNotes(projectId: string, inTrash = false) {
  const { result, query } = useList<Note>({
    resource: "notes",
    filters: [
      { field: "projectId", operator: "eq", value: projectId },
      deleted(inTrash),
    ],
    pagination: { mode: "off" },
  });
  return { notes: result.data, query };
}

/** Comment threads of a draft, oldest first. */
export function useComments(draftId: string) {
  const { result, query } = useList<CommentThread>({
    resource: "comments",
    filters: [{ field: "draftId", operator: "eq", value: draftId }],
    sorters: [{ field: "at", order: "asc" }],
    pagination: { mode: "off" },
  });
  return { threads: result.data, query };
}

/** Co-author suggestions of a draft. */
export function useSuggestions(draftId: string) {
  const { result, query } = useList<Suggestion>({
    resource: "suggestions",
    filters: [{ field: "draftId", operator: "eq", value: draftId }],
    pagination: { mode: "off" },
  });
  return { suggestions: result.data, query };
}

/** Drafts of a story, oldest first; `inTrash` lists the deleted ones. */
export function useDrafts(projectId: string, inTrash = false) {
  const { result, query } = useList<Draft>({
    resource: "drafts",
    filters: [
      { field: "projectId", operator: "eq", value: projectId },
      deleted(inTrash),
    ],
    sorters: [{ field: "createdAt", order: "asc" }],
    pagination: { mode: "off" },
  });
  return { drafts: result.data, query };
}

/** Snapshots of a part of a document, newest first. */
export function useVersions(target: VersionTarget) {
  const { result, query } = useList<Version>({
    resource: "versions",
    filters: Object.entries(target).map(([field, value]) => ({
      field,
      operator: "eq",
      value,
    })),
    pagination: { mode: "off" },
  });
  return { versions: result.data, query };
}

/** One snapshot with its content; nothing is read until a snapshot is chosen. */
export function useVersion(id: string | null) {
  const { result, query } = useOne<VersionContent>({
    resource: "versions",
    id: id ?? undefined,
    queryOptions: { enabled: id !== null },
  });
  return { version: result, query };
}

/** Points of a draft, newest first. */
export function usePoints(draftId: string) {
  const { result, query } = useList<Point>({
    resource: "points",
    filters: [{ field: "draftId", operator: "eq", value: draftId }],
    pagination: { mode: "off" },
  });
  return { points: result.data, query };
}
