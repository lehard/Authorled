import {
  useCreate,
  useDelete,
  useGetIdentity,
  useUpdate,
} from "@refinedev/core";
import { useState, type CSSProperties, type RefObject } from "react";

import type { Identity } from "@/auth/authProvider";
import { useComments } from "@/data/hooks";
import type { CommentMessage, CommentThread } from "@/data/model";
import type { CommentAnchor } from "@/editor";
import type {
  EditorComments,
  ScreenplayEditorHandle,
} from "@/editor/ScreenplayEditor";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";

import { CARD, CommentList, ThreadCard } from "./CommentViews";

// Comments on fragments of the screenplay (openspec/specs/web/workspace, «Комментарий к
// фрагменту» … «Список комментариев»; design of screenplay-comments, decisions 5–8).

const quiet = { successNotification: false, errorNotification: false } as const;

/** Beside the page at the height of the fragment, else over the page's right edge, else full width. */
function place(a: CommentAnchor | null): CSSProperties {
  if (a === null)
    return { top: 8, right: 8, width: `min(${CARD}px, calc(100% - 16px))` };
  if (a.width - a.pageRight >= CARD + 16)
    return { top: Math.max(0, a.top - 8), left: a.pageRight + 16, width: CARD };
  if (a.width >= 560)
    return {
      top: a.bottom + 6,
      right: Math.max(8, a.width - a.pageRight + 8),
      width: CARD,
    };
  return { top: a.bottom + 6, left: 8, right: 8 };
}

const now = () => new Date().toISOString();

/**
 * State and actions of the comments of one editor: what the editor highlights, the card of the
 * open thread (`overlay`), the list button (`tools`) and the delete confirmation (`dialog`).
 */
export function useEditorComments(
  projectId: string,
  editor: RefObject<ScreenplayEditorHandle | null>,
) {
  const { threads } = useComments(projectId);
  const { data: me } = useGetIdentity<Identity>();
  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();
  const { mutateAsync: remove } = useDelete();
  const [active, setActive] = useState<string | null>(null);
  // The thread being written: its mark is in the text, its record is not yet.
  const [draft, setDraft] = useState<string | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const [quotes, setQuotes] = useState<ReadonlyMap<string, string>>(new Map());
  const [deleting, setDeleting] = useState<CommentThread | null>(null);
  const [error, setError] = useState<string | null>(null);

  const view = () => {
    if (editor.current === null)
      throw new Error("Редактор сценария ещё не открыт");
    return editor.current;
  };
  const saved = (id: string) => threads.some((t) => t.id === id);
  const unsavedDraft = draft !== null && !saved(draft) ? draft : null;
  const thread = threads.find((t) => t.id === active) ?? null;

  function open(id: string) {
    setError(null);
    setActive(id);
    setStyle(place(view().commentAnchor(id)));
  }

  function close() {
    if (unsavedDraft !== null) {
      view().removeComment(unsavedDraft);
      setDraft(null);
    }
    setActive(null);
  }

  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
  }

  function identity(): Identity {
    if (me === undefined)
      throw new Error("Профиль пользователя ещё не загружен.");
    return me;
  }

  const message = (text: string): CommentMessage => {
    const { name, email } = identity();
    return {
      id: crypto.randomUUID(),
      author: name,
      email,
      role: "",
      at: now(),
      text,
    };
  };

  async function save(text: string) {
    if (unsavedDraft === null)
      throw new Error("Нет нового комментария для сохранения.");
    const thread: CommentThread = {
      ...message(text),
      id: unsavedDraft,
      projectId,
      replies: [],
      resolved: false,
    };
    await create({ resource: "comments", values: thread, ...quiet });
  }

  async function patch(t: CommentThread, values: Partial<CommentThread>) {
    await update({ resource: "comments", id: t.id, values, ...quiet });
  }

  async function purge(t: CommentThread) {
    if (editor.current !== null) editor.current.removeComment(t.id);
    setActive(null);
    await remove({ resource: "comments", id: t.id, ...quiet });
  }

  const editorComments: EditorComments = {
    open: [
      ...threads.filter((t) => !t.resolved).map((t) => t.id),
      ...(unsavedDraft === null ? [] : [unsavedDraft]),
    ],
    active,
    onNew: (id) => {
      if (unsavedDraft !== null) view().removeComment(unsavedDraft);
      setDraft(id);
      open(id);
    },
    onOpen: open,
    onQuotes: setQuotes,
  };

  const run = (p: Promise<void>) => {
    setError(null);
    p.catch(fail);
  };

  const card =
    active === null || (thread === null && active !== unsavedDraft) ? null : (
      <ThreadCard
        key={active}
        style={style}
        thread={thread}
        quote={quotes.get(active)}
        me={me}
        error={error}
        onClose={close}
        onSave={(text) => run(save(text))}
        onReply={(t, text) =>
          run(patch(t, { replies: [...t.replies, message(text)] }))
        }
        onEdit={(t, id, text) =>
          run(
            id === t.id
              ? patch(t, { text })
              : patch(t, {
                  replies: t.replies.map((r) =>
                    r.id === id ? { ...r, text } : r,
                  ),
                }),
          )
        }
        onDeleteReply={(t, id) =>
          run(patch(t, { replies: t.replies.filter((r) => r.id !== id) }))
        }
        onDeleteThread={setDeleting}
        onResolve={(t, resolved) => {
          run(patch(t, { resolved }));
          if (resolved) setActive(null);
        }}
      />
    );

  return {
    comments: editorComments,
    overlay: card,
    tools: (
      <CommentList
        threads={threads}
        quotes={quotes}
        onPick={(id) => {
          if (editor.current !== null) editor.current.scrollToComment(id);
          open(id);
        }}
      />
    ),
    dialog: (
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title="Удалить комментарий?"
        text="Пометка в тексте и вся ветка с ответами удалятся. Текст сценария не изменится."
        actionLabel="Удалить"
        onConfirm={() => {
          if (deleting !== null) run(purge(deleting));
          setDeleting(null);
        }}
      />
    ),
  };
}
