import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GrowingTextarea } from "@/design-system";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  area?: boolean;
  rows?: number;
  hint?: string;
};

export function Field({
  label,
  value,
  onChange,
  area = false,
  rows = 4,
  hint,
}: Props) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label
        htmlFor={id}
        className="text-caption font-normal text-muted-foreground"
      >
        {label}
      </Label>
      {area ? (
        <GrowingTextarea
          variant="field"
          minRows={rows}
          limit="none"
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-paper"
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-paper"
        />
      )}
      {hint !== undefined && (
        <p className="text-caption text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
