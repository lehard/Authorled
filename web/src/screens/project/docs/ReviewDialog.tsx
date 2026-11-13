import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { GrowingTextarea } from "@/design-system";

/** What a reviewer leaves on the words they selected. */
export type ReviewKind = "comment" | "suggestion";

export type ReviewDraft = { kind: ReviewKind; quote: string };

/**
 * A comment or a suggested edit of a reviewer on the selected words
 * (openspec/specs/web/workspace, «Комментарий и предложение рецензента»). The reviewer cannot
 * change the text: the record is anchored by the scene and the words, and the screen of the owner
 * or a co-author puts its mark in the text.
 */
export function ReviewDialog({
  review,
  onClose,
  onSubmit,
}: {
  review: ReviewDraft | null;
  onClose: () => void;
  /** A refusal is shown in the dialog. */
  onSubmit: (text: string, why: string) => Promise<void>;
}) {
  return (
    <Dialog
      open={review !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="rounded-panel bg-paper shadow-paper sm:max-w-md">
        {review !== null && (
          <ReviewForm review={review} onClose={onClose} onSubmit={onSubmit} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewForm({
  review,
  onClose,
  onSubmit,
}: {
  review: ReviewDraft;
  onClose: () => void;
  onSubmit: (text: string, why: string) => Promise<void>;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [why, setWhy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const suggestion = review.kind === "suggestion";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim() === "") {
      setError(
        suggestion ? "Напишите, на что заменить." : "Напишите комментарий.",
      );
      return;
    }
    setBusy(true);
    try {
      await onSubmit(text.trim(), why.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="text-heading-2">
          {suggestion ? "Предложить правку" : "Комментарий"}
        </DialogTitle>
        <DialogDescription>«{review.quote}»</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-text`}>
          {suggestion ? "Новый текст" : "Комментарий"}
        </Label>
        <GrowingTextarea
          id={`${id}-text`}
          variant="field"
          minRows={2}
          limit={{ screen: 1 / 3 }}
          autoFocus
          value={text}
          aria-invalid={error !== null}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
        />
      </div>
      {suggestion && (
        <div className="grid gap-2">
          <Label htmlFor={`${id}-why`}>Зачем</Label>
          <GrowingTextarea
            id={`${id}-why`}
            variant="field"
            minRows={1}
            limit={{ screen: 1 / 4 }}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
          />
        </div>
      )}
      {error !== null && (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" disabled={busy}>
          {suggestion ? "Предложить" : "Оставить"}
        </Button>
      </DialogFooter>
    </form>
  );
}
