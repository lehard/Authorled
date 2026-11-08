// Prepared answers of the sandbox «Спросите соавтора» (openspec/specs/web/site). No model is called.
// The first two follow what the co-author does in the beta (a real answer about contradictions, the real
// suggestion on scene 5); the third needs the future timeline and is marked as a concept.

/** A link of an answer to a quoted line of the sandbox fragment: scene 5 (Kolya) or scene 6 (Anya). */
export type SceneLink = { label: string; line: "kolya" | "anya" };

export type SandboxAnswer = {
  id: string;
  question: string;
  concept: boolean;
  paragraphs: string[];
  /** Links to the scenes the answer speaks of, shown once it is typed out (design D1 of site-coauthor-examples). */
  links?: SceneLink[];
};

export const ANSWERS: SandboxAnswer[] = [
  {
    id: "contradictions",
    question: "Проверь, нет ли противоречий",
    concept: false,
    paragraphs: [
      "Нашёл три места.",
      "1. Сцена 5: Коля говорит «Он утонул. Всё.», а в сцене 6 Аня пересказывает его иначе: «Он сказал, что Миша утонул не случайно». Если Аня додумывает — дайте в сцене 5 намёк: паузу или взгляд. Иначе читатель примет это за ошибку.",
      "2. В сценах 2 и 6 Аня помечена «(З.К.)», но в сцене 6 она входит на кухню раньше своей реплики. Пометьте иначе, например «(из коридора)».",
      "3. Коле 60, в 1998-м ему было 32 — «сорок лет чинит моторы» сходится.",
      "Что из этого задумано?",
    ],
    links: [
      { label: "Сц. 5", line: "kolya" },
      { label: "Сц. 6", line: "anya" },
    ],
  },
  {
    id: "shorten",
    question: "Сократи реплику Коли",
    concept: false,
    paragraphs: [
      "Предлагаю правку в сцене 5: «Он утонул. Всё.» → «Утонул. Всё.»",
      "Без «Он» Коля говорит так же отрывисто, как Вера, — это подхватывает следующую реплику Ани «Теми же словами».",
      "Правка ждёт вашего решения: текст изменится, только если вы её примете.",
    ],
  },
  {
    id: "viewer",
    question: "Что знает зритель к сцене 14?",
    concept: true,
    paragraphs: [
      "К сцене 14 зритель знает: Миша утонул в 1998-м, Вера двадцать лет молчит, у Коли есть фото с озера.",
      "Аня по тексту сцены 14 уже знает правду о брате — раньше, чем задумано в «Скелетной карте», где это сцена 20. Дуга обрывается: в сценах 15–19 ей нечего узнавать.",
      "Можно сдвинуть разговор к сцене 20 или оставить и перестроить её дугу. Решать вам.",
    ],
  },
];
