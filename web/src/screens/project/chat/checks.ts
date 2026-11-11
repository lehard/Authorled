/**
 * Checks of the mentor (openspec/specs/web/workspace, «Проверки наставника»): the label of a
 * button and the request that goes to the co-author as the author's message. One list for the
 * empty conversation, «Проверки» at the field and «Соавтор» in the selection menu.
 * `quick_prompts` of the co-author in agno/app/config.yaml repeat the requests word for word.
 */
export type Check = { id: string; label: string; request: string };

export const ABOUT_STORY = "О чём эта история?";

/**
 * The start of a request for a research brief («Исследовать тему» of the empty conversation and
 * «Исследование» of the notes, openspec/specs/web/workspace): it goes into the field, the author
 * adds the topic and sends it.
 */
export const RESEARCH_START =
  "Помоги составить задание на исследование для Deep Research. Тема: ";

export const CHECKS: readonly Check[] = [
  {
    id: "water",
    label: "Где «вода»?",
    request:
      "Где здесь вода? Назови одно–три места, которые можно сократить без потери смысла, и спроси меня о них.",
  },
  {
    id: "want",
    label: "Чего хочет герой?",
    request:
      "Чего хочет герой в этой сцене и что ему мешает? Покажи, где это видно в тексте, а где не хватает.",
  },
  {
    id: "pace",
    label: "Темп",
    request:
      "Не провисает ли здесь темп? Назови места, где затянуто, и спроси меня, что в них важно.",
  },
  {
    id: "voices",
    label: "Голоса",
    request:
      "Звучат ли реплики как разные люди? Найди места, где герои говорят одинаково.",
  },
  {
    id: "tone",
    label: "Тон",
    request: "Какой тон здесь, по-твоему, задуман? Где текст из него выпадает?",
  },
  {
    id: "conflict",
    label: "Конфликт",
    request: "Чего здесь не хватает для конфликта? Где противостояние слабеет?",
  },
  {
    id: "show",
    label: "Показано или рассказано",
    request:
      "Где здесь показано, а где рассказано? Назови места, где герои или ремарки объясняют то, что можно показать.",
  },
  {
    id: "contradictions",
    label: "Противоречия",
    request:
      "Нет ли здесь противоречий с другими документами истории: персонажами, локациями, миром, синопсисом?",
  },
];
