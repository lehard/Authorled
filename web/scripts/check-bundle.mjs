// Budget of the first screen (openspec/specs/web/app, «Бюджет первого экрана»): the scripts the page
// loads before its first screen — the entry of index.html and its static imports — together stay
// within MAX_FIRST_SCREEN_GZIP, and the story window and the showcase stay separate parts.
// Runs after `vite build` in `npm run build`; reads dist/.vite/manifest.json.
import { readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const DIST = path.resolve(import.meta.dirname, "..", "dist");
const MAX_FIRST_SCREEN_GZIP = 300 * 1024;
const SEPARATE = {
  "src/screens/project/ProjectScreen.tsx": "окно истории",
  "src/showcase/Showcase.tsx": "витрина",
};

const manifestPath = path.join(DIST, ".vite", "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const entry = manifest["index.html"];
if (entry === undefined || entry.isEntry !== true) {
  throw new Error(`check-bundle: no entry index.html in ${manifestPath}`);
}

const problems = [];
const firstScreen = new Map();
const visit = (key) => {
  if (firstScreen.has(key)) return;
  const chunk = manifest[key];
  if (chunk === undefined) {
    throw new Error(`check-bundle: ${key} is imported but not in the manifest`);
  }
  firstScreen.set(key, chunk);
  for (const imported of chunk.imports ?? []) visit(imported);
};
visit("index.html");

for (const [src, screen] of Object.entries(SEPARATE)) {
  if (manifest[src] === undefined || manifest[src].isDynamicEntry !== true) {
    problems.push(
      `${screen} (${src}) is not a separate part: it went into the scripts of the first screen (a static import?)`,
    );
  }
  if (firstScreen.has(src)) {
    problems.push(`${screen} (${src}) is in the scripts of the first screen`);
  }
}

const sizes = [...firstScreen.values()]
  .map((chunk) => ({
    file: chunk.file,
    gzip: gzipSync(readFileSync(path.join(DIST, chunk.file))).length,
  }))
  .sort((a, b) => b.gzip - a.gzip);
const total = sizes.reduce((sum, { gzip }) => sum + gzip, 0);
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const list = sizes.map(({ file, gzip }) => `  ${kb(gzip)}  ${file}`).join("\n");
if (total > MAX_FIRST_SCREEN_GZIP) {
  problems.push(
    `scripts of the first screen are ${kb(total)} gzip, over ${kb(MAX_FIRST_SCREEN_GZIP)}:\n${list}`,
  );
}

// Order of the cascade layers (openspec/specs/web/design-system, «Порядок слоёв CSS»): index.html
// declares it before its first stylesheet, in the order the layers first appear in the entry CSS.
const html = readFileSync(path.join(DIST, "index.html"), "utf8");
const declaration = /@layer\s+([\w-]+(?:\s*,\s*[\w-]+)+)\s*;/.exec(html);
const firstStylesheet = /<link[^>]*rel="stylesheet"/.exec(html);
const entryCss = entry.css ?? [];
if (entryCss.length === 0) {
  throw new Error(
    "check-bundle: the entry index.html has no CSS in the manifest",
  );
}
const layers = [];
for (const file of entryCss) {
  const css = readFileSync(path.join(DIST, file), "utf8");
  for (const [, names] of css.matchAll(
    /@layer\s+([\w-]+(?:\s*,\s*[\w-]+)*)\s*[;{]/g,
  )) {
    for (const name of names.split(",").map((n) => n.trim())) {
      if (!layers.includes(name)) layers.push(name);
    }
  }
}
if (declaration === null) {
  problems.push(
    `index.html declares no order of the CSS layers; put "@layer ${layers.join(", ")};" before the first stylesheet`,
  );
} else {
  const declared = declaration[1].split(",").map((n) => n.trim());
  if (firstStylesheet !== null && firstStylesheet.index < declaration.index) {
    problems.push(
      "the order of the CSS layers in index.html comes after a stylesheet",
    );
  }
  if (declared.join(",") !== layers.join(",")) {
    problems.push(
      `index.html declares the CSS layers ${declared.join(", ")}, the entry CSS has ${layers.join(", ")}`,
    );
  }
}

if (problems.length > 0) {
  console.error(`check-bundle failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(
  `check-bundle: first screen ${kb(total)} gzip of ${kb(MAX_FIRST_SCREEN_GZIP)}\n${list}`,
);
