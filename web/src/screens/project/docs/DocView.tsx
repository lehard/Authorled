import { useProjectData } from "../ProjectContext";
import { BinDoc } from "./BinDoc";
import { EntityDoc } from "./EntityDoc";
import { GroupDoc } from "./GroupDoc";
import { InfoDoc } from "./InfoDoc";
import { LockBanner } from "./LockBanner";
import { ScriptDoc } from "./ScriptDoc";
import { SynopsisDoc } from "./SynopsisDoc";
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
      className="min-h-full px-3 pt-16 pb-20 min-[901px]:px-5 min-[1241px]:px-8"
    >
      <LockBanner />
      {doc.kind === "info" && <InfoDoc />}
      {doc.kind === "sp" && <ScriptDoc />}
      {doc.kind === "part" && doc.part === "title" && <TitleDoc />}
      {doc.kind === "part" && doc.part === "synopsis" && <SynopsisDoc />}
      {doc.kind === "part" && doc.part === "treatment" && (
        <TextDoc mode="outline" />
      )}
      {doc.kind === "part" && doc.part === "text" && <TextDoc mode="text" />}
      {doc.kind === "group" && <GroupDoc kind={doc.entity} />}
      {doc.kind === "entity" && <EntityDoc kind={doc.entity} id={doc.id} />}
      {doc.kind === "trash" && <BinDoc />}
    </div>
  );
}
