// Profile fields of characters, locations and worlds, after the STARC models
// (mockup v2, data.js PROFILE and ROLES).
import type { EntityKind, Role } from "./model";

export type ProfileSection = {
  title: string;
  fields: { key: string; label: string }[];
};

export const PROFILE: Record<EntityKind, ProfileSection[]> = {
  char: [
    {
      title: "Внешность",
      fields: [
        {
          key: "height",
          label: "Рост",
        },
        {
          key: "body",
          label: "Телосложение",
        },
        {
          key: "hair",
          label: "Волосы",
        },
        {
          key: "eyes",
          label: "Глаза",
        },
        {
          key: "feature",
          label: "Особые приметы",
        },
        {
          key: "dress",
          label: "Как одевается",
        },
      ],
    },
    {
      title: "Личность",
      fields: [
        {
          key: "personality",
          label: "Характер",
        },
        {
          key: "strength",
          label: "Сильные стороны",
        },
        {
          key: "weakness",
          label: "Слабости",
        },
        {
          key: "habits",
          label: "Привычки",
        },
        {
          key: "speech",
          label: "Как говорит",
        },
        {
          key: "fear",
          label: "Главный страх",
        },
      ],
    },
    {
      title: "Прошлое",
      fields: [
        {
          key: "childhood",
          label: "Детство",
        },
        {
          key: "pastEvent",
          label: "Важное событие в прошлом",
        },
        {
          key: "secrets",
          label: "Секреты",
        },
        {
          key: "bestMemory",
          label: "Лучшее воспоминание",
        },
        {
          key: "worstMemory",
          label: "Худшее воспоминание",
        },
      ],
    },
    {
      title: "Цели и перемены",
      fields: [
        {
          key: "shortGoal",
          label: "Ближайшая цель",
        },
        {
          key: "longGoal",
          label: "Главная цель",
        },
        {
          key: "beliefsStart",
          label: "Во что верит в начале",
        },
        {
          key: "beliefsEnd",
          label: "Во что верит в конце",
        },
        {
          key: "change",
          label: "Что ведёт к перемене",
        },
      ],
    },
    {
      title: "В сюжете",
      fields: [
        {
          key: "firstAppearance",
          label: "Первое появление",
        },
        {
          key: "plot",
          label: "Участие в сюжете",
        },
        {
          key: "conflict",
          label: "Конфликт",
        },
        {
          key: "definingMoment",
          label: "Определяющий момент",
        },
      ],
    },
    {
      title: "Быт",
      fields: [
        {
          key: "residence",
          label: "Где живёт",
        },
        {
          key: "job",
          label: "Работа",
        },
        {
          key: "income",
          label: "Доход",
        },
        {
          key: "hobbies",
          label: "Увлечения",
        },
      ],
    },
  ],
  loc: [
    {
      title: "Ощущения",
      fields: [
        {
          key: "sight",
          label: "Что видно",
        },
        {
          key: "sound",
          label: "Что слышно",
        },
        {
          key: "smell",
          label: "Чем пахнет",
        },
        {
          key: "touch",
          label: "На ощупь",
        },
        {
          key: "taste",
          label: "Вкус",
        },
      ],
    },
    {
      title: "Место",
      fields: [
        {
          key: "climate",
          label: "Климат",
        },
        {
          key: "landmark",
          label: "Ориентиры",
        },
        {
          key: "nearby",
          label: "Что рядом",
        },
        {
          key: "history",
          label: "История места",
        },
        {
          key: "soundstage",
          label: "Павильон или натура",
        },
      ],
    },
  ],
  world: [
    {
      title: "Природа",
      fields: [
        {
          key: "geography",
          label: "География",
        },
        {
          key: "climates",
          label: "Климат",
        },
        {
          key: "flora",
          label: "Растения",
        },
        {
          key: "animals",
          label: "Животные",
        },
        {
          key: "resources",
          label: "Природные ресурсы",
        },
      ],
    },
    {
      title: "Общество",
      fields: [
        {
          key: "races",
          label: "Народы",
        },
        {
          key: "languages",
          label: "Языки",
        },
        {
          key: "religions",
          label: "Религии",
        },
        {
          key: "education",
          label: "Образование",
        },
        {
          key: "ethics",
          label: "Нравы",
        },
      ],
    },
    {
      title: "Власть",
      fields: [
        {
          key: "government",
          label: "Устройство власти",
        },
        {
          key: "laws",
          label: "Законы",
        },
        {
          key: "wars",
          label: "Войны и конфликты",
        },
      ],
    },
    {
      title: "Экономика",
      fields: [
        {
          key: "currency",
          label: "Деньги",
        },
        {
          key: "trade",
          label: "Торговля",
        },
        {
          key: "industry",
          label: "Промышленность",
        },
      ],
    },
    {
      title: "Технологии и магия",
      fields: [
        {
          key: "technology",
          label: "Технологии",
        },
        {
          key: "magic",
          label: "Магия",
        },
        {
          key: "whoCanUse",
          label: "Кто может пользоваться",
        },
      ],
    },
  ],
};

/** Roles in the order of the groups of a list; `group` names the group of the list (web/workspace). */
export const ROLES: Record<
  "char" | "loc",
  { value: Role; label: string; group: string }[]
> = {
  char: [
    {
      value: "main",
      label: "Главный",
      group: "Главные",
    },
    {
      value: "secondary",
      label: "Второстепенный",
      group: "Второстепенные",
    },
    {
      value: "episodic",
      label: "Эпизодический",
      group: "Эпизодические",
    },
  ],
  loc: [
    {
      value: "main",
      label: "Основная",
      group: "Основные",
    },
    {
      value: "secondary",
      label: "Второстепенная",
      group: "Второстепенные",
    },
    {
      value: "episodic",
      label: "Эпизодическая",
      group: "Эпизодические",
    },
  ],
};
