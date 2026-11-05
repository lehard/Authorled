import { Navigate, useLocation, useParams } from "react-router";

import { useProject } from "@/data/hooks";
import { DataErrorScreen } from "@/screens/system/DataErrorScreen";
import { MessageScreen } from "@/screens/system/MessageScreen";
import { NotFoundScreen } from "@/screens/system/NotFoundScreen";

/**
 * `/p/:projectId` and `/p/:projectId/:doc` lead to the same document of the draft this story opens
 * in (openspec/specs/web/workspace, «Адреса экранов»).
 */
export function OpenDraft() {
  const { projectId, doc } = useParams();
  if (projectId === undefined)
    throw new Error("Маршрут истории без :projectId.");
  const { search } = useLocation();
  const { project, query } = useProject(projectId);
  if (query.isError) {
    if (query.error.statusCode === 404) return <NotFoundScreen />;
    return (
      <DataErrorScreen
        title="История не загрузилась"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  // A cached answer may name an older draft: wait for the fresh one.
  if (project?.id !== projectId || query.isFetching)
    return <MessageScreen loading title="Открываем историю…" />;
  if (project.deletedAt !== null) return <NotFoundScreen />;
  return (
    <Navigate
      replace
      to={`/p/${projectId}/d/${project.openDraftId}/${doc ?? "text"}${search}`}
    />
  );
}
