// Public entry of the design system: screens import from here, not from internal files.
export { AiLabel, type AiSource } from "./components/AiLabel";
export { Paper } from "./components/Paper";
export { StatusBadge } from "./components/StatusBadge";
export { ThemeSwitcher } from "./components/ThemeSwitcher";
export {
  DOCUMENT_STATUSES,
  documentStatus,
  type DocumentStatus,
} from "./statuses";
export { THEMES, applyTheme, currentTheme, type Theme } from "./theme";
