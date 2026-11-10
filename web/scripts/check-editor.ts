// Deterministic check of the screenplay editor without a browser (openspec/specs/web/screenplay-editor,
// design of fork-screenplay-editor, decision 12): Tab/Enter against the TYPES table of mockup v2,
// the type keys, scene-heading autoreplace, export samples of the core import tests, paragraphs(),
// colour and comment marks; the Markdown of the prose editor against markdown.cases.json
// (openspec/specs/web/prose-editor). Printing needs a window; it is checked by hand.
//
// Usage: npm run check:editor --prefix web
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { history, undo, undoDepth } from "prosemirror-history";
import type { Node as ProseNode } from "prosemirror-model";
import { EditorState, TextSelection, type Command } from "prosemirror-state";

import {
  countChars,
  countWords,
  parseProse,
  ProseMarkupError,
  proseText,
  serializeProse,
} from "../src/editor/prose/markdown.ts";

import {
  ensureSceneUids,
  paragraphs,
  plainDoc,
  scenes,
  stripMarks,
  toJSON,
  toNode,
  type ScreenplayDoc,
} from "../src/editor/document.ts";
import {
  ELEMENT_NAMES,
  ELEMENTS,
  type ElementName,
} from "../src/editor/elements.ts";
import { docToFDX } from "../src/editor/exporters/fdx.ts";
import { docToFountain } from "../src/editor/exporters/fountain.ts";
import {
  ELEMENT_KEYS,
  enter,
  lineBreak,
  setElement,
  outlineEnter,
  outlineTab,
  shiftTab,
  tab,
} from "../src/editor/keymaps/index.ts";
import {
  addAct,
  addScene,
  castFromText,
  deleteScene,
  moveScene,
  placesFromText,
  sceneStep,
  setSceneBeats,
  setSceneHeading,
  setSceneParams,
} from "../src/editor/scenes.ts";
import { clearColour, setColour } from "../src/editor/commands.ts";
import {
  findKey,
  findPlugin,
  replaceAll,
  setFind,
} from "../src/editor/plugins/find.ts";
import { suggestions } from "../src/editor/plugins/suggest.ts";
import { sceneHeadings } from "../src/editor/plugins/sceneHeadings.ts";
import {
  cardGapKey,
  cardGapStatePlugin,
  type CardGapMeta,
} from "../src/editor/plugins/cardGap.ts";
import {
  addComment,
  commentQuotes,
  commentRanges,
  removeComment,
} from "../src/editor/plugins/comments.ts";
import {
  acceptSuggestion,
  rejectSuggestion,
  setSuggestions,
  suggestionRanges,
  suggestionsStatePlugin,
} from "../src/editor/plugins/suggestions.ts";
import {
  hiddenBlocks,
  outlineCaret,
  outlineGuardPlugin,
  visibilityKey,
  visibilityPlugin,
} from "../src/editor/plugins/visibility.ts";
import { SCENE_HEADING_START } from "../src/editor/plugins/inputRules.ts";
import { parenthesisPlugin } from "../src/editor/plugins/parenthesis.ts";
import { capitalsPlugin } from "../src/editor/plugins/capitals.ts";
import { sceneUidsPlugin } from "../src/editor/plugins/sceneUids.ts";
import { findAnchor, placeAnchors } from "../src/editor/anchors.ts";
import { schema } from "../src/editor/schema/index.ts";
import { foldText } from "../src/editor/fold.ts";

import { SAMPLE_ROWS, staleSamples } from "./samples.ts";

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
const TREAT = literal(source, "TREAT") as Record<
  string,
  Record<"jt" | "je" | "ct" | "ce", string>
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
  // In a dialogue Tab in the middle puts a parenthetical in (section 12).
  const tabMiddle = types(run(tab, state(name, "Текст", 2)));
  const wantTabMiddle =
    name === "dialogue" ? "dialogue, parenthetical, dialogue" : name;
  if (tabMiddle !== wantTabMiddle)
    fail(`${label}: Tab в середине даёт «${tabMiddle}»`);
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

// 4. Export samples: every type, and the files the core imports equal the current export.
for (const name of ELEMENT_NAMES) {
  if (!SAMPLE_ROWS.some(([t]) => t === name))
    fail(`в образце экспорта нет типа «${ELEMENTS[name].label}»`);
}
for (const path of staleSamples())
  fail(
    `образец ${path} расходится с экспортом редактора: npm run samples:export --prefix web`,
  );
const sample: [ElementName, string][] = [
  ["sceneHeading", "НАТ. ОЗЕРО, МОСТКИ — РАССВЕТ"],
  ["action", "Туман над водой."],
  ["character", "ВЕРА"],
  ["dialogue", "Да, Анечка."],
];
const original = plainDoc(sample);

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
    [
      ...hiddenBlocks(node, cursor, { showBeats, isolate, outline: false }),
    ].join(",");
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
    plugins: [
      history(),
      visibilityPlugin(false),
      suggestionsStatePlugin,
      findPlugin,
    ],
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
  // «ё» and «е» are one letter for the search, as in the search of the story (project-search).
  if (count("ИДЕТ", "all") !== 1)
    fail("поиск «ИДЕТ» должен находить «идёт»: ё и е не различаются");
  const yo = findKey.getState(s)!.matches[0]!;
  if (s.doc.textBetween(yo.from, yo.to) !== "идёт")
    fail(`поиск «ИДЕТ» выделил «${s.doc.textBetween(yo.from, yo.to)}»`);
  if (foldText("İВЁРА") !== "İвера")
    fail(`свёртка сдвинула буквы: «${foldText("İВЁРА")}»`);
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

