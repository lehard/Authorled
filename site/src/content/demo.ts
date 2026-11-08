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
