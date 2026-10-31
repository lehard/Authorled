import { useList, useOne, type CrudFilter } from "@refinedev/core";

import {
  ENTITY_RESOURCE,
  type CommentThread,
  type Draft,
  type Entity,
  type EntityKind,
  type Project,
  type Script,
  type Suggestion,
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

export function useScript(projectId: string) {
  const { result, query } = useOne<Script>({
    resource: "scripts",
    id: projectId,
  });
  return { script: result, query };
}

export function useEntities<T extends Entity = Entity>(
  kind: EntityKind,
  projectId: string,
  inTrash = false,
) {
  const { result, query } = useList<T>({
    resource: ENTITY_RESOURCE[kind],
    filters: [
      { field: "projectId", operator: "eq", value: projectId },
      deleted(inTrash),
    ],
    pagination: { mode: "off" },
  });
  return { items: result.data, query };
}

/** Comment threads of the story, oldest first. */
export function useComments(projectId: string) {
  const { result, query } = useList<CommentThread>({
    resource: "comments",
    filters: [{ field: "projectId", operator: "eq", value: projectId }],
    sorters: [{ field: "at", order: "asc" }],
    pagination: { mode: "off" },
  });
  return { threads: result.data, query };
}

/** Co-author suggestions of the story. */
export function useSuggestions(projectId: string) {
  const { result, query } = useList<Suggestion>({
    resource: "suggestions",
    filters: [{ field: "projectId", operator: "eq", value: projectId }],
    pagination: { mode: "off" },
  });
  return { suggestions: result.data, query };
}

/** Drafts of the screenplay, oldest first; `inTrash` lists the deleted ones. */
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
