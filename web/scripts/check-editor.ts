// Deterministic check of the screenplay editor without a browser (openspec/specs/web/screenplay-editor,
// design of fork-screenplay-editor, decision 12): Tab/Enter against the TYPES table of mockup v2,
// the type keys, scene-heading autoreplace, the Fountain round trip, paragraphs() and colour marks.
// FDX import and printing need DOMParser and a window; they are checked by hand.
//
// Usage: npm run check:editor --prefix web
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { history, undo } from "prosemirror-history";
import { EditorState, TextSelection, type Command } from "prosemirror-state";

import {
  paragraphs,
  plainDoc,
  scenes,
  toJSON,
  toNode,
  type ScreenplayDoc,
} from "../src/editor/document.ts";
import {
  ELEMENT_NAMES,
  ELEMENTS,
  type ElementName,
} from "../src/editor/elements.ts";
import { docToFountain } from "../src/editor/exporters/fountain.ts";
import { fountainToDoc } from "../src/editor/importers/fountain.ts";
import {
  ELEMENT_KEYS,
  enter,
  shiftTab,
  tab,
} from "../src/editor/keymaps/index.ts";
import { clearColour, setColour } from "../src/editor/commands.ts";
import {
  findKey,
  findPlugin,
  replaceAll,
  setFind,
} from "../src/editor/plugins/find.ts";
import { suggestions } from "../src/editor/plugins/suggest.ts";
import {
  hiddenBlocks,
  visibilityKey,
  visibilityPlugin,
} from "../src/editor/plugins/visibility.ts";
import { SCENE_HEADING_START } from "../src/editor/plugins/inputRules.ts";
import { schema } from "../src/editor/schema/index.ts";

const MOCKUP = fileURLToPath(
  new URL(
    "../../openspec/context/_raw/design/kabinet-starc/data.js",
    import.meta.url,
  ),
);
// Codes of mockup v2 for our paragraph types.
const CODE: Record<string, ElementName> = {
  sh: "sceneHeading",
  cast: "sceneCharacters",
  ac: "action",
  ch: "character",
  pa: "parenthetical",
  dl: "dialogue",
  ly: "lyrics",
  shot: "shot",
  tr: "transition",
  un: "unformatted",
  note: "inlineNote",
  beat: "beat",
  seq: "sequence",
  act: "act",
};

const failures: string[] = [];
const fail = (what: string) => failures.push(what);

