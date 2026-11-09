import { useProjectData } from "../ProjectContext";
import { BinDoc } from "./BinDoc";
import { EntityDoc } from "./EntityDoc";
import { GroupDoc } from "./GroupDoc";
import { InfoDoc } from "./InfoDoc";
import { LockBanner } from "./LockBanner";
import { NoteDoc } from "./NoteDoc";
import { NotesDoc } from "./NotesDoc";
import { ProseDoc } from "./ProseDoc";
import { TextDoc } from "./TextDoc";
import { TitleDoc } from "./TitleDoc";

/** The workspace: the open document on the desk. */
export function DocView() {
  const { doc, docSegment, draft, generation } = useProjectData();
  // key: switching documents or drafts resets local form state and saves pending edits of the
  // previous one; a fresh version after a conflict opens the document anew from the saved data.
  return (
    <div
      data-chat-source
      key={`${draft.id}:${docSegment}:${generation}`}
      // --doc-pad-x: the side padding; --account-reserve: the part of the room of the account menu
      // (--account-space of ProjectScreen) that falls inside it, kept free by DocHead and LockBanner.
      // No top band: on a wide window the head starts level with the account menu.
      className="min-h-full px-(--doc-pad-x) pt-3 pb-20 [--account-reserve:max(0px,calc(var(--account-space)_-_var(--doc-pad-x)))] [--doc-pad-x:--spacing(3)] min-[901px]:pt-0 min-[901px]:[--doc-pad-x:--spacing(5)] min-[1241px]:[--doc-pad-x:--spacing(8)]"
    >
      {/* Notes belong to the story: the lock of the draft does not close them. */}
      {doc.kind !== "notes" && doc.kind !== "note" && <LockBanner />}
      {doc.kind === "info" && <InfoDoc />}
      {doc.kind === "part" && doc.part === "title" && <TitleDoc />}
      {doc.kind === "part" &&
        (doc.part === "logline" || doc.part === "synopsis") && (
          <ProseDoc part={doc.part} />
        )}
      {doc.kind === "part" && doc.part === "treatment" && (
        <TextDoc mode="outline" />
      )}
      {doc.kind === "part" && doc.part === "text" && <TextDoc mode="text" />}
      {doc.kind === "group" && <GroupDoc kind={doc.entity} />}
      {doc.kind === "entity" && <EntityDoc kind={doc.entity} id={doc.id} />}
      {doc.kind === "notes" && <NotesDoc />}
      {doc.kind === "note" && <NoteDoc id={doc.id} />}
      {doc.kind === "trash" && <BinDoc />}
    </div>
  );
}