// 8. Treatment, scene functions, cast and places (scene-outline-and-cards).
{
  const story = plainDoc([
    ["action", "До первой сцены"],
    ["act", "Акт первый"],
    ["sceneHeading", "НАТ. ОЗЕРО — РАССВЕТ"],
    ["beat", "Миша уходит"],
    ["action", "Туман."],
    ["sceneHeading", "ИНТ. КУХНЯ ВЕРЫ — УТРО"],
    ["character", "ВЕРА"],
    ["dialogue", "Да."],
    ["act", "Акт второй"],
    ["sceneHeading", "НАТ. ПРИСТАНЬ — ДЕНЬ"],
    ["character", "Паромщик (З.К.)"],
    ["dialogue", "Отходим!"],
  ]);
  const outline = (d: ScreenplayDoc) =>
    scenes(d)
      .map((s) =>
        s.kind === "scene"
          ? `${s.number}:${s.heading}[${s.beats.join(";")}]`
          : `#${s.name}`,
      )
      .join(" | ");
  const texts = (d: ScreenplayDoc) =>
    paragraphs(d)
      .map((p) => p.text)
      .join(" / ");

  // Scene parameters: defaults for old documents, checked colour, kept with the heading.
  const params = scenes(story).find((s) => s.kind === "scene");
  if (
    params?.kind !== "scene" ||
    JSON.stringify(params.params) !==
      JSON.stringify({ uid: "", alt: "", day: "", color: null, tags: [] })
  ) {
    fail(`параметры сцены по умолчанию: ${JSON.stringify(params)}`);
  }
  try {
    setSceneParams(story, 1, { color: "9" as "1" });
    fail("цвет сцены вне палитры принят");
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
  }

  const moved = moveScene(story, 3, 2);
  const wantMoved =
    "#Акт первый | 1:НАТ. ПРИСТАНЬ — ДЕНЬ[] | 2:НАТ. ОЗЕРО — РАССВЕТ[Миша уходит] | 3:ИНТ. КУХНЯ ВЕРЫ — УТРО[] | #Акт второй";
  if (outline(moved) !== wantMoved)
    fail(`moveScene 3 → перед 1: «${outline(moved)}»`);
  if (
    !texts(moved).includes(
      "НАТ. ПРИСТАНЬ — ДЕНЬ / Паромщик (З.К.) / Отходим! / НАТ. ОЗЕРО",
    )
  )
    fail(`сцена переехала без текста: ${texts(moved)}`);
  const toAct = moveScene(story, 1, 9);
  if (
    outline(toAct) !==
    "#Акт первый | 1:ИНТ. КУХНЯ ВЕРЫ — УТРО[] | #Акт второй | 2:НАТ. ОЗЕРО — РАССВЕТ[Миша уходит] | 3:НАТ. ПРИСТАНЬ — ДЕНЬ[]"
  ) {
    fail(`moveScene в начало акта: «${outline(toAct)}»`);
  }
  if (JSON.stringify(moveScene(story, 2, 6)) !== JSON.stringify(story))
    fail("moveScene на своё место изменил текст");
  const down = sceneStep(story, 2, 1);
  const up = sceneStep(story, 3, -1);
  if (
    down !== 9 ||
    up !== 8 ||
    sceneStep(story, 1, -1) !== 1 ||
    sceneStep(story, 3, 1) !== null
  ) {
    fail(`sceneStep: вниз ${down}, вверх ${up}`);
  }
  if (
    outline(deleteScene(story, 2)) !==
    "#Акт первый | 1:НАТ. ОЗЕРО — РАССВЕТ[Миша уходит] | #Акт второй | 2:НАТ. ПРИСТАНЬ — ДЕНЬ[]"
  )
    fail("deleteScene");
  if (texts(deleteScene(story, 2)).includes("Да."))
    fail("deleteScene оставил текст сцены");
  const beats = setSceneBeats(
    setSceneBeats(story, 1, ["Первый", "Второй"]),
    1,
    ["Один"],
  );
  if (outline(beats).split(" | ")[1] !== "1:НАТ. ОЗЕРО — РАССВЕТ[Один]")
    fail(`setSceneBeats: ${outline(beats)}`);
  const twoBeats = setSceneBeats(story, 1, ["Первый", "Второй"]);
  if (!texts(twoBeats).includes("Первый / Туман. / Второй / ИНТ."))
    fail(`новый бит не в конце сцены: ${texts(twoBeats)}`);
  const named = setSceneHeading(
    setSceneParams(story, 3, {
      alt: "Отплытие",
      color: "2",
      tags: ["пристань"],
      day: "3-й день",
    }),
    3,
    "НАТ. ПРИСТАНЬ — НОЧЬ",
  );
  const third = scenes(moveScene(named, 3, 2)).find((s) => s.kind === "scene");
  if (
    third?.kind !== "scene" ||
    third.heading !== "НАТ. ПРИСТАНЬ — НОЧЬ" ||
    third.params.alt !== "Отплытие" ||
    third.params.tags[0] !== "пристань"
  ) {
    fail(`параметры не переехали со сценой: ${JSON.stringify(third)}`);
  }
  if (
    !outline(addAct(addScene(story))).endsWith(
      "4:НАТ. НОВАЯ СЦЕНА — ДЕНЬ[] | #Новый акт",
    )
  )
    fail("addScene и addAct");
  try {
    deleteScene(story, 9);
    fail("deleteScene несуществующей сцены прошёл без ошибки");
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
  }
  if (castFromText(story).join(",") !== "ВЕРА,Паромщик")
    fail(`castFromText: ${castFromText(story).join(",")}`);
  if (placesFromText(story).join(",") !== "ОЗЕРО,КУХНЯ ВЕРЫ,ПРИСТАНЬ")
    fail(`placesFromText: ${placesFromText(story).join(",")}`);

  // Treatment: Tab/Enter after TREAT, hidden text kept, the caret out of hidden paragraphs.
  for (const [code, rule] of Object.entries(TREAT)) {
    const name = CODE[code];
    for (const [key, cmd] of [
      ["Enter", outlineEnter],
      ["Tab", outlineTab],
    ] as const) {
      const empty = types(run(cmd, state(name, "")));
      if (empty !== CODE[rule[key === "Enter" ? "ce" : "ct"]])
        fail(
          `поэпизодник, ${ELEMENTS[name].label}: ${key} в пустом — «${empty}»`,
        );
      const full = types(run(cmd, state(name, "Текст")));
      if (full !== `${name}, ${CODE[rule[key === "Enter" ? "je" : "jt"]]}`)
        fail(
          `поэпизодник, ${ELEMENTS[name].label}: ${key} в конце — «${full}»`,
        );
    }
  }
  const node = toNode(story);
  const hiddenOutline = [
    ...hiddenBlocks(node, 4, {
      showBeats: false,
      isolate: false,
      outline: true,
    }),
  ].join(",");
  if (hiddenOutline !== "0,4,6,7,10,11")
    fail(`поэпизодник скрывает «${hiddenOutline}»`);
  const sceneStart = (n: number) => {
    let k = 0;
    let found = -1;
    node.forEach((c, offset) => {
      if (c.type.name === "sceneHeading" && ++k === n) found = offset;
    });
    return found;
  };
  let g = EditorState.create({
    doc: node,
    plugins: [visibilityPlugin(true), outlineGuardPlugin],
  });
  const from = sceneStart(2) + 1;
  const to = sceneStart(3) + 5;
  g = g.apply(g.tr.setSelection(TextSelection.create(node, from, to)));
  const deleted = g.apply(g.tr.deleteSelection());
  if (JSON.stringify(toJSON(deleted.doc)) !== JSON.stringify(toJSON(node)))
    fail("в поэпизоднике удаление через сцены задело скрытый текст");
  const inside = g.apply(
    g.tr.setSelection(TextSelection.create(node, from + 2)).insertText("x"),
  );
  if (
    !paragraphs(toJSON(inside.doc)).some(
      (p) => p.text === "ИНxТ. КУХНЯ ВЕРЫ — УТРО",
    )
  )
    fail("в поэпизоднике не печатается в заголовке");
  const actionPos =
    node.child(0).nodeSize +
    node.child(1).nodeSize +
    node.child(2).nodeSize +
    node.child(3).nodeSize +
    2;
  const caret = outlineCaret(node, actionPos);
  if (caret === null || node.resolve(caret).parent.type.name !== "beat")
    fail(`курсор из скрытого абзаца ушёл в ${caret}`);
}