function literal(source: string, name: string): Record<string, unknown> {
  const m = new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n?\\});`).exec(source);
  if (m === null)
    throw new Error(`check-editor: в ${MOCKUP} нет const ${name}`);
  return new Function(`return ${m[1]}`)() as Record<string, unknown>;
}
const source = readFileSync(MOCKUP, "utf8");
const TYPES = literal(source, "TYPES") as Record<
  string,
  Record<"jt" | "je" | "ct" | "ce", string>
>;
const HOTKEYS = literal(source, "HOTKEYS") as Record<string, string>;
const SHIFT_HOTKEYS = literal(source, "SHIFT_HOTKEYS") as Record<
  string,
  string
>;

/** State with one paragraph of `type` and `text`, the caret at `at` (default: the end). */
function state(type: ElementName, text: string, at = text.length): EditorState {
  const doc = toNode(plainDoc([[type, text]]));
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, 1 + at),
  });
}
function run(cmd: Command, s: EditorState): EditorState {
  let next = s;
  const handled = cmd(s, (tr) => (next = s.apply(tr)));
  if (!handled) throw new Error("команда не обработала нажатие");
  return next;
}
const types = (s: EditorState) =>
  paragraphs(toJSON(s.doc))
    .map((p) => p.type)
    .join(", ");

// 1. Tab and Enter of every type against the mockup table.
if (Object.keys(TYPES).length !== ELEMENT_NAMES.length) {
  fail(
    `в макете ${Object.keys(TYPES).length} типов, в редакторе ${ELEMENT_NAMES.length}`,
  );
}
for (const [code, rule] of Object.entries(TYPES)) {
  const name = CODE[code];
  if (name === undefined) {
    fail(`тип макета «${code}» не сопоставлен типу редактора`);
    continue;
  }
  const label = ELEMENTS[name].label;
  for (const [key, cmd] of [
    ["Enter", enter],
    ["Tab", tab],
  ] as const) {
    const empty = types(run(cmd, state(name, "")));
    const wantEmpty = CODE[rule[key === "Enter" ? "ce" : "ct"]];
    if (empty !== wantEmpty)
      fail(
        `${label}: ${key} в пустом абзаце даёт «${empty}», нужно «${wantEmpty}»`,
      );
    const full = types(run(cmd, state(name, "Текст")));
    const wantFull = `${name}, ${CODE[rule[key === "Enter" ? "je" : "jt"]]}`;
    if (full !== wantFull)
      fail(
        `${label}: ${key} в конце абзаца даёт «${full}», нужно «${wantFull}»`,
      );
  }
  const middle = types(run(enter, state(name, "Текст", 2)));
  if (middle !== `${name}, ${name}`)
    fail(`${label}: Enter в середине даёт «${middle}»`);
  const tabMiddle = types(run(tab, state(name, "Текст", 2)));
  if (tabMiddle !== name) fail(`${label}: Tab в середине даёт «${tabMiddle}»`);
}
const back = types(run(shiftTab, state("action", "Текст")));
if (back !== "sceneCharacters")
  fail(`Shift+Tab из «Описания действия» даёт «${back}»`);

// 2. Keys of the types: Ctrl+digits, Ctrl+Shift+0/1, Ctrl+Space, Ctrl+Shift+Space.
const wantKeys: Record<string, ElementName> = {
  "Ctrl-Space": "sequence",
  "Ctrl-Shift-Space": "act",
};
for (const [d, code] of Object.entries(HOTKEYS))
  wantKeys[`Ctrl-${d}`] = CODE[code];
for (const [d, code] of Object.entries(SHIFT_HOTKEYS))
  wantKeys[`Ctrl-Shift-${d}`] = CODE[code];
for (const [key, name] of Object.entries(wantKeys)) {
  if (ELEMENT_KEYS[key] !== name)
    fail(`клавиша ${key}: «${ELEMENT_KEYS[key]}», нужно «${name}»`);
}
if (Object.keys(ELEMENT_KEYS).length !== Object.keys(wantKeys).length) {
  fail(
    `клавиш типов ${Object.keys(ELEMENT_KEYS).length}, нужно ${Object.keys(wantKeys).length}`,
  );
}

// 3. Scene-heading autoreplace.
for (const typed of [
  "ИНТ. ",
  "НАТ. ",
  "ИНТ./НАТ. ",
  "INT. ",
  "EXT. ",
  "INT./EXT. ",
  "нат. ",
]) {
  if (!SCENE_HEADING_START.test(typed))
    fail(`«${typed}» не становится заголовком сцены`);
}
for (const typed of ["НАТАША ", "ИНТЕРЕСНО ", "INTO "]) {
  if (SCENE_HEADING_START.test(typed))
    fail(`«${typed}» ошибочно становится заголовком сцены`);
}

// 4. Fountain round trip of a document with every type, empty paragraphs and look-alikes.
const sample: [ElementName, string][] = [
  ["act", "Акт первый"],
  ["sequence", "Утро"],
  ["sceneHeading", "НАТ. ОЗЕРО, МОСТКИ — РАССВЕТ"],
  ["sceneCharacters", "Миша"],
  ["beat", "Миша уходит на озеро один"],
  ["action", "Туман над водой. МИША (17) идёт по мосткам."],
  ["shot", "Крупно: поплавок"],
  ["transition", "Склейка:"],
  ["sceneHeading", "INT. KITCHEN - DAY"],
  ["character", "Вера"],
  ["dialogue", "Да, Анечка."],
  ["character", "АНЯ (З.К.)"],
  ["parenthetical", "тихо"],
  ["dialogue", "Мам, я приеду в пятницу."],
  ["lyrics", "Ой, то не вечер"],
  ["dialogue", "(не ремарка)"],
  ["character", "ВЕРА"],
  ["action", "ИНТ. ЭТО ДЕЙСТВИЕ, А НЕ СЦЕНА"],
  ["action", "CUT TO:"],
  ["unformatted", "Простой текст"],
  ["inlineNote", "Проверить дату"],
  ["inlineNote", "@cast не тег"],
  ["action", ""],
  ["dialogue", "Реплика без персонажа"],
  ["character", ""],
  ["parenthetical", ""],
];
const original = plainDoc(sample);
const fountain = docToFountain(toNode(original));
const back2 = toJSON(fountainToDoc(fountain));
const show = (d: ScreenplayDoc) =>
  paragraphs(d).map((p) => `${p.type}: ${p.text}`);
const a = show(original);
const b = show(back2);
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] !== b[i])
    fail(`Fountain, абзац ${i + 1}: было «${a[i]}», стало «${b[i]}»`);
}
for (const name of ELEMENT_NAMES) {
  if (!sample.some(([t]) => t === name))
    fail(`в примере круга Fountain нет типа «${ELEMENTS[name].label}»`);
}

// 5. paragraphs() and an unknown type.
if (paragraphs(original).length !== sample.length)
  fail("paragraphs() потерял абзацы");
try {
  paragraphs({ type: "doc", content: [{ type: "heading" as ElementName }] });
  fail("документ с неизвестным типом абзаца открылся без ошибки");
} catch (e) {
  if (!(e instanceof RangeError)) throw e;
}

// 6. Colour marks live in the document JSON and come off without touching bold.
{
  const doc = toNode({
    type: "doc",
    content: [
      {
        type: "action",
        content: [{ type: "text", text: "слово", marks: [{ type: "bold" }] }],
      },
    ],
  });
  let s = EditorState.create({
    doc,
    selection: TextSelection.create(doc, 1, 6),
  });
  s = run(setColour(schema.marks.highlight, "1"), s);
  s = run(setColour(schema.marks.textColor, "2"), s);
  const marks = () => JSON.stringify(toJSON(s.doc).content[0]);
  if (!marks().includes('"type":"highlight","attrs":{"color":"1"}'))
    fail(`заливки нет в JSON: ${marks()}`);
  if (!marks().includes('"type":"textColor","attrs":{"color":"2"}'))
    fail(`цвета нет в JSON: ${marks()}`);
  s = run(clearColour(schema.marks.textColor), s);
  if (marks().includes("textColor")) fail(`цвет не снялся: ${marks()}`);
  if (!marks().includes('"type":"bold"') || !marks().includes("highlight")) {
    fail(`снятие цвета задело другие метки: ${marks()}`);
  }
  try {
    toNode({
      type: "doc",
      content: [
        {
          type: "action",
          content: [
            {
              type: "text",
              text: "x",
              marks: [{ type: "textColor", attrs: { color: "9" as "1" } }],
            },
          ],
        },
      ],
    });
    fail("цвет метки вне палитры принят");
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
  }
}

// 7. Scenes, hidden paragraphs, find and replace, suggestions (screenplay-text-tools).
{
  const story = plainDoc([
    ["action", "До первой сцены"],
    ["act", "Акт первый"],
    ["sceneHeading", "НАТ. ОЗЕРО — РАССВЕТ"],
    ["beat", "Миша уходит"],
    ["action", "Туман над водой."],
    ["sequence", "Кухня"],
    ["sceneHeading", "ИНТ. КУХНЯ — УТРО"],
    ["character", "Вера"],
    ["dialogue", "Мам, я приеду. Мама рада."],
    ["parenthetical", "мамина интонация"],
    ["sceneHeading", "НАТ. ПРИСТАНЬ — ДЕНЬ"],
    ["action", "Вера идёт по пристани."],
  ]);
  const list = scenes(story)
    .map((s) =>
      s.kind === "scene"
        ? `${s.number}:${s.index}-${s.end}:${s.text}`
        : `${s.kind}:${s.name}`,
    )
    .join(" | ");
  const wantList =
    "act:Акт первый | 1:2-5:Туман над водой. | sequence:Кухня | 2:6-10:Вера | 3:10-12:Вера идёт по пристани.";
  if (list !== wantList) fail(`scenes(): «${list}», нужно «${wantList}»`);

  const node = toNode(story);
  const hidden = (cursor: number, showBeats: boolean, isolate: boolean) =>
    [...hiddenBlocks(node, cursor, { showBeats, isolate })].join(",");
  const cases: [number, boolean, boolean, string][] = [
    [4, false, false, "3"],
    [3, false, false, ""],
    [4, true, false, ""],
    [8, true, true, "0,1,2,3,4,5,10,11"],
    [0, true, true, "1,5,6,7,8,9,10,11"],
    [4, false, true, "0,1,3,5,6,7,8,9,10,11"],
  ];
  for (const [cursor, beats, isolate, want] of cases) {
    const got = hidden(cursor, beats, isolate);
    if (got !== want)
      fail(
        `скрытые абзацы (курсор ${cursor}, биты ${beats}, сцена ${isolate}): «${got}», нужно «${want}»`,
      );
  }

  const kitchen = node.child(0).nodeSize + node.child(1).nodeSize;
  let s = EditorState.create({
    doc: node,
    plugins: [history(), visibilityPlugin, findPlugin],
    selection: TextSelection.create(node, kitchen + 1),
  });
  const count = (
    query: string,
    scope: Parameters<typeof setFind>[0]["scope"],
  ) => {
    s = run(setFind({ query, scope, current: 0 }), s);
    return findKey.getState(s)!.matches.length;
  };
  if (count("МАМ", "all") !== 3)
    fail(
      `поиск «МАМ» во всём тексте: ${findKey.getState(s)!.matches.length}, нужно 3`,
    );
  if (count("мам", "dialogue") !== 3)
    fail("поиск в репликах должен находить и ремарки");
  if (count("мам", "action") !== 0)
    fail("поиск в описании действия нашёл реплики");
  if (count("вера", "all") !== 2)
    fail(`поиск «вера»: ${findKey.getState(s)!.matches.length}, нужно 2`);
  s = s.apply(s.tr.setMeta(visibilityKey, { isolate: true }));
  if (count("вера", "all") !== 1)
    fail("в «Только текущая сцена» поиск нашёл текст других сцен");
  s = s.apply(s.tr.setMeta(visibilityKey, { isolate: false }));
  if (count("Миша", "all") !== 0) fail("поиск нашёл текст скрытого бита");
  count("мам", "all");
  s = run(replaceAll("Надя"), s);
  const after = paragraphs(toJSON(s.doc))
    .map((p) => p.text)
    .join(" / ");
  if (
    !after.includes("Надя, я приеду. Надяа рада.") ||
    !after.includes("Надяина интонация")
  ) {
    fail(`«Заменить все»: ${after}`);
  }
  if (findKey.getState(s)!.matches.length !== 0)
    fail("после «Заменить все» остались совпадения");
  s = run(undo, s);
  if (JSON.stringify(toJSON(s.doc)) !== JSON.stringify(toJSON(node)))
    fail("одна отмена не вернула все замены");

  const data = {
    characters: ["Вера", "Аня", "Дядя Коля"],
    locations: ["Озеро", "Кухня Веры"],
  };
  const labels = (type: string, text: string) =>
    (suggestions(type, text, data)?.items ?? [])
      .map((i) => i.insert)
      .join(" | ");
  const sug: [string, string, string][] = [
    ["character", "ве", "Вера"],
    ["character", "Вера", ""],
    ["character", "", ""],
    ["sceneHeading", "ин", "ИНТ.  | ИНТ./НАТ. "],
    ["sceneHeading", "ИНТ. ку", "ИНТ. КУХНЯ ВЕРЫ — "],
    ["sceneHeading", "ИНТ. КУХНЯ — у", "ИНТ. КУХНЯ — УТРО"],
    ["action", "ве", ""],
  ];
  for (const [type, text, want] of sug) {
    const got = labels(type, text);
    if (got !== want)
      fail(`подсказки (${type}, «${text}»): «${got}», нужно «${want}»`);
  }
}

if (failures.length > 0) {
  console.error(
    "check-editor: редактор сценария расходится с openspec/specs/web/screenplay-editor:",
  );
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(
  `check-editor: ${ELEMENT_NAMES.length} типов, переходы Tab/Enter, ${Object.keys(wantKeys).length} клавиш, автоподстановка, круг Fountain, метки цвета, сцены, скрытие, поиск и подсказки — без расхождений`,
);
