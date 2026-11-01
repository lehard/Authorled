// Native UI check for web/src (openspec/specs/web/design-system, «Без системных подсказок и
// полей выбора»): HTML elements must not carry `title` (a native tooltip), and native
// checkboxes, radio buttons and <select> are replaced by design-system components.
// shadcn components in src/components/ui are generated code and are skipped.
// «Без системного вида»: the design system keeps one autofill rule outside any CSS layer that
// sets the text colour and puts off the browser's background, so no field state brings it back.
//
// Usage: npm run check:native-ui --prefix web

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..", "src");
const SKIP = path.join(SRC, "components", "ui");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return full === SKIP ? [] : files(full);
    return e.name.endsWith(".tsx") ? [full] : [];
  });
}

/** End of the opening tag that starts at `start` ("<"), skipping {…} expressions and strings. */
function tagEnd(text: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (quote !== null) {
      if (c === quote && text[i - 1] !== "\\") quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i;
  }
  throw new Error(`check-native-ui: unterminated tag at offset ${start}`);
}

// Top-level attribute text of a tag: {…} expressions are blanked, so `title` inside them
// (props of nested components, strings) does not count.
function topLevel(attrs: string): string {
  let out = "";
  let depth = 0;
  for (const c of attrs) {
    if (c === "{") depth++;
    if (depth === 0) out += c;
    else out += " ";
    if (c === "}") depth--;
  }
  return out;
}

const problems: string[] = [];
for (const file of files(SRC)) {
  const text = readFileSync(file, "utf8");
  // An HTML element starts with "<" and a lowercase name; a "<" right after an identifier is
  // a type argument (useState<string>), not JSX.
  for (const m of text.matchAll(/<([a-z][a-z0-9]*)\b/g)) {
    const before = text.slice(0, m.index).trimEnd().slice(-1);
    if (/[\w$)\]]/.test(before)) continue;
    const end = tagEnd(text, m.index);
    const attrs = topLevel(text.slice(m.index + m[0].length, end));
    const line = text.slice(0, m.index).split("\n").length;
    const where = `${path.relative(path.resolve(SRC, ".."), file)}:${line}`;
    const tag = m[1];
    if (/(^|\s)title=/.test(attrs))
      problems.push(`${where}: <${tag} title=…> — native tooltip; use Tooltip`);
    if (tag === "select") problems.push(`${where}: <select> — use Select`);
    if (tag === "input" && /\stype="(checkbox|radio)"/.test(attrs)) {
      problems.push(
        `${where}: <input type="checkbox|radio"> — use Checkbox or a radio group component`,
      );
    }
  }
}

// The autofill rule: unlayered (it must beat Tailwind utilities such as transition-colors and the
// focus and error rings), with the text colour and the postponed background.
const DESIGN_SYSTEM = path.join(SRC, "design-system");
const AUTOFILL = "input:-webkit-autofill";
const autofill = readdirSync(DESIGN_SYSTEM)
  .filter((name) => name.endsWith(".css"))
  .flatMap((name) => {
    const css = readFileSync(path.join(DESIGN_SYSTEM, name), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    const at = css.indexOf(AUTOFILL);
    if (at === -1) return [];
    let depth = 0;
    for (const c of css.slice(0, at)) {
      if (c === "{") depth++;
      if (c === "}") depth--;
    }
    const open = css.indexOf("{", at);
    const body = css.slice(open + 1, css.indexOf("}", open));
    return [{ file: `src/design-system/${name}`, depth, body }];
  });
if (autofill.length !== 1) {
  problems.push(
    `autofill rule (${AUTOFILL}): expected exactly one in src/design-system/*.css, found ${autofill.length}`,
  );
} else {
  const { file, depth, body } = autofill[0];
  if (depth !== 0)
    problems.push(
      `${file}: autofill rule (${AUTOFILL}) is inside a block such as @layer; move it out`,
    );
  if (!/-webkit-text-fill-color:\s*var\(--foreground\)/.test(body))
    problems.push(
      `${file}: autofill rule (${AUTOFILL}) does not set -webkit-text-fill-color: var(--foreground)`,
    );
  if (!/transition:[^;]*background-color\s+0s\s+\d{6,}s/.test(body))
    problems.push(
      `${file}: autofill rule (${AUTOFILL}) does not put off the background-color transition`,
    );
}

if (problems.length > 0) {
  console.error(
    "check-native-ui: native browser UI in web/src (openspec/specs/web/design-system):",
  );
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  "check-native-ui: no native tooltips, checkboxes, radio buttons or selects; autofill rule in place",
);
