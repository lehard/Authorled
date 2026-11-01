import { useState } from "react";

import type { Project } from "@/data/model";
import { useAutosave } from "@/screens/shared/useAutosave";

import { useProjectData } from "../ProjectContext";
import { DocHead, FieldCard } from "./DocHead";
import { Field } from "./Field";

/** «История»: title and short description. */
export function InfoDoc() {
  const { project } = useProjectData();
  const { save, status } = useAutosave<Project>("projects", project.id);
  const [title, setTitle] = useState(project.title);
  const [desc, setDesc] = useState(project.desc);
  return (
    <>
      <DocHead title="История" status={status} />
      <div className="mx-auto grid max-w-[900px] gap-5">
        <FieldCard>
          <Field
            label="Название истории"
            value={title}
            onChange={(v) => {
              setTitle(v);
              // An empty title is not saved: the shelf and the navigator always need a name.
              if (v.trim() !== "") save({ title: v.trim() });
            }}
          />
          <Field
            label="Короткое описание"
            value={desc}
            hint="Тэглайн, логлайн или пара слов о том, про что история."
            onChange={(v) => {
              setDesc(v);
              save({ desc: v });
            }}
          />
        </FieldCard>
      </div>
    </>
  );
}