// 9. Comments: marks in the JSON, two on one word, outside undo, not exported (screenplay-comments).
{
  const doc = toNode(
    plainDoc([
      ["sceneHeading", "ИНТ. КУХНЯ — УТРО"],
      ["action", "Склейка. Вера молчит."],
      ["sceneHeading", "НАТ. ОЗЕРО — ДЕНЬ"],
      ["action", "Вода."],
    ]),
  );
  const start = doc.child(0).nodeSize + 1;
  let s = EditorState.create({
    doc,
    plugins: [history(), visibilityPlugin(false)],
    selection: TextSelection.create(doc, start, start + 7),
  });
  s = run(addComment("c1"), s);
  s = run(addComment("c2"), s);
  const quotes = commentQuotes(s.doc);
  if (quotes.get("c1") !== "Склейка" || quotes.get("c2") !== "Склейка")
    fail(`два комментария на одном слове: ${JSON.stringify([...quotes])}`);
  const json = JSON.stringify(toJSON(s.doc));
  if (!json.includes('{"type":"comment","attrs":{"id":"c1"}}'))
    fail(`метки комментария нет в JSON: ${json}`);
  if (JSON.stringify(toJSON(toNode(toJSON(s.doc)))) !== json)
    fail("метка комментария не пережила JSON");
  if (undo(s)) fail("комментарий попал в историю отмены");

  // Typed at the edge of the place, the text stays outside it; undo takes only the typing.
  s = s.apply(
    s.tr.setSelection(TextSelection.create(s.doc, start + 7)).insertText("!"),
  );
  if (commentQuotes(s.doc).get("c1") !== "Склейка")
    fail(
      `напечатанное на границе вошло в комментарий: ${commentQuotes(s.doc).get("c1")}`,
    );
  s = run(undo, s);
  if (paragraphs(toJSON(s.doc))[1].text !== "Склейка. Вера молчит.")
    fail(`отмена не убрала напечатанное: ${paragraphs(toJSON(s.doc))[1].text}`);
  if (commentRanges(s.doc, "c1").length !== 1)
    fail("отмена правки текста сняла комментарий");

  const exported = docToFountain(s.doc) + docToFDX(s.doc);
  if (exported.includes("c1") || exported.includes("comment"))
    fail("комментарий попал в Fountain или FDX");

  const moved = moveScene(toJSON(s.doc), 1, 4);
  if (
    paragraphs(moved)[3].text !== "Склейка. Вера молчит." ||
    commentQuotes(toNode(moved)).get("c2") !== "Склейка"
  )
    fail("комментарий не переехал вместе со сценой");

  s = run(removeComment("c1"), s);
  if (commentQuotes(s.doc).has("c1") || !commentQuotes(s.doc).has("c2"))
    fail("снятие одного комментария задело другой");
  try {
    run(
      addComment("c3"),
      s.apply(s.tr.setSelection(TextSelection.create(s.doc, start))),
    );
    fail("комментарий без выделения принят");
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("выделенный")) throw e;
  }
}

