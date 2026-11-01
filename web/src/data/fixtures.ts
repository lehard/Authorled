// Sample data of mockup v2 (openspec/context/_raw/design/kabinet-starc/data.js), converted
// once by a script: AI suggestions and chats are left out until their stages.
import { plainDoc, type ScreenplayDoc } from "@/editor/document.ts";

import type {
  Character,
  CommentThread,
  Draft,
  Location,
  Project,
  Script,
  Suggestion,
  World,
} from "./model";

/** Puts the comment or suggestion mark `id` on the first `quote` in the text. */
function marked(
  doc: ScreenplayDoc,
  marks: [type: "comment" | "suggestion", id: string, quote: string][],
): ScreenplayDoc {
  for (const [type, id, quote] of marks) {
    const block = doc.content.find(
      (b) =>
        "content" in b &&
        b.content?.length === 1 &&
        b.content[0].text.includes(quote),
    );
    if (block === undefined || !("content" in block) || !block.content)
      throw new Error(`В примере нет текста «${quote}» для метки ${id}.`);
    const text = block.content[0].text;
    const at = text.indexOf(quote);
    block.content = [
      { type: "text" as const, text: text.slice(0, at) },
      {
        type: "text" as const,
        text: quote,
        marks: [{ type, attrs: { id } }],
      },
      { type: "text" as const, text: text.slice(at + quote.length) },
    ].filter((t) => t.text !== "");
  }
  return doc;
}

const local = (day: number, h: number, m: number) =>
  new Date(2026, 9, day, h, m).toISOString();

