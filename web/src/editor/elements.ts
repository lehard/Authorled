// Paragraph types of the screenplay after STARC (mockup v2, data.js TYPES and HOTKEYS).
// Schema, keys, the type list, import and export all read this one table.

export type ElementName =
  | "sceneHeading"
  | "sceneCharacters"
  | "action"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "lyrics"
  | "shot"
  | "transition"
  | "unformatted"
  | "inlineNote"
  | "beat"
  | "sequence"
  | "act";

export type Element = {
  label: string;
  /** Key of the type, shown in the list; the binding itself is in `key`. */
  shortcut: string;
  /** ProseMirror key name (always Ctrl, also on macOS: Cmd+digit switches browser tabs). */
  key: string;
  /** Tab / Enter at the end of a filled paragraph: type of the new paragraph. */
  jt: ElementName;
  je: ElementName;
  /** Tab / Enter in an empty paragraph: its new type. */
  ct: ElementName;
  ce: ElementName;
  /** Final Draft paragraph type. */
  fdx: string;
  placeholder: string;
};

export const ELEMENTS: Record<ElementName, Element> = {
  sceneHeading: {
    label: "Заголовок сцены",
    shortcut: "Ctrl+1",
    key: "Ctrl-1",
    jt: "sceneCharacters",
    je: "action",
    ct: "action",
    ce: "sceneHeading",
    fdx: "Scene Heading",
    placeholder: "ИНТ. МЕСТО — ВРЕМЯ",
  },
  sceneCharacters: {
    label: "Участники сцены",
    shortcut: "Ctrl+2",
    key: "Ctrl-2",
    jt: "action",
    je: "action",
    ct: "action",
    ce: "action",
    fdx: "Cast List",
    placeholder: "Кто в сцене",
  },
  action: {
    label: "Описание действия",
    shortcut: "Ctrl+3",
    key: "Ctrl-3",
    jt: "character",
    je: "action",
    ct: "character",
    ce: "sceneHeading",
    fdx: "Action",
    placeholder: "Что происходит",
  },
  character: {
    label: "Персонаж",
    shortcut: "Ctrl+4",
    key: "Ctrl-4",
    jt: "parenthetical",
    je: "dialogue",
    ct: "action",
    ce: "action",
    fdx: "Character",
    placeholder: "ИМЯ",
  },
  parenthetical: {
    label: "Ремарка",
    shortcut: "Ctrl+5",
    key: "Ctrl-5",
    jt: "dialogue",
    je: "dialogue",
    ct: "dialogue",
    ce: "parenthetical",
    fdx: "Parenthetical",
    placeholder: "как говорит",
  },
  dialogue: {
    label: "Реплика",
    shortcut: "Ctrl+6",
    key: "Ctrl-6",
    jt: "parenthetical",
    je: "action",
    ct: "parenthetical",
    ce: "action",
    fdx: "Dialogue",
    placeholder: "Реплика",
  },
  lyrics: {
    label: "Лирика",
    shortcut: "Ctrl+7",
    key: "Ctrl-7",
    jt: "parenthetical",
    je: "action",
    ct: "parenthetical",
    ce: "action",
    fdx: "Lyrics",
    placeholder: "Слова песни",
  },
  shot: {
    label: "Кадр",
    shortcut: "Ctrl+8",
    key: "Ctrl-8",
    jt: "action",
    je: "action",
    ct: "action",
    ce: "shot",
    fdx: "Shot",
    placeholder: "КРУПНО",
  },
  transition: {
    label: "Переход",
    shortcut: "Ctrl+9",
    key: "Ctrl-9",
    jt: "sceneHeading",
    je: "sceneHeading",
    ct: "action",
    ce: "transition",
    fdx: "Transition",
    placeholder: "СКЛЕЙКА:",
  },
  unformatted: {
    label: "Простой текст",
    shortcut: "Ctrl+0",
    key: "Ctrl-0",
    jt: "action",
    je: "unformatted",
    ct: "action",
    ce: "unformatted",
    fdx: "General",
    placeholder: "Текст",
  },
  inlineNote: {
    label: "Заметка по тексту",
    shortcut: "Ctrl+Shift+0",
    key: "Ctrl-Shift-0",
    jt: "action",
    je: "action",
    ct: "inlineNote",
    ce: "inlineNote",
    fdx: "Note",
    placeholder: "Заметка",
  },
  beat: {
    label: "Бит",
    shortcut: "Ctrl+Shift+1",
    key: "Ctrl-Shift-1",
    jt: "action",
    je: "action",
    ct: "action",
    ce: "action",
    fdx: "Beat",
    placeholder: "Что меняется в сцене",
  },
  sequence: {
    label: "Группа",
    shortcut: "Ctrl+Space",
    key: "Ctrl-Space",
    jt: "sceneHeading",
    je: "sceneHeading",
    ct: "sceneHeading",
    ce: "act",
    fdx: "Sequence",
    placeholder: "ГРУППА СЦЕН",
  },
  act: {
    label: "Акт",
    shortcut: "Ctrl+Shift+Space",
    key: "Ctrl-Shift-Space",
    jt: "sequence",
    je: "sceneHeading",
    ct: "sequence",
    ce: "act",
    fdx: "Act",
    placeholder: "АКТ",
  },
};

/** The types in the order of the list (and of Shift+Tab). */
export const ELEMENT_NAMES = Object.keys(ELEMENTS) as ElementName[];

export function isElementName(name: string): name is ElementName {
  return Object.hasOwn(ELEMENTS, name);
}

/** CSS class of a paragraph type: `pm-scene-heading` for `sceneHeading`. */
export function elementClass(name: ElementName): string {
  return `pm-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/** Colours of the author's text marks (design-system tokens --mark-1…4). */
export const MARK_COLORS = ["1", "2", "3", "4"] as const;
export type MarkColor = (typeof MARK_COLORS)[number];