// 10. Co-author suggestions: kept whole, accepted as an edit, rejected outside undo (coauthor-suggestions).
{
  const old = "Чашка давно чистая.";
  const doc = toNode({
    type: "doc",
    content: [
      {
        type: "action",
        content: [
          { type: "text", text: "Свет. " },
          {
            type: "text",
            text: old,
            marks: [
              { type: "bold" },
              { type: "suggestion", attrs: { id: "s1" } },
            ],
          },
          { type: "text", text: " Вера трёт её." },
        ],
      },
      { type: "action", content: [{ type: "text", text: "Чашка у окна." }] },
    ],
  });
  let s = EditorState.create({
    doc,
    plugins: [
      history(),
      visibilityPlugin(false),
      suggestionsStatePlugin,
      findPlugin,
    ],
  });
  s = run(setSuggestions({ open: { s1: "Чашка чистая." } }), s);
  const r = suggestionRanges(s.doc, "s1")[0];
  const text = (st: EditorState) => paragraphs(toJSON(st.doc))[0].text;
  if (
    !JSON.stringify(toJSON(s.doc)).includes(
      '{"type":"suggestion","attrs":{"id":"s1"}}',
    )
  )
    fail("метки предложения нет в JSON");

  if (text(s.apply(s.tr.insertText("x", r.from + 3))) !== text(s))
    fail("правка внутри предложения прошла");
  if (text(s.apply(s.tr.delete(r.to - 1, r.to))) !== text(s))
    fail("удаление последней буквы предложения прошло");
  const edge = s.apply(s.tr.insertText("!", r.to));
  if (text(edge) !== `Свет. ${old}! Вера трёт её.`)
    fail(`набор на границе предложения: ${text(edge)}`);
  if (suggestionRanges(edge.doc, "s1")[0].to !== r.to)
    fail("набор на границе вошёл в предложение");
  const whole = s.apply(s.tr.delete(0, s.doc.child(0).nodeSize));
  if (whole.doc.childCount !== 1)
    fail("удаление абзаца с предложением не прошло");

  s = run(setFind({ query: "чашка" }), s);
  const found = findKey.getState(s)?.matches.length;
  if (found !== 1)
    fail(`поиск в тексте предложения: ${found} совпадений вместо 1`);
  s = run(setFind({ query: "" }), s);

  const exported = docToFountain(s.doc) + docToFDX(s.doc);
  if (!exported.includes(old) || exported.includes("Чашка чистая."))
    fail("экспорт до решения не равен прежнему тексту");

  const accepted = run(acceptSuggestion("s1", "Чашка чистая."), s);
  if (text(accepted) !== "Свет. Чашка чистая. Вера трёт её.")
    fail(`«Принять»: ${text(accepted)}`);
  if (!JSON.stringify(toJSON(accepted.doc).content[0]).includes('"bold"'))
    fail("«Принять» потеряло общие метки фрагмента");
  if (suggestionRanges(accepted.doc, "s1").length !== 0)
    fail("после «Принять» метка осталась");
  const back = run(undo, accepted);
  if (text(back) !== text(s) || suggestionRanges(back.doc, "s1").length !== 1)
    fail("⌘Z после «Принять» не вернул прежний текст с меткой");

  const depth = undoDepth(s);
  const rejected = run(rejectSuggestion("s1"), s);
  if (
    text(rejected) !== text(s) ||
    suggestionRanges(rejected.doc, "s1").length !== 0
  )
    fail("«Отклонить» изменило текст или оставило метку");
  if (undoDepth(rejected) !== depth)
    fail("«Отклонить» попало в историю отмены");
}

// 11. Drafts: a copy without comment and suggestion marks.
{
  const marked: ScreenplayDoc = {
    type: "doc",
    content: [
      {
        type: "action",
        content: [
          { type: "text", text: "Свет. ", marks: [{ type: "bold" }] },
          {
            type: "text",
            text: "Чашка",
            marks: [
              { type: "bold" },
              { type: "textColor", attrs: { color: "2" } },
              { type: "comment", attrs: { id: "c1" } },
            ],
          },
          {
            type: "text",
            text: " чистая.",
            marks: [{ type: "suggestion", attrs: { id: "s1" } }],
          },
        ],
      },
    ],
  };
  const copy = JSON.stringify(stripMarks(marked, ["comment", "suggestion"]));
  if (copy.includes('"comment"') || copy.includes('"suggestion"'))
    fail("копия для драфта сохранила метки комментариев или предложений");
  if (!copy.includes('"bold"') || !copy.includes('"textColor"'))
    fail("копия для драфта потеряла жирный или цвет");
  if (
    paragraphs(JSON.parse(copy) as ScreenplayDoc)[0].text !==
    "Свет. Чашка чистая."
  )
    fail("копия для драфта изменила текст");
}

