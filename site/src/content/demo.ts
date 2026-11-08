// Scene 5 of the demo story «Тихая вода» and the co-author's suggestion in it, as the beta shows them
// (web/src/data/demo.json, suggestion on scene `water-5`). Copied by hand: the site does not import web/src/data.

export type ScriptLine =
  | { kind: "heading"; text: string }
  | { kind: "action"; text: string }
  | { kind: "character"; text: string }
  | { kind: "parenthetical"; text: string }
  | { kind: "dialogue"; text: string };

export const SCENE: ScriptLine[] = [
  { kind: "heading", text: "ИНТ. ГАРАЖ ДЯДИ КОЛИ — ВЕЧЕР" },
  {
    kind: "action",
    text: "Разобранный мотор на верстаке. КОЛЯ протирает ключ ветошью. Аня садится на перевёрнутый ящик.",
  },
  { kind: "character", text: "АНЯ" },
  { kind: "dialogue", text: "Расскажи, как это было." },
  { kind: "character", text: "ДЯДЯ КОЛЯ" },
  { kind: "parenthetical", text: "(не поднимая головы)" },
];

export const SUGGESTION = {
  before: "Он утонул. Всё.",
  after: "Утонул. Всё.",
  why: "Без «Он» Коля говорит так же отрывисто, как Вера, — это подхватывает следующую реплику Ани «Теми же словами».",
};

export const AFTER: ScriptLine[] = [
  { kind: "character", text: "АНЯ" },
  { kind: "dialogue", text: "Мама говорит то же самое. Теми же словами." },
];

/**
 * The contradiction of the first screen (design D1, D4): Kolya's line in scene 5 and how Anya retells it in scene 6
 * of the draft `water-1`, word for word. The sandbox answer «Проверь, нет ли противоречий» points at the same pair.
 */
export const CONTRADICTION = {
  first: {
    number: 5,
    place: "Гараж",
    character: "КОЛЯ",
    line: "Он утонул. Всё.",
  },
  second: {
    number: 6,
    place: "Кухня",
    character: "АНЯ",
    line: "Он сказал, что Миша утонул не случайно.",
  },
  note: "Коля такого не говорил. Задумано?",
};

/**
 * Scene 6 of the draft `water-1`, shortened for the sandbox fragment (design D2 of site-coauthor-examples): its heading
 * and Anya's line about Kolya. `quote` is the part the scene link lights up; it is also the line of the first screen.
 */
export const SCENE_6 = {
  heading: "ИНТ. ДОМ ВЕРЫ, КУХНЯ — НОЧЬ",
  character: "АНЯ",
  lead: "Я была у дяди Коли.",
  quote: CONTRADICTION.second.line,
};

/**
 * Quotes of the «one action» cards under the beta tabs (design D3 of site-coauthor-examples), word for word from
 * `web/src/data/demo.json`, draft `water-1`: Misha's short goal from his card, suggestion `s1` in scene 6 and an action
 * line of scene 4. None of them is quoted by the first screen.
 */
export const ONE_ACTION_QUOTES = {
  mishaGoal: "Уехать из посёлка до конца лета.",
  suggestion: {
    scene: 6,
    before: "Чашка давно чистая. Она всё равно трёт её губкой.",
    after: "Чашка давно чистая — Вера всё равно её трёт.",
    /** The first half of the `why` of `s1`: the card has room for one short reason. */
    why: "Короче на строку, а действие остаётся.",
  },
  comment: {
    scene: 4,
    quote: "Аня смотрит, пока звонок не обрывается.",
  },
};

/**
 * Uncle Kolya's card next to the vision phrase (design D4 of site-coauthor-examples): facts from his card in
 * `demo.json`, with the scene of draft `water-1` where the text shows them (scene 3: «Коля отводит глаза к воде» at the
 * pier; scene 5: «(не поднимая головы)»). A fact only from the card has no scene.
 */
export const KOLYA = {
  name: "Дядя Коля",
  age: 60,
  role: "Деверь Веры",
  facts: [
    { text: "Был на озере в тот день", scene: null },
    { text: "К воде подходит только на пристани", scene: 3 },
    { text: "Отвечает в сторону", scene: 5 },
  ],
} as const;
