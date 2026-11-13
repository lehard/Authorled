import {
  useCreate,
  useDelete,
  useInvalidate,
  useUpdate,
} from "@refinedev/core";
import { useEffect, useState, type RefObject } from "react";

import { useComments } from "@/data/hooks";
import type { CommentThread, NewReply } from "@/data/model";
import type { SuggestionAnchor } from "@/editor/index.ts";
import type {
  EditorComments,
  ScreenplayEditorHandle,
} from "@/editor/ScreenplayEditor";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";

import { useCardPlace } from "./cardPlace";
import { CommentList, ThreadCard } from "./CommentViews";

// Comments on fragments of the screenplay (openspec/specs/web/workspace, «Комментарий к
// фрагменту» … «Список комментариев»; design of screenplay-comments, decisions 5–8). Messages
// change one at a time through resource `comment-replies`; the data source tells whose they are
// (design of story-data-web, decision 4).

const quiet = { successNotification: false, errorNotification: false } as const;

/**
 * State and actions of the comments of one editor: what the editor highlights, the card of the
 * open thread (`overlay`), the list button (`tools`) and the delete confirmation (`dialog`).
 */
export function useEditorComments(
  draftId: string,
  editor: RefObject<ScreenplayEditorHandle | null>,
  /** A thread card opens: another card of the editor closes. */
  onOpened: () => void,
  /** A locked draft or a reader: threads are only read. */
  readOnly: boolean,
  /** The owner or a co-author: threads are resolved and reopened (web/workspace, «Экран истории по роли»). */
  manage: boolean,
  /**
   * Anchored threads get their marks: not in a locked draft. A reviewer's window keeps them on the
   * screen only, it does not save the text.
   */
  placeMarks: boolean,
) {
  const { threads } = useComments(draftId);
  const invalidate = useInvalidate();
  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();
  const { mutateAsync: remove } = useDelete();
  const [active, setActive] = useState<string | null>(null);
  // The thread being written: its mark is in the text, its record is not yet.
  const [draft, setDraft] = useState<string | null>(null);
  const spot = useCardPlace(editor);
  const [quotes, setQuotes] = useState<ReadonlyMap<string, string>>(new Map());
  const [deleting, setDeleting] = useState<CommentThread | null>(null);
  const [error, setError] = useState<string | null>(null);

  const view = () => {
    if (editor.current === null)
      throw new Error("Редактор сценария ещё не открыт");
    return editor.current;
  };
  // Open threads of the co-author without a mark get one by their anchor after the text opens and
  // after every change of the list (web/workspace, «Комментарий соавтора по якорю»); a thread
  // whose words are gone stays without a place, and the list says so.
  const anchors = JSON.stringify(
    threads
      .filter((t) => !t.resolved && t.sceneUid !== null && !quotes.has(t.id))
      .map((t) => ({ id: t.id, sceneUid: t.sceneUid, quote: t.quote })),
  );
  useEffect(() => {
    if (!placeMarks) return;
    if (editor.current === null)
      throw new Error("Редактор сценария ещё не открыт");
    editor.current.placeComments(JSON.parse(anchors) as SuggestionAnchor[]);
  }, [editor, anchors, placeMarks]);

  // A closed card gives its gap back to the text, whichever way it closed.
  useEffect(() => {
    if (active === null) spot.release();
  });

  const saved = (id: string) => threads.some((t) => t.id === id);
  const unsavedDraft = draft !== null && !saved(draft) ? draft : null;
  const thread = threads.find((t) => t.id === active) ?? null;

  function open(id: string) {
    onOpened();
    setError(null);
    setActive(id);
    spot.place(id, view().commentAnchor(id));
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

  async function save(text: string) {
    if (unsavedDraft === null)
      throw new Error("Нет нового комментария для сохранения.");
    const quote = quotes.get(unsavedDraft);
    if (quote === undefined)
      throw new Error("Пометки нового комментария нет в тексте.");
    await create({
      resource: "comments",
      values: { id: unsavedDraft, draftId, quote, text },
      ...quiet,
    });
  }

  async function resolve(t: CommentThread, resolved: boolean) {
    await update({
      resource: "comments",
      id: t.id,
      values: { resolved },
      ...quiet,
    });
  }

  // A message of the thread; the first one has the id of the thread.
  const replies = async (change: Promise<unknown>) => {
    await change;
    await invalidate({ resource: "comments", invalidates: ["list"] });
  };
  const meta = (t: CommentThread) => ({ threadId: t.id });

  async function reply(t: CommentThread, text: string) {
    const values: NewReply = { text };
    await replies(
      create({ resource: "comment-replies", values, meta: meta(t), ...quiet }),
    );
  }

  async function edit(t: CommentThread, id: string, text: string) {
    await replies(
      update({
        resource: "comment-replies",
        id,
        values: { text },
        meta: meta(t),
        ...quiet,
      }),
    );
  }

  async function deleteMessage(t: CommentThread, id: string) {
    await replies(
      remove({ resource: "comment-replies", id, meta: meta(t), ...quiet }),
    );
  }

  /** Deleting the first message deletes the thread, as in the core. */
  async function purge(t: CommentThread) {
    if (editor.current !== null) editor.current.removeComment(t.id);
    setActive(null);
    await deleteMessage(t, t.id);
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
        style={spot.style}
        onHeight={spot.fit}
        thread={thread}
        readOnly={readOnly}
        manage={manage}
        quote={quotes.get(active)}
        error={error}
        onClose={close}
        onSave={(text) => run(save(text))}
        onReply={(t, text) => run(reply(t, text))}
        onEdit={(t, id, text) => run(edit(t, id, text))}
        onDeleteReply={(t, id) => run(deleteMessage(t, id))}
        onDeleteThread={setDeleting}
        onResolve={(t, resolved) => {
          run(resolve(t, resolved));
          if (resolved) setActive(null);
        }}
      />
    );

  return {
    close,
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