// Lasting scene ids (web/screenplay-editor, «Постоянный uid сцены»).
{
  const uids = (d: ScreenplayDoc) =>
    d.content.flatMap((b) =>
      b.type === "sceneHeading" ? [b.attrs?.uid ?? ""] : [],
    );
  const distinct = (list: string[]) =>
    list.every((u) => u !== "") && new Set(list).size === list.length;
  const two = ensureSceneUids(
    plainDoc([
      ["sceneHeading", "ИНТ. КУХНЯ — ДЕНЬ"],
      ["action", "Вера молчит."],
      ["sceneHeading", "НАТ. ОЗЕРО — ВЕЧЕР"],
      ["action", "Круги на воде."],
    ]),
  );
  const [s1, s2] = uids(two);
  if (!distinct([s1, s2])) fail(`ensureSceneUids: ${uids(two).join(", ")}`);
  if (ensureSceneUids(two) !== two)
    fail("ensureSceneUids изменил документ, где у всех сцен есть uid");

  const editor = (d: ScreenplayDoc, at: number) => {
    const node = toNode(d);
    return EditorState.create({
      doc: node,
      plugins: [history(), sceneUidsPlugin],
      selection: TextSelection.create(node, at),
    });
  };
  const apply = (s: EditorState, f: (tr: EditorState["tr"]) => void) => {
    const tr = s.tr;
    f(tr);
    return s.apply(tr);
  };
  const end = toNode(two).content.size;

  // A new scene: a heading typed at the end.
  const third = apply(editor(two, end - 1), (tr) =>
    tr.insert(
      end,
      schema.nodes.sceneHeading.create(null, schema.text("НАТ. ПРИСТАНЬ")),
    ),
  );
  const all3 = uids(toJSON(third.doc));
  if (all3.length !== 3 || !distinct(all3) || all3[0] !== s1 || all3[1] !== s2)
    fail(`новая сцена: ${all3.join(", ")}`);
  if (undoDepth(third) !== 1) fail("uid новой сцены — отдельный шаг отмены");

  // A pasted copy of the first scene at the end: the copy gets a new id.
  const copy = toNode(two).cut(0, toNode(two).child(0).nodeSize * 1).content;
  const pasted = apply(editor(two, 1), (tr) => tr.insert(end, copy));
  const all4 = uids(toJSON(pasted.doc));
  if (all4[0] !== s1 || all4[1] !== s2 || !distinct(all4))
    fail(`копия сцены в конце: ${all4.join(", ")}`);
  // The same copy pasted in front of the original: the original keeps its id.
  const before = apply(editor(two, 1), (tr) => tr.insert(0, copy));
  const all5 = uids(toJSON(before.doc));
  if (all5[1] !== s1 || !distinct(all5))
    fail(`копия сцены перед исходной: ${all5.join(", ")}`);

  // Splitting a heading in the middle: the first half keeps the id.
  const split = apply(editor(two, 5), (tr) => tr.split(5));
  const all6 = uids(toJSON(split.doc));
  if (all6[0] !== s1 || all6.length !== 3 || !distinct(all6))
    fail(`разделение заголовка: ${all6.join(", ")}`);

  // A card moved to the front keeps its id; «+ Сцена» gets a new one.
  const moved = moveScene(two, 2, 0);
  if (uids(moved).join() !== [s2, s1].join())
    fail(`перестановка карточкой: ${uids(moved).join(", ")}`);
  const added = uids(addScene(two));
  if (added.length !== 3 || !distinct(added) || added[0] !== s1)
    fail(`«+ Сцена»: ${added.join(", ")}`);
  const edited = setSceneParams(two, 1, { alt: "Чайник" });
  if (uids(edited)[0] !== s1) fail("параметры сцены сменили uid");

  // Export and print read the text only.
  const exported = docToFountain(toNode(two)) + docToFDX(toNode(two));
  if (exported.includes(s1) || exported.includes(s2))
    fail("uid сцены попал в экспорт");
}

// Suggestions by anchor (web/workspace, «Предложение по якорю», «Предложения без места в тексте»).
{
  const doc = toNode({
    type: "doc",
    content: [
      {
        type: "sceneHeading",
        attrs: { uid: "s1" },
        content: [{ type: "text", text: "ИНТ. КУХНЯ — ДЕНЬ" }],
      },
      { type: "action", content: [{ type: "text", text: "Вера молчит." }] },
      {
        type: "sceneHeading",
        attrs: { uid: "s3" },
        content: [{ type: "text", text: "НАТ. ОЗЕРО — ВЕЧЕР" }],
      },
      {
        type: "action",
        content: [{ type: "text", text: "Вода. Вера молчит." }],
      },
      { type: "action", content: [{ type: "text", text: "Долго." }] },
    ],
  });
  const at = findAnchor(doc, "s3", "Вера молчит");
  if (at === null || doc.textBetween(at.from, at.to) !== "Вера молчит")
    fail(`якорь в сцене s3: ${JSON.stringify(at)}`);
  else if (at.from < doc.child(0).nodeSize + doc.child(1).nodeSize)
    fail("якорь найден не в своей сцене");
  if (findAnchor(doc, "s9", "Вера молчит") !== null)
    fail("якорь найден без сцены");
  if (findAnchor(doc, "s3", "Вера кричит") !== null)
    fail("якорь найден без цитаты");
  if (findAnchor(doc, "s3", "молчит. Долго") !== null)
    fail("якорь найден через два абзаца");

  const tr = EditorState.create({ doc }).tr;
  const missing = placeAnchors(tr, [
    { id: "a", sceneUid: "s3", quote: "Вера молчит" },
    { id: "b", sceneUid: "s9", quote: "Вера молчит" },
    { id: "c", sceneUid: "s3", quote: "Вера кричит" },
    { id: "d", sceneUid: "s3", quote: "Вода. Вера" },
  ]);
  if (missing.join() !== "b,c,d")
    fail(`без места в тексте: ${missing.join(", ")}`);
  const placed = suggestionRanges(tr.doc, "a");
  if (
    placed.length !== 1 ||
    tr.doc.textBetween(placed[0].from, placed[0].to) !== "Вера молчит"
  )
    fail(`метка предложения: ${JSON.stringify(placed)}`);
  // A second placement leaves the mark as it is.
  const again = EditorState.create({ doc: tr.doc }).tr;
  placeAnchors(again, [{ id: "a", sceneUid: "s3", quote: "Вера молчит" }]);
  if (again.docChanged) fail("повторная постановка изменила текст");
}