export const FIXTURES: {
  projects: Project[];
  scripts: Script[];
  characters: Character[];
  locations: Location[];
  worlds: World[];
  comments: CommentThread[];
  suggestions: Suggestion[];
  drafts: Draft[];
} = {
  projects: [
    {
      id: "water",
      title: "Тихая вода",
      desc: "Дочь возвращается в посёлок у озера и узнаёт, что брат матери утонул не случайно.",
      cover: true,
      updatedAt: "2026-10-30T09:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "ferry",
      title: "Последний паром",
      desc: "Паромщик готовится к последнему рейсу перед тем, как переправу закроют.",
      cover: false,
      updatedAt: "2026-10-30T09:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "untitled",
      title: "Без названия",
      desc: "",
      cover: false,
      updatedAt: "2026-10-30T09:00:00.000Z",
      deletedAt: "2026-10-20T10:00:00.000Z",
    },
  ],
  scripts: [
    {
      id: "water",
      projectId: "water",
      name: "Тихая вода",
      tagline: "Двадцать лет никто не подходил к воде.",
      logline:
        "Аня приезжает к матери в посёлок у озера и выясняет, что гибель её дяди в 1998 году не была несчастным случаем.",
      show: {
        title: true,
        synopsis: true,
        treatment: true,
        text: true,
      },
      titlePage: {
        title: "Тихая вода",
        genre: "Полнометражный сценарий",
        author: "",
        contacts: "author@example.com",
        place: "Москва, 2026",
      },
      synopsis:
        "Аня, двадцать четыре года, впервые за долгое время приезжает к матери, Вере, в посёлок у озера. Двадцать лет назад здесь утонул Миша, младший брат Веры. С тех пор в семье об этом не говорят.\n\nДядя Коля, который в тот день был на озере, проговаривается: Миша утонул не случайно. Аня приносит эти слова домой, и Вера впервые не может промолчать.",
      text: marked(
        plainDoc([
          ["act", "Акт первый"],
          ["sceneHeading", "НАТ. ОЗЕРО, МОСТКИ — РАССВЕТ"],
          ["beat", "Миша уходит на озеро один"],
          [
            "action",
            "1998 год. Туман над водой. МИША (17) идёт по мосткам босиком, в руке удочка. Доски скрипят.",
          ],
          [
            "action",
            "Он оглядывается на дом за деревьями. В окне кухни горит свет.",
          ],
          ["transition", "Склейка:"],
          ["sceneHeading", "ИНТ. ДОМ ВЕРЫ, КУХНЯ — УТРО"],
          ["beat", "Аня звонит и говорит, что приедет"],
          [
            "action",
            "Наши дни. ВЕРА (52) режет хлеб. Радио бормочет новости. Телефон на столе вибрирует: «Аня».",
          ],
          ["character", "Вера"],
          ["dialogue", "Да, Анечка."],
          ["character", "Аня (З.К.)"],
          ["dialogue", "Мам, я приеду в пятницу. Надолго."],
          ["action", "Вера кладёт нож."],
          ["character", "Вера"],
          ["parenthetical", "тихо"],
          ["dialogue", "Приезжай."],
          ["sceneHeading", "НАТ. ПРИСТАНЬ ПОСЁЛКА — ДЕНЬ"],
          [
            "action",
            "Паром причаливает. АНЯ (24) спрыгивает на берег с рюкзаком. ДЯДЯ КОЛЯ (60) курит у будки кассы.",
          ],
          ["character", "Дядя Коля"],
          ["dialogue", "Выросла."],
          ["character", "Аня"],
          ["dialogue", "Двадцать лет прошло, дядь Коль."],
          ["action", "Коля отводит глаза к воде."],
          ["act", "Акт второй"],
          ["sceneHeading", "НАТ. ОЗЕРО, МОСТКИ — ДЕНЬ"],
          ["beat", "Аня выходит на мостки"],
          [
            "action",
            "Доски потемнели и прогнулись. АНЯ стоит на самом краю, смотрит в воду.",
          ],
          ["beat", "Не берёт трубку матери"],
          [
            "action",
            "Звонит телефон. На экране: «Мама». Аня смотрит, пока звонок не обрывается.",
          ],
          ["sceneHeading", "ИНТ. ГАРАЖ ДЯДИ КОЛИ — ВЕЧЕР"],
          [
            "action",
            "Разобранный мотор на верстаке. КОЛЯ протирает ключ ветошью. Аня садится на перевёрнутый ящик.",
          ],
          ["character", "Аня"],
          ["dialogue", "Расскажи, как это было."],
          ["character", "Дядя Коля"],
          ["parenthetical", "не поднимая головы"],
          ["dialogue", "Он утонул. Всё."],
          ["character", "Аня"],
          ["dialogue", "Мама говорит то же самое. Теми же словами."],
          ["sceneHeading", "ИНТ. ДОМ ВЕРЫ, КУХНЯ — НОЧЬ"],
          ["beat", "Вера не спит и ждёт"],
          [
            "action",
            "Свет только над раковиной. ВЕРА моет чашку. Чашка давно чистая. Она всё равно трёт её губкой.",
          ],
          ["character", "Аня (З.К.)"],
          ["dialogue", "Мам, ты опять не спишь?"],
          ["beat", "Аня приносит слова дяди"],
          [
            "action",
            "Входит АНЯ, в куртке, с рюкзаком. Ставит рюкзак на стул.",
          ],
          ["character", "Вера"],
          ["parenthetical", "не оборачиваясь"],
          ["dialogue", "Я же просила звонить, когда едешь так поздно."],
          ["character", "Аня"],
          [
            "dialogue",
            "Я была у дяди Коли. Он сказал, что Миша утонул не случайно.",
          ],
          ["action", "Вода продолжает течь. Вера закрывает кран."],
          ["sceneHeading", "НАТ. ПРИСТАНЬ — РАССВЕТ"],
          [
            "action",
            "Вера идёт по пустой пристани. Здесь она не была двадцать лет.",
          ],
        ]),
        [
          ["comment", "c1", "Я же просила звонить, когда едешь так поздно."],
          ["comment", "c2", "Он сказал, что Миша утонул не случайно."],
          [
            "suggestion",
            "s1",
            "Чашка давно чистая. Она всё равно трёт её губкой.",
          ],
          ["suggestion", "s2", "Он утонул. Всё."],
        ],
      ),
    },
    {
      id: "ferry",
      projectId: "ferry",
      name: "Последний паром",
      tagline: "",
      logline: "Паромщик везёт последних пассажиров перед закрытием переправы.",
      show: {
        title: true,
        synopsis: true,
        treatment: true,
        text: true,
      },
      titlePage: {
        title: "Последний паром",
        genre: "Полнометражный сценарий",
        author: "",
        contacts: "",
        place: "",
      },
      synopsis: "",
      text: plainDoc([
        ["sceneHeading", "НАТ. ПЕРЕПРАВА — УТРО"],
        ["action", "Река в тумане. ПАВЕЛ (60) отвязывает паром."],
      ]),
    },
    {
      id: "untitled",
      projectId: "untitled",
      name: "Без названия",
      tagline: "",
      logline: "",
      show: {
        title: true,
        synopsis: true,
        treatment: true,
        text: true,
      },
      titlePage: {
        title: "Без названия",
        genre: "Полнометражный сценарий",
        author: "",
        contacts: "",
        place: "",
      },
      synopsis: "",
      text: plainDoc([["sceneHeading", ""]]),
    },
  ],
  characters: [
    {
      id: "vera",
      projectId: "water",
      name: "Вера",
      one: "Мать Ани; двадцать лет молчит о гибели брата.",
      long: "Держит дом в порядке, будто порядок может что-то исправить. Говорит коротко, о прошлом — никогда.",
      ext: {
        fear: "Что Аня узнает правду и уйдёт.",
        speech: "Короткие фразы, вопросы отвечает вопросом.",
      },
      deletedAt: null,
      role: "main",
      age: "52",
      gender: "f",
    },
    {
      id: "anya",
      projectId: "water",
      name: "Аня",
      one: "Дочь Веры; приехала надолго и не знает зачем.",
      long: "Живёт в городе, работает звукорежиссёром. Привыкла задавать вопросы, на которые дома не отвечают.",
      ext: {},
      deletedAt: null,
      role: "main",
      age: "24",
      gender: "f",
    },
    {
      id: "kolya",
      projectId: "water",
      name: "Дядя Коля",
      one: "Деверь Веры; был на озере в тот день.",
      long: "",
      ext: {},
      deletedAt: null,
      role: "secondary",
      age: "60",
      gender: "m",
    },
    {
      id: "misha",
      projectId: "water",
      name: "Миша",
      one: "Младший брат Веры, утонул в 1998 году.",
      long: "",
      ext: {},
      deletedAt: null,
      role: "secondary",
      age: "17",
      gender: "m",
    },
    {
      id: "nina",
      projectId: "water",
      name: "Нина",
      one: "Соседка Веры.",
      long: "",
      ext: {},
      deletedAt: "2026-10-29T18:00:00.000Z",
      role: "episodic",
      age: "",
      gender: "f",
    },
    {
      id: "pavel",
      projectId: "ferry",
      name: "Павел",
      one: "Паромщик.",
      long: "",
      ext: {},
      deletedAt: null,
      role: "main",
      age: "60",
      gender: "m",
    },
  ],
  locations: [
    {
      id: "lake",
      projectId: "water",
      name: "Озеро, мостки",
      one: "Тёмная вода и доски, на которых Миша стоял в последний раз.",
      long: "",
      ext: {},
      deletedAt: null,
      role: "main",
    },
    {
      id: "kitchen",
      projectId: "water",
      name: "Дом Веры, кухня",
      one: "Кухня со светом над раковиной.",
      long: "",
      ext: {},
      deletedAt: null,
      role: "main",
    },
    {
      id: "pier",
      projectId: "water",
      name: "Пристань посёлка",
      one: "Сюда приходит паром, отсюда уезжают.",
      long: "",
      ext: {},
      deletedAt: null,
      role: "secondary",
    },
    {
      id: "garage",
      projectId: "water",
      name: "Гараж дяди Коли",
      one: "Всё разобрано, ничего не собрано.",
      long: "",
      ext: {},
      deletedAt: null,
      role: "secondary",
    },
    {
      id: "pier2",
      projectId: "water",
      name: "Пристань",
      one: "",
      long: "",
      ext: {},
      deletedAt: null,
      role: "episodic",
    },
    {
      id: "cross",
      projectId: "ferry",
      name: "Переправа",
      one: "",
      long: "",
      ext: {},
      deletedAt: null,
      role: "main",
    },
  ],
  worlds: [
    {
      id: "village",
      projectId: "water",
      name: "Посёлок у озера",
      one: "Все всё помнят, но вслух не говорят.",
      long: "На озеро не ходят отдыхать — только по делу или по горю. Новости приходят через магазин и пристань.",
      ext: {},
      deletedAt: null,
      overview: "",
    },
  ],
  // Threads of the editor of mockup v2; the author's reply «Вы» stays out: samples know no user.
  comments: [
    {
      id: "c1",
      projectId: "water",
      author: "Ирина Белова",
      email: "irina@example.com",
      role: "редактор",
      at: local(30, 18, 40),
      text: "Для первой ночи Вера слишком резкая. Может, она сначала спросит, ела ли Аня?",
      replies: [],
      resolved: false,
    },
    {
      id: "c2",
      projectId: "water",
      author: "Ирина Белова",
      email: "irina@example.com",
      role: "редактор",
      at: local(31, 8, 15),
      text: "Сильная реплика. Не слишком ли рано раскрываем — это же середина второго акта?",
      replies: [],
      resolved: false,
    },
  ],
  // Suggestions of the co-author from mockup v2; their places are marks in the text above.
  suggestions: [
    {
      id: "s1",
      projectId: "water",
      at: local(31, 9, 12),
      why: "Короче на строку, а действие остаётся: видно, что Вера тянет время, чтобы не оборачиваться.",
      text: "Чашка давно чистая — Вера всё равно её трёт.",
      status: "open",
      decidedAt: null,
    },
    {
      id: "s2",
      projectId: "water",
      at: local(31, 9, 12),
      why: "Без «Он» Коля говорит так же отрывисто, как Вера, — это подхватывает следующую реплику Ани «Теми же словами».",
      text: "Утонул. Всё.",
      status: "open",
      decidedAt: null,
    },
  ],
  // Mockup v2 has no drafts: the first one is the author's.
  drafts: [],
};
