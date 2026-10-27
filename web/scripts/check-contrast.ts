// WCAG contrast check of design tokens for every theme (openspec/specs/web/design-system).
// Resolves var() chains in src/design-system/tokens.css the way the cascade applies them to
// <html data-theme="…">, then checks the pairs below. Any failure or unresolved token exits 1.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse as parseColor, wcagContrast } from "culori";
import postcss, { type Rule } from "postcss";

const TOKENS = fileURLToPath(
  new URL("../src/design-system/tokens.css", import.meta.url),
);
const THEMES = ["light", "sepia", "dark"] as const;
const TEXT = 4.5;
const NON_TEXT = 3;

const STATUSES = [
  "not-started",
  "draft",
  "in-progress",
  "ready",
  "approved",
  "stale",
  "conflict",
];
const DECORATIONS = [
  "insert",
  "delete",
  "comment",
  "ai",
  "conflict",
  "mention",
  "stale",
];

// [foreground, background, minimum ratio]
const PAIRS: [string, string, number][] = [
  ["foreground", "background", TEXT],
  ["muted-foreground", "background", TEXT],
  ["muted-foreground", "muted", TEXT],
  ["card-foreground", "card", TEXT],
  ["popover-foreground", "popover", TEXT],
  ["primary-foreground", "primary", TEXT],
  ["secondary-foreground", "secondary", TEXT],
  ["accent-foreground", "accent", TEXT],
  ["destructive", "background", TEXT],
  ["sidebar-foreground", "sidebar", TEXT],
  ["sidebar-primary-foreground", "sidebar-primary", TEXT],
  ["paper-foreground", "paper", TEXT],
  ["paper-foreground", "deco-comment-subtle", TEXT],
  ["ai", "ai-subtle", TEXT],
  ["ai", "paper", TEXT],
  ["input", "background", NON_TEXT],
  ["ring", "background", NON_TEXT],
  ...STATUSES.map((s): [string, string, number] => [
    `status-${s}`,
    `status-${s}-subtle`,
    TEXT,
  ]),
  ...DECORATIONS.map((d): [string, string, number] => [
    `deco-${d}`,
    "paper",
    NON_TEXT,
  ]),
];

function matchesTheme(selector: string, theme: string): boolean {
  const s = selector.trim();
  return (
    s === ":root" || s === "[data-theme]" || s === `[data-theme="${theme}"]`
  );
}

function tokensFor(root: postcss.Root, theme: string): Map<string, string> {
  const tokens = new Map<string, string>();
  root.each((node) => {
    if (node.type !== "rule") return;
    const rule = node as Rule;
    if (!rule.selectors.some((s) => matchesTheme(s, theme))) return;
    rule.walkDecls(/^--/, (decl) => {
      tokens.set(decl.prop, decl.value);
    });
  });
  return tokens;
}

function resolve(
  tokens: Map<string, string>,
  name: string,
  seen: string[] = [],
): string {
  if (seen.includes(name))
    throw new Error(`cycle in var(): ${[...seen, name].join(" -> ")}`);
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`token ${name} is not defined`);
  const ref = /^var\((--[\w-]+)\)$/.exec(value.trim());
  return ref ? resolve(tokens, ref[1], [...seen, name]) : value;
}

function colour(tokens: Map<string, string>, name: string) {
  const value = resolve(tokens, `--${name}`);
  const parsed = parseColor(value);
  if (parsed === undefined)
    throw new Error(`--${name} resolves to "${value}", not a colour`);
  return parsed;
}

let css: string;
try {
  css = readFileSync(TOKENS, "utf8");
} catch {
  console.error(`check-contrast: tokens.css не найден: ${TOKENS}`);
  process.exit(1);
}
const root = postcss.parse(css);

const failures: string[] = [];
for (const theme of THEMES) {
  const tokens = tokensFor(root, theme);
  for (const [fg, bg, min] of PAIRS) {
    const ratio = wcagContrast(colour(tokens, fg), colour(tokens, bg));
    if (ratio < min) {
      failures.push(
        `${theme}: --${fg} on --${bg} = ${ratio.toFixed(2)}:1, needs ${min}:1`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("check-contrast: token pairs below WCAG 2.2 AA:");
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}
console.log(
  `check-contrast: ${PAIRS.length} pairs pass in ${THEMES.join(", ")}`,
);