// --- gap for a card (web/workspace, «Карточки у текста»): no change of the document, no undo step
{
  const node = toNode(
    plainDoc([
      ["action", "Вера молчит."],
      ["action", "Чайник шумит."],
    ]),
  );
  let s = EditorState.create({
    doc: node,
    plugins: [history(), cardGapStatePlugin],
  });
  const before = JSON.stringify(toJSON(s.doc));
  const after = node.child(0).nodeSize;
  const show: CardGapMeta = { show: { id: "t1", pos: after, height: 120 } };
  s = s.apply(s.tr.setMeta(cardGapKey, show).setMeta("addToHistory", false));
  if (JSON.stringify(toJSON(s.doc)) !== before)
    fail("зазор карточки изменил документ");
  if (undoDepth(s) !== 0) fail("зазор карточки попал в историю отмены");
  if (cardGapKey.getState(s)?.pos !== after)
    fail("зазор карточки не поставлен");
  // Typing before the gap moves it with the text.
  s = s.apply(s.tr.insertText("Да. ", 1));
  if (cardGapKey.getState(s)?.pos !== after + 4)
    fail(`зазор карточки не поехал с текстом: ${cardGapKey.getState(s)?.pos}`);
  // Another card's hide leaves it; its own hide removes it.
  const other: CardGapMeta = { hide: "t2" };
  s = s.apply(s.tr.setMeta(cardGapKey, other));
  if (cardGapKey.getState(s) === null) fail("чужая карточка закрыла зазор");
  const own: CardGapMeta = { hide: "t1" };
  s = s.apply(s.tr.setMeta(cardGapKey, own));
  if (cardGapKey.getState(s) !== null) fail("зазор карточки не закрылся");
}

// --- scene numbers (web/screenplay-editor, «Ввод в пустой заголовок сцены»): numbered in order,
// the empty heading marked; inserting and deleting a scene renumbers them
{
  const numbers = (d: ProseNode) =>
    sceneHeadings(d)
      .map((h) => `${h.number}${h.empty ? " пустой" : ""}`)
      .join(", ");
  let s = EditorState.create({
    doc: toNode(
      plainDoc([
        ["sceneHeading", "НАТ. ОЗЕРО — РАССВЕТ"],
        ["action", "Миша идёт по мосткам."],
        ["sceneHeading", ""],
        ["action", "Вера закрывает кран."],
        ["sceneHeading", "ИНТ. ГАРАЖ — ВЕЧЕР"],
      ]),
    ),
  });
  if (numbers(s.doc) !== "1, 2 пустой, 3")
    fail(`номера сцен: ${numbers(s.doc)}, нужно «1, 2 пустой, 3»`);
  const heading = s.schema.nodes.sceneHeading.create(
    null,
    s.schema.text("ИНТ. КУХНЯ — УТРО"),
  );
  s = s.apply(s.tr.insert(0, heading));
  if (numbers(s.doc) !== "1, 2, 3 пустой, 4")
    fail(
      `номера после вставки сцены: ${numbers(s.doc)}, нужно «1, 2, 3 пустой, 4»`,
    );
  const third = sceneHeadings(s.doc)[2];
  const empty = s.doc.nodeAt(third.pos);
  if (empty === null) throw new Error("номера сцен: нет третьего заголовка");
  s = s.apply(s.tr.delete(third.pos, third.pos + empty.nodeSize));
  if (numbers(s.doc) !== "1, 2, 3")
    fail(`номера после удаления сцены: ${numbers(s.doc)}, нужно «1, 2, 3»`);
}

