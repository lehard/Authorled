// Deterministic check of the screenplay editor without a browser (openspec/specs/web/screenplay-editor,
// design of fork-screenplay-editor, decision 12): Tab/Enter against the TYPES table of mockup v2,
// the type keys, scene-heading autoreplace, the Fountain round trip, paragraphs(), colour and comment marks.
// FDX import and printing need DOMParser and a window; they are checked by hand.
//
// Usage: npm run check:editor --prefix web
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { history, undo, undoDepth } from "prosemirror-history";
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
import { docToFDX } from "../src/editor/exporters/fdx.ts";
import { docToFountain } from "../src/editor/exporters/fountain.ts";
import { fountainToDoc } from "../src/editor/importers/fountain.ts";
import {
  ELEMENT_KEYS,
  enter,
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
      JSON.stringify({ alt: "", day: "", color: null, tags: [] })
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

if (failures.length > 0) {
  console.error(
    "check-editor: редактор сценария расходится с openspec/specs/web/screenplay-editor:",
  );
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(
  `check-editor: ${ELEMENT_NAMES.length} типов, переходы Tab/Enter, ${Object.keys(wantKeys).length} клавиш, автоподстановка, круг Fountain, метки цвета, сцены, скрытие, поиск, подсказки, поэпизодник, правки сцен, комментарии и предложения соавтора — без расхождений`,
);
