import { MoonIcon, ScrollTextIcon, SunIcon } from "lucide-react";
import { useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { applyTheme, currentTheme, type Theme } from "@/design-system/theme";

const OPTIONS: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Светлая", Icon: SunIcon },
  { value: "sepia", label: "Сепия", Icon: ScrollTextIcon },
  { value: "dark", label: "Тёмная", Icon: MoonIcon },
];

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label="Тема оформления"
      value={theme}
      onValueChange={(value) => {
        // Radix sends "" when the pressed item is clicked again; keep the current theme.
        if (value === "") return;
        applyTheme(value as Theme);
        setTheme(value as Theme);
      }}
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label}>
          <Icon aria-hidden />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
