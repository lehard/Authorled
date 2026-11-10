import { useId, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  SCRIPT_PARTS,
  type CoverColor,
  type Project,
  type Script,
  type ScriptPart,
} from "@/data/model";
import { CoverColorPicker } from "@/screens/shared/CoverColorPicker";
import { combineStatus, useAutosave } from "@/screens/shared/useAutosave";

import { useProjectData } from "../ProjectContext";
import { DocHead, FieldCard } from "./DocHead";
import { Field } from "./Field";
import { scriptFacts } from "./scriptFacts";
import { WritingBlock } from "./WritingBlock";

/**
 * «История»: title and tagline of the story, shared by its drafts, the parts and facts of the
 * open draft, which its lock closes, and the block «Письмо» with the writing goals.
 */
export function InfoDoc() {
  const { project, draft, script, text } = useProjectData();
  const story = useAutosave<Project>("projects", project.id);
  const parts = useAutosave<Script>("scripts", script.id);
  const [title, setTitle] = useState(project.title);
  const [desc, setDesc] = useState(project.desc);
  const [show, setShow] = useState(script.show);
  const [chosen, setChosen] = useState<CoverColor | null>(null);
  // A refused save leaves the colour of the core marked (openspec/specs/web/workspace, «Цвет
  // обложки на странице «История»»); otherwise the author's last choice, until the core has it.
  const color =
    typeof story.status === "object" || chosen === null
      ? project.coverColor
      : chosen;
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
          <div className="grid gap-1.5">
            <span
              id={`${id}-cover`}
              className="text-caption text-muted-foreground"
            >
              Цвет обложки
            </span>
            <CoverColorPicker
              value={color}
              storyId={project.id}
              aria-labelledby={`${id}-cover`}
              onChange={(next) => {
                setChosen(next);
                story.save({ coverColor: next });
              }}
            />
          </div>
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
        <WritingBlock draftId={draft.id} project={project} />
      </div>
    </>
  );
}