// 12. Line breaks and brackets (editor-line-break-parenthetical).
{
  const rows = (s: EditorState) =>
    paragraphs(toJSON(s.doc))
      .map((p) => `${p.type}:${p.text}`)
      .join(" | ");
  /** State of `paragraphs`, the caret in paragraph `index` at `at` (default: its end). */
  const stateIn = (
    rowsOf: [ElementName, string][],
    index: number,
    at?: number,
  ): EditorState => {
    const doc = toNode(plainDoc(rowsOf));
    let pos = 0;
    for (let i = 0; i < index; i += 1) pos += doc.child(i).nodeSize;
    const offset = at ?? doc.child(index).content.size;
    return EditorState.create({
      doc,
      selection: TextSelection.create(doc, pos + 1 + offset),
      plugins: [history()],
    });
  };
  /** Typing `text` character by character, as the view does: the bracket plugin first. */
  const typed = (s: EditorState, text: string): EditorState => {
    let next = s;
    for (const ch of text) {
      const { from, to } = next.selection;
      let changed = next;
      const view = {
        state: next,
        dispatch: (tr: Parameters<EditorState["apply"]>[0]) => {
          changed = changed.apply(tr);
        },
      } as unknown as Parameters<
        NonNullable<typeof parenthesisPlugin.props.handleTextInput>
      >[0];
      const handled = parenthesisPlugin.props.handleTextInput?.call(
        parenthesisPlugin,
        view,
        from,
        to,
        ch,
        () => next.tr.insertText(ch, from, to),
      );
      next =
        handled === true
          ? changed
          : next.apply(next.tr.insertText(ch, from, to));
    }
    return next;
  };

  // Shift+Enter: a line break in the paragraph, none in one-line types.
  const twoLines = typed(run(lineBreak, state("dialogue", "Фыва")), "ывафы");
  if (rows(twoLines) !== "dialogue:Фыва\nывафы")
    fail(`Shift+Enter в реплике даёт «${rows(twoLines)}»`);
  if (types(run(enter, twoLines)) !== "dialogue, action")
    fail(`Enter после переноса строки даёт «${types(run(enter, twoLines))}»`);
  for (const name of ["sceneHeading", "transition", "character"] as const) {
    const before = state(name, "НАТ. ПОМОСТ — ВЕЧЕР");
    if (!run(lineBreak, before).doc.eq(before.doc))
      fail(`Shift+Enter меняет абзац «${ELEMENTS[name].label}»`);
  }
  for (const name of [
    "action",
    "parenthetical",
    "lyrics",
    "unformatted",
  ] as const) {
    if (rows(run(lineBreak, state(name, "А"))) !== `${name}:А\n`)
      fail(`Shift+Enter не переносит строку в «${ELEMENTS[name].label}»`);
  }
  // Typing next to a line break and pasting a paragraph keep it: the view rereads the DOM with
  // whitespace kept only in "pre" nodes (the reread itself is checked in the browser).
  for (const name of ELEMENT_NAMES) {
    const spec = schema.nodes[name].spec;
    if (spec.whitespace !== "pre")
      fail(
        `абзац «${ELEMENTS[name].label}» без whitespace: "pre" теряет переносы при наборе`,
      );
    if (
      !(spec.parseDOM ?? []).some((rule) => rule.preserveWhitespace === "full")
    )
      fail(`абзац «${ELEMENTS[name].label}» при вставке теряет переносы строк`);
  }

  // A bracket in a dialogue makes a parenthetical; brackets never double.
  const cue = typed(
    stateIn(
      [
        ["character", "ДАРЬЯН"],
        ["dialogue", ""],
      ],
      1,
    ),
    "(громче",
  );
  if (rows(cue) !== "character:ДАРЬЯН | parenthetical:громче")
    fail(`«(громче» после персонажа даёт «${rows(cue)}»`);
  const closed = typed(cue, ")");
  if (rows(closed) !== rows(cue))
    fail(`«)» в конце ремарки даёт «${rows(closed)}»`);
  const atEnd = typed(state("dialogue", "Примите жертву."), "(тихо");
  if (rows(atEnd) !== "dialogue:Примите жертву. | parenthetical:тихо")
    fail(`«(» в конце реплики даёт «${rows(atEnd)}»`);
  const opened = typed(state("parenthetical", "громче", 0), "(");
  if (rows(opened) !== "parenthetical:громче")
    fail(`«(» в начале ремарки даёт «${rows(opened)}»`);
  const name = typed(state("character", "ДАРЬЯН "), "(ЗК)");
  if (rows(name) !== "character:ДАРЬЯН (ЗК)")
    fail(`«(ЗК)» в персонаже даёт «${rows(name)}»`);
  const action = typed(state("action", "Вера "), "(");
  if (rows(action) !== "action:Вера (")
    fail(`«(» в действии даёт «${rows(action)}»`);

  // Tab or a bracket in the middle of a dialogue: dialogue, empty parenthetical, dialogue; one undo.
  const line = "Примите жертву и ответьте мне.";
  const want =
    "dialogue:Примите жертву | parenthetical: | dialogue:и ответьте мне.";
  for (const [how, split] of [
    ["Tab", (s: EditorState) => run(tab, s)],
    ["«(»", (s: EditorState) => typed(s, "(")],
  ] as const) {
    const start = stateIn([["dialogue", line]], 0, "Примите жертву".length);
    const parts = split(start);
    if (rows(parts) !== want)
      fail(`${how} в середине реплики даёт «${rows(parts)}»`);
    if (parts.selection.$from.parent.type.name !== "parenthetical")
      fail(`${how} в середине реплики: курсор не в ремарке`);
    if (undoDepth(parts) !== 1)
      fail(`${how} в середине реплики: не один шаг отмены`);
    let back = parts;
    undo(parts, (tr) => (back = parts.apply(tr)));
    if (rows(back) !== `dialogue:${line}`)
      fail(`отмена разбиения реплики даёт «${rows(back)}»`);
  }
  const tabAction = state("action", "Текст", 2);
  if (!run(tab, tabAction).doc.eq(tabAction.doc))
    fail("Tab в середине действия меняет документ");

  // Fountain: line breaks of dialogue and action as lines, two dialogues stay two.
  const fountain = docToFountain(
    toNode(
      plainDoc([
        ["character", "ВЕРА"],
        ["dialogue", "А\n\nБ"],
        ["dialogue", "В"],
        ["action", "ВЕРА\nстоит"],
        ["parenthetical", "тихо\nпочти"],
      ]),
    ),
  );
  const wantFountain =
    "ВЕРА\nА\n  \nБ\n[[@dialogue В]]\n\n!ВЕРА\nстоит\n\n[[@parenthetical тихо\nпочти]]\n";
  if (fountain !== wantFountain)
    fail(`экспорт Fountain с переносами строк: ${JSON.stringify(fountain)}`);
}

