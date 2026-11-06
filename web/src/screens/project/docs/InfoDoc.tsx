import { useId, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  SCRIPT_PARTS,
  type Project,
  type Script,
  type ScriptPart,
} from "@/data/model";
import { combineStatus, useAutosave } from "@/screens/shared/useAutosave";

import { useProjectData } from "../ProjectContext";
import { DocHead, FieldCard } from "./DocHead";
import { Field } from "./Field";
import { scriptFacts } from "./scriptFacts";

/**
 * «История»: title and tagline of the story, shared by its drafts, and the parts and facts of the
 * open draft, which its lock closes.
 */
export function InfoDoc() {
  const { project, draft, script, text } = useProjectData();
  const story = useAutosave<Project>("projects", project.id);
  const parts = useAutosave<Script>("scripts", script.id);
  const [title, setTitle] = useState(project.title);
  const [desc, setDesc] = useState(project.desc);
  const [show, setShow] = useState(script.show);
  const id = useId();
  const facts = scriptFacts(text);
  return (
    <>
      <DocHead
        title="История"
        status={combineStatus(story.status, parts.status)}
      />
      <div className="mx-auto grid max-w-[900px] gap-5">
        <FieldCard>
          <Field
            label="Название истории"
            value={title}
            onChange={(v) => {
              setTitle(v);
              // An empty title is not saved: the shelf and the navigator always need a name.
              if (v.trim() !== "") story.save({ title: v.trim() });
            }}
          />
          <Field
            label="Тэглайн"
            value={desc}
            hint="Одна фраза об истории, как на афише. Её видно на полке."
            onChange={(v) => {
              setDesc(v);
              story.save({ desc: v });
            }}
          />
          <fieldset disabled={draft.locked} className="grid gap-2">
            <legend className="mb-1.5 text-caption text-muted-foreground">
              Части сценария в навигаторе
            </legend>
            {(Object.keys(SCRIPT_PARTS) as ScriptPart[]).map((part) => (
              <div key={part} className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-${part}`}
                  checked={show[part]}
                  onCheckedChange={(checked) => {
                    const next = { ...show, [part]: checked === true };
                    setShow(next);
                    parts.save({ show: next });
                  }}
                />
                <Label htmlFor={`${id}-${part}`} className="font-normal">
                  {SCRIPT_PARTS[part]}
                </Label>
              </div>
            ))}
          </fieldset>
          <p className="text-caption text-muted-foreground">
            {facts.scenes} сцен · ≈ {facts.duration}
          </p>
        </FieldCard>
      </div>
    </>
  );
}
