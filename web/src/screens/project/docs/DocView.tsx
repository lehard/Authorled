import { useProjectData } from "../ProjectContext";
import { BinDoc } from "./BinDoc";
import { CompareDoc } from "./CompareDoc";
import { DraftDoc } from "./DraftDoc";
import { EntityDoc } from "./EntityDoc";
import { GroupDoc } from "./GroupDoc";
import { InfoDoc } from "./InfoDoc";
import { ScriptDoc } from "./ScriptDoc";
import { SynopsisDoc } from "./SynopsisDoc";
import { TextDoc } from "./TextDoc";
import { TitleDoc } from "./TitleDoc";

/** The workspace: the open document on the desk. */
export function DocView() {
  const { doc, docSegment } = useProjectData();
  // key: switching documents resets local form state and saves pending edits of the previous one.
  return (
    <div
      data-chat-source
      key={docSegment}
      className="min-h-full px-3 pt-16 pb-20 min-[901px]:px-5 min-[1241px]:px-8"
    >
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
      {doc.kind === "draft" && <DraftDoc id={doc.id} />}
      {doc.kind === "compare" && <CompareDoc a={doc.a} b={doc.b} />}
      {doc.kind === "trash" && <BinDoc />}
    </div>
  );
}