// 13. Capitals of scene headings, characters and transitions (editor-caps-placeholders-selection).
{
  const start = (rows: [ElementName, string][], index: number) => {
    const doc = toNode(plainDoc(rows));
    let pos = 0;
    for (let i = 0; i <= index; i += 1) pos += doc.child(i).nodeSize;
    return EditorState.create({
      doc,
      selection: TextSelection.create(doc, pos - 1),
      plugins: [history(), capitalsPlugin],
    });
  };
  const text = (s: EditorState, i: number) => s.doc.child(i).textContent;
  /** Typing as the view does it: one transaction per character, plugins append theirs. */
  const typing = (s: EditorState, typed: string) => {
    let next = s;
    for (const ch of typed)
      next = next.applyTransaction(next.tr.insertText(ch)).state;
    return next;
  };
  for (const [type, typed, want] of [
    [
      "sceneHeading",
      "инт. комната тримира — вечер",
      "ИНТ. КОМНАТА ТРИМИРА — ВЕЧЕР",
    ],
    ["character", "дарьян (з.к.)", "ДАРЬЯН (З.К.)"],
    ["transition", "склейка:", "СКЛЕЙКА:"],
  ] as const) {
    const before = start([[type, ""]], 0);
    const after = typing(before, typed);
    if (text(after, 0) !== want)
      fail(`заглавные в «${ELEMENTS[type].label}»: «${text(after, 0)}»`);
    if (after.selection.from !== 1 + want.length)
      fail(`заглавные в «${ELEMENTS[type].label}» сдвинули курсор`);
    let back = after;
    while (undoDepth(back) > 0) undo(back, (tr) => (back = back.apply(tr)));
    if (text(back, 0) !== "")
      fail(`отмена заглавных в «${ELEMENTS[type].label}»: «${text(back, 0)}»`);
  }
  const speech = typing(
    start(
      [
        ["character", "ДАРЬЯН"],
        ["dialogue", ""],
      ],
      1,
    ),
    "Кто тут?",
  );
  if (text(speech, 1) !== "Кто тут?")
    fail(`реплика переведена в заглавные: «${text(speech, 1)}»`);
  const pasted = start([["character", ""]], 0);
  const afterPaste = pasted.applyTransaction(
    pasted.tr.insertText("павел"),
  ).state;
  if (text(afterPaste, 0) !== "ПАВЕЛ")
    fail(`вставка в персонаж: «${text(afterPaste, 0)}»`);
  const untouched = start([["character", "дарьян"]], 0);
  const loaded = untouched.applyTransaction(
    untouched.tr.insertText(" ").setMeta("addToHistory", false),
  ).state;
  if (text(loaded, 0) !== "дарьян ")
    fail(`текст без истории переведён в заглавные: «${text(loaded, 0)}»`);
  // Ctrl+4 on a typed action: the paragraph becomes a character in capitals.
  const action = start([["action", "дарьян"]], 0);
  let cue = action;
  setElement("character")(
    action,
    (tr) => (cue = action.applyTransaction(tr).state),
  );
  if (cue.doc.child(0).type.name !== "character" || text(cue, 0) !== "ДАРЬЯН")
    fail(`Ctrl+4 по «дарьян» даёт «${text(cue, 0)}»`);
}

// Markdown of the prose editor: the examples agno/tests/test_prose.py checks for the core too.
type ProseCase = {
  name: string;
  markdown: string;
  stored?: string;
  plain?: string;
  words?: number;
  chars?: number;
  error?: string;
};
const proseCases = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../src/editor/prose/markdown.cases.json", import.meta.url),
    ),
    "utf8",
  ),
) as ProseCase[];
for (const c of proseCases) {
  if (c.error !== undefined) {
    try {
      parseProse(c.markdown);
      fail(`проза «${c.name}»: разбор прошёл, нужен отказ «${c.error}»`);
    } catch (e) {
      if (!(e instanceof ProseMarkupError) || !e.message.includes(c.error))
        fail(`проза «${c.name}»: отказ «${String(e)}», нужен «${c.error}»`);
    }
    continue;
  }
  const doc = parseProse(c.markdown);
  const stored = serializeProse(doc);
  if (stored !== (c.stored ?? c.markdown))
    fail(`проза «${c.name}»: записано ${JSON.stringify(stored)}`);
  if (serializeProse(parseProse(stored)) !== stored)
    fail(`проза «${c.name}»: повторная запись меняет текст`);
  const plain = proseText(doc);
  if (plain !== c.plain)
    fail(`проза «${c.name}»: простой текст ${JSON.stringify(plain)}`);
  if (countWords(plain) !== c.words)
    fail(`проза «${c.name}»: слов ${countWords(plain)}, нужно ${c.words}`);
  if (countChars(doc) !== c.chars)
    fail(`проза «${c.name}»: знаков ${countChars(doc)}, нужно ${c.chars}`);
}

if (failures.length > 0) {
  console.error(
    "check-editor: редакторы расходятся с openspec/specs/web/screenplay-editor и web/prose-editor:",
  );
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(
  `check-editor: ${ELEMENT_NAMES.length} типов, переходы Tab/Enter, ${Object.keys(wantKeys).length} клавиш, автоподстановка, образцы экспорта, метки цвета, сцены, скрытие, поиск, подсказки, поэпизодник, правки сцен, комментарии, предложения соавтора, копия драфтов, uid сцен, якоря предложений, зазор карточки, номера сцен, переносы строк и скобки ремарки, заглавные, заглавные, ${proseCases.length} случаев Markdown прозы — без расхождений`,
);
