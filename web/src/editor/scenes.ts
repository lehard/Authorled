// Changes of the screenplay outside the editor: cards, the scene panel and the navigator
// (scene-outline-and-cards, decisions 4 and 7). Each takes and returns document JSON.
import type { Node } from "prosemirror-model";

import {
  ensureSceneUids,
  scenes,
  toJSON,
  toNode,
  type SceneEntry,
  type SceneParams,
  type ScreenplayDoc,
} from "./document.ts";
import { schema } from "./schema/index.ts";

type Scene = Extract<SceneEntry, { kind: "scene" }>;

function children(doc: Node): Node[] {
  const out: Node[] = [];
  doc.forEach((n) => out.push(n));
  return out;
}

function build(kids: Node[]): ScreenplayDoc {
  const node = schema.nodes.doc.create(
    null,
    kids.length === 0 ? [schema.nodes.sceneHeading.create()] : kids,
  );
  node.check();
  return ensureSceneUids(toJSON(node));
}

function scene(doc: ScreenplayDoc, n: number): Scene {
  const found = scenes(doc).find((s) => s.kind === "scene" && s.number === n);
  if (found === undefined || found.kind !== "scene")
    throw new RangeError(`Сцены ${n} нет в тексте`);
  return found;
}

const para = (type: "sceneHeading" | "act" | "beat", text: string) =>
  schema.nodes[type].create(null, text === "" ? null : schema.text(text));

/**
 * Moves scene `n` with all its text so that it stands before paragraph `at` of the original
 * document (`at` = number of paragraphs: to the end). A target inside the scene changes nothing.
 */
export function moveScene(
  doc: ScreenplayDoc,
  n: number,
  at: number,
): ScreenplayDoc {
  const s = scene(doc, n);
  const kids = children(toNode(doc));
  if (at < 0 || at > kids.length)
    throw new RangeError(`Нет места ${at} в тексте`);
  if (at >= s.index && at <= s.end) return doc;
  const block = kids.splice(s.index, s.end - s.index);
  kids.splice(at > s.end ? at - block.length : at, 0, ...block);
  return build(kids);
}

/** Where «Выше» or «Ниже» puts scene `n`: across an act border it goes to the next or previous act. */
export function sceneStep(
  doc: ScreenplayDoc,
  n: number,
  dir: -1 | 1,
): number | null {
  const list = scenes(doc);
  const i = list.findIndex((s) => s.kind === "scene" && s.number === n);
  if (i < 0) throw new RangeError(`Сцены ${n} нет в тексте`);
  const near = list[i + dir];
  if (near === undefined) return null;
  if (dir === -1) return near.index;
  return near.kind === "scene" ? near.end : near.index + 1;
}

export function addScene(doc: ScreenplayDoc): ScreenplayDoc {
  return build([
    ...children(toNode(doc)),
    para("sceneHeading", "НАТ. НОВАЯ СЦЕНА — ДЕНЬ"),
  ]);
}

export function addAct(doc: ScreenplayDoc): ScreenplayDoc {
  return build([...children(toNode(doc)), para("act", "Новый акт")]);
}

/** Deletes scene `n`: its heading and all text up to the next heading, group or act. */
export function deleteScene(doc: ScreenplayDoc, n: number): ScreenplayDoc {
  const s = scene(doc, n);
  const kids = children(toNode(doc));
  kids.splice(s.index, s.end - s.index);
  return build(kids);
}

export function setSceneParams(
  doc: ScreenplayDoc,
  n: number,
  patch: Partial<SceneParams>,
): ScreenplayDoc {
  const s = scene(doc, n);
  const kids = children(toNode(doc));
  const h = kids[s.index];
  kids[s.index] = h.type.create({ ...h.attrs, ...patch }, h.content);
  return build(kids);
}

export function setSceneHeading(
  doc: ScreenplayDoc,
  n: number,
  text: string,
): ScreenplayDoc {
  const s = scene(doc, n);
  const kids = children(toNode(doc));
  const h = kids[s.index];
  kids[s.index] = h.type.create(
    h.attrs,
    text === "" ? null : schema.text(text),
  );
  return build(kids);
}

/** Beats of scene `n` from lines: existing beats take the lines in order, extra beats go, new ones end the scene. */
export function setSceneBeats(
  doc: ScreenplayDoc,
  n: number,
  lines: string[],
): ScreenplayDoc {
  const s = scene(doc, n);
  const kids = children(toNode(doc));
  const beatAt: number[] = [];
  for (let i = s.index + 1; i < s.end; i++)
    if (kids[i].type.name === "beat") beatAt.push(i);
  beatAt.forEach((i, k) => {
    if (k < lines.length) kids[i] = para("beat", lines[k]);
  });
  const extra = lines.slice(beatAt.length).map((t) => para("beat", t));
  const removed = new Set(beatAt.slice(lines.length));
  const out: Node[] = [];
  kids.forEach((node, i) => {
    if (!removed.has(i)) out.push(node);
    if (i === s.end - 1) out.push(...extra);
  });
  return build(out);
}

/** «Вера АНДРЕЕВНА» → «Вера Андреевна». */
export function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((w) =>
      w.trim() === "" || w === "-" ? w : w[0].toUpperCase() + w.slice(1),
    )
    .join("");
}

function unique(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((n) => {
    const key = n.toUpperCase();
    if (n.length < 2 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Names of the character cues, without notes in brackets such as «(З.К.)». */
export function castFromText(doc: ScreenplayDoc): string[] {
  const names: string[] = [];
  toNode(doc).forEach((node) => {
    if (node.type.name === "character")
      names.push(node.textContent.replace(/\s*\(.*?\)\s*$/u, "").trim());
  });
  return unique(names);
}

const PLACE =
  /^(?:ИНТ\.\/НАТ\.|ИНТ\.|НАТ\.|INT\.\/EXT\.|INT\.|EXT\.)\s+(.+?)(?:\s+[—-](?:\s+.*)?)?$/iu;

/** Places of the scene headings: between ИНТ./НАТ. and the dash before the time of day. */
export function placesFromText(doc: ScreenplayDoc): string[] {
  const places: string[] = [];
  toNode(doc).forEach((node) => {
    if (node.type.name !== "sceneHeading") return;
    const m = PLACE.exec(node.textContent.trim());
    if (m !== null) places.push(m[1].trim());
  });
  return unique(places);
}
