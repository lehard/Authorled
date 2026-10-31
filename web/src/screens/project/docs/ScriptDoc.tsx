import { useId, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SCRIPT_PARTS, type Script, type ScriptPart } from "@/data/model";
import { useAutosave } from "@/screens/shared/useAutosave";

import { useProjectData } from "../ProjectContext";
import { DocHead, FieldCard } from "./DocHead";
import { Field } from "./Field";
import { scriptFacts } from "./scriptFacts";

/** «Сценарий»: name, tagline, logline and which parts the navigator shows. */
export function ScriptDoc() {
  const { script, text } = useProjectData();
  const { save, status } = useAutosave<Script>("scripts", script.id);
  const [form, setForm] = useState({
    name: script.name,
    tagline: script.tagline,
    logline: script.logline,
    show: script.show,
  });
  const id = useId();
  const facts = scriptFacts(text);

  // An empty name stays on screen but is not saved: the navigator always needs a name.
  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key !== "name" || String(value).trim() !== "") save({ [key]: value });
  }

  return (
    <>
      <DocHead title="Сценарий" status={status} />
      <div className="mx-auto grid max-w-[720px] gap-5">
        <FieldCard>
          <Field
            label="Название сценария"
            value={form.name}
            onChange={(v) => set("name", v)}
          />
          <Field
            label="Тэглайн"
            value={form.tagline}
            onChange={(v) => set("tagline", v)}
          />
          <Field
            label="Логлайн"
            value={form.logline}
            area
            rows={3}
            onChange={(v) => set("logline", v)}
          />
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-caption text-muted-foreground">
              Части сценария в навигаторе
            </legend>
            {(Object.keys(SCRIPT_PARTS) as ScriptPart[]).map((part) => (
              <div key={part} className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-${part}`}
                  checked={form.show[part]}
                  onCheckedChange={(checked) =>
                    set("show", { ...form.show, [part]: checked === true })
                  }
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
