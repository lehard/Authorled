// Theme state lives in data-theme on <html>; index.html sets it before first paint.
export const THEMES = ["light", "sepia", "dark"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "authorled.theme";

function isTheme(value: string | undefined): value is Theme {
  return THEMES.includes(value as Theme);
}

export function currentTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  if (!isTheme(value)) {
    throw new Error(
      `data-theme on <html> is not a known theme: ${String(value)}`,
    );
  }
  return value;
}

export function applyTheme(theme: Theme): void {
  window.localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.dataset.theme = theme;
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Applies the theme of the account (openspec/specs/web/design-system, «Темы») and keeps the
 * browser copy for the first paint; null follows the system, so the copy is removed.
 */
export function applyAccountTheme(theme: Theme | null): void {
  if (theme === null) {
    window.localStorage.removeItem(STORAGE_KEY);
    document.documentElement.dataset.theme = systemTheme();
  } else {
    applyTheme(theme);
  }
}
