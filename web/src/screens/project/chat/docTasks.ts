/**
 * Tasks of «Соавтор» in the head of «Логлайн» and «Синопсис» (openspec/specs/web/workspace, «Логлайн и
 * синопсис с соавтором»): the label of an item and the request that goes to the co-author as the author's
 * message. `writes`: the task ends in the document of the draft, so a locked draft does not show it.
 * `fill`: the request is put into the field of the chat, the author finishes and sends it.
 * `onSheet`: the task writes a text, so an empty sheet of the unlocked document offers it too
 * («Задачи соавтора на пустом листе»); the checks have nothing to check there.
 * agno/evals/coauthor/doc_tasks.py repeats the requests word for word.
 */
export type DocTask = {
  id: string;
  label: string;
  request: string;
  writes: boolean;
  fill: boolean;
  onSheet: boolean;
};

export const DOC_TASKS: Record<"logline" | "synopsis", readonly DocTask[]> = {
  logline: [
    {
      id: "logline-variants",
      label: "Предложить варианты",
      request:
        "Предложи три варианта логлайна для этой истории: герой, его цель, главное препятствие и ставки, до 35 слов каждый. Опирайся на сценарий и документы драфта. Ничего не записывай, пока я не выберу.",
      writes: true,
      fill: false,
      onSheet: true,
    },
    {
      id: "logline-check",
      label: "Проверить мой логлайн",
      request:
        "Проверь мой логлайн: видно ли в нём героя, его цель, препятствие и ставки? Скажи, чего не хватает, и спроси меня об этом. Не переписывай его за меня.",
      writes: false,
      fill: false,
      onSheet: false,
    },
  ],
  synopsis: [
    {
      id: "synopsis-page",
      label: "Написать на страницу",
      request:
        "Напиши синопсис этой истории на страницу, до 400 слов: завязка, ключевые повороты и финал. Опирайся на сценарий и документы драфта. Покажи его здесь и предложи записать в синопсис драфта.",
      writes: true,
      fill: false,
      onSheet: true,
    },
    {
      id: "synopsis-short",
      label: "Коротко: абзац",
      request:
        "Напиши короткий синопсис этой истории: один абзац до 120 слов, с финалом. Покажи его здесь и предложи сохранить заметкой «Синопсис: абзац».",
      writes: false,
      fill: false,
      onSheet: true,
    },
    {
      id: "synopsis-viewer",
      label: "Для зрителя: без финала",
      request:
        "Напиши аннотацию этой истории для зрителя: 50–100 слов, без финала и главного поворота. Покажи её здесь и предложи сохранить заметкой «Синопсис: для зрителя».",
      writes: false,
      fill: false,
      onSheet: true,
    },
    {
      id: "synopsis-application",
      label: "Под заявку",
      request: "Напиши синопсис под заявку. Требования: ",
      writes: false,
      fill: true,
      onSheet: true,
    },
    {
      id: "synopsis-check",
      label: "Проверить мой синопсис",
      request:
        "Проверь мой синопсис: понятны ли завязка, ключевые повороты и финал, нет ли оценок вместо событий? Назови одно–три места и спроси меня о них. Не переписывай его за меня.",
      writes: false,
      fill: false,
      onSheet: false,
    },
  ],
};
