import { useCustom, useCustomMutation, useInvalidate } from "@refinedev/core";
import { useEffect, useState } from "react";

import type { Invitation, Member, ReadLink, StoryRole } from "./model";

// Participants of a story, invitations, the link «почитать» and presence
// (openspec/specs/api/story-sharing) through the `custom` operations of the data source. The core
// decides what each role may do; the screens only hide what it would refuse.

export type SharingOperation =
  | { operation: "members"; payload: { projectId: string } }
  | {
      operation: "invite";
      payload: { projectId: string; email: string; role: StoryRole };
    }
  | { operation: "revokeInvitation"; payload: { id: string } }
  | {
      operation: "setMemberRole";
      payload: { projectId: string; userId: string; role: StoryRole };
    }
  | {
      operation: "removeMember";
      payload: { projectId: string; userId: string };
    }
  | { operation: "readLink"; payload: { draftId: string } }
  | { operation: "createReadLink"; payload: { draftId: string } }
  | { operation: "removeReadLink"; payload: { draftId: string } }
  | { operation: "presence"; payload: { draftId: string } };

export type Members = { members: Member[]; invitations: Invitation[] };

const quiet = { successNotification: false, errorNotification: false } as const;

/** Participants of a story; read while `enabled` (the window «Поделиться» is open). */
export function useMembers(projectId: string, enabled: boolean) {
  const { query } = useCustom<Members>({
    url: "members",
    method: "get",
    config: { payload: { projectId } },
    meta: { operation: "members" },
    queryOptions: { enabled, retry: false },
    ...quiet,
  });
  // Before the answer `result.data` is an empty object, not the members: read the answer itself.
  return {
    members: query.data?.data,
    error: query.error,
    reload: () => query.refetch(),
  };
}

/** The link «почитать» of a draft, null when it has none. */
export function useReadLink(draftId: string, enabled: boolean) {
  const { query } = useCustom<{ link: ReadLink | null }>({
    url: "readLink",
    method: "get",
    config: { payload: { draftId } },
    meta: { operation: "readLink" },
    queryOptions: { enabled, retry: false },
    ...quiet,
  });
  return {
    link: query.data?.data.link,
    error: query.error,
    reload: () => query.refetch(),
  };
}

export function useSharingActions() {
  const { mutateAsync } = useCustomMutation();
  const invalidate = useInvalidate();
  const run = async (op: SharingOperation): Promise<unknown> =>
    (
      await mutateAsync({
        url: op.operation,
        method: "post",
        values: op.payload,
        meta: { operation: op.operation },
        ...quiet,
      })
    ).data;
  return {
    invite: (projectId: string, email: string, role: StoryRole) =>
      run({ operation: "invite", payload: { projectId, email, role } }),
    revoke: (id: string) =>
      run({ operation: "revokeInvitation", payload: { id } }),
    setRole: (projectId: string, userId: string, role: StoryRole) =>
      run({ operation: "setMemberRole", payload: { projectId, userId, role } }),
    remove: (projectId: string, userId: string) =>
      run({ operation: "removeMember", payload: { projectId, userId } }),
    /** Leaving a story: it goes from the shelf. */
    async leave(projectId: string, userId: string) {
      await run({ operation: "removeMember", payload: { projectId, userId } });
      await invalidate({ resource: "projects", invalidates: ["list"] });
    },
    /** Leaving a story from the shelf, where the participant is known by the e-mail of the account. */
    async leaveAs(projectId: string, email: string) {
      const found = (
        (await run({ operation: "members", payload: { projectId } })) as Members
      ).members.find((m) => m.email === email);
      if (found === undefined)
        throw new Error("Вас нет среди участников этой истории.");
      await run({
        operation: "removeMember",
        payload: { projectId, userId: found.userId },
      });
      await invalidate({ resource: "projects", invalidates: ["list"] });
    },
    createLink: (draftId: string) =>
      run({
        operation: "createReadLink",
        payload: { draftId },
      }) as Promise<ReadLink>,
    removeLink: (draftId: string) =>
      run({ operation: "removeReadLink", payload: { draftId } }),
  };
}

/** How often a screen with the text open for editing marks itself (web/workspace, «Сейчас правит»). */
export const PRESENCE_MS = 20_000;

/**
 * Names of the other participants editing the screenplay of the draft now, and why the last mark
 * failed. While `editing`, the screen marks itself every 20 seconds in a visible tab; a hidden tab
 * or a closed text stops it. A failed mark is shown, it never stops the editing.
 */
export function usePresence(
  draftId: string,
  editing: boolean,
): { others: string[]; error: string | null } {
  const { mutateAsync } = useCustomMutation();
  const [others, setOthers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!editing) return;
    let stopped = false;
    const mark = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const answer = await mutateAsync({
          url: "presence",
          method: "post",
          values: { draftId },
          meta: { operation: "presence" },
          ...quiet,
        });
        if (stopped) return;
        setOthers((answer.data as { editing: string[] }).editing);
        setError(null);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      }
    };
    const tick = () => void mark();
    tick();
    const timer = window.setInterval(tick, PRESENCE_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [draftId, editing, mutateAsync]);
  // A closed text shows no warning, whatever the last mark said.
  return editing ? { others, error } : { others: [], error: null };
}
