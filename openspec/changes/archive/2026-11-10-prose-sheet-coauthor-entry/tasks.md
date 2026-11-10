# Tasks

## 1. Причина поломки листа

- [x] 1.1 Диагноз по design, решение 1: в Safari 18.6 на `app.soavtor.app` (Web Inspector) снять совпавшие и зачёркнутые правила и вычисленные `width`, `padding`, `margin` у `div.sheet.sheet-prose`, проверить загрузку чанка `document-*.css`; воспроизвести в Safari на `npm run dev --prefix web` и на `npm run build && npm run preview --prefix web`. Проверка: причина с доказательством (правило, строка CSS, снимок Inspector) записана в `tmp/VERIFY.md`; если правка нужна вне Scope proposal — остановиться и попросить `/opsx:update`
- [x] 1.2 Устранить причину в файлах из Scope (`workspace.css`, `ProseDoc.tsx`, `TitleDoc.tsx`, `DocView.tsx`), без запасных правил. Проверка: в Safari и Chrome на 1400 px лист «Логлайн» 760 px по центру, текст в 72 px от левого и 64 px от верхнего края, при наборе не меняется; на 375 px поля 32/20 px без горизонтальной прокрутки; «Титульная страница» с полями `.sheet-title`. Скриншоты Safari и Chrome — в `tmp/VERIFY.md`

Итог 1.1–1.2: причина — порядок слоёв (`document-*.css` подключается раньше `index-*.css`, `components` оказывается ниже `base`). В `main` её одновременно закрыл PR lehard/Authorled#62 (объявление слоёв в `web/index.html`, требование «Порядок слоёв CSS» в `web/design-system`); своя строка в `workspace.css` снята как дубль, проверка в Safari — на сборке с `main`.

## 2. Вход соавтора

- [x] 2.1 `web/src/screens/project/chat/docTasks.ts`: поле `onSheet` у `DocTask` по design, решение 2; тексты просьб не меняются. Проверка: `npm run lint --prefix web` и `npm run typecheck --prefix web` проходят, `git diff` не трогает строки `request`
- [x] 2.2 `DocTasksMenu.tsx`: общий выбор задачи (design, решение 3) и залитая кнопка `variant="default"`, `rounded-full` (design, решение 5). Проверка вживую: меню по-прежнему отправляет задачи, «Под заявку» ставит начало просьбы в поле без сообщения; кнопка залита в светлой и тёмной теме, статус и история без заливки
- [x] 2.3 `ProseDoc.tsx`: кнопки задач на пустом листе по design, решение 4. Проверка вживую по сценариям «Пустой синопсис», «Под заявку с листа», «Автор начал писать», «Запертый драфт» требования «Задачи соавтора на пустом листе»: клик в пустое место листа ставит курсор в поле; во время ответа соавтора кнопки недоступны; на 375 px без горизонтальной прокрутки. Скриншоты — в `tmp/VERIFY.md`

## 3. Справка соавтора

- [x] 3.1 `agno/skills/coauthor/SKILL.md`: строка о задачах на пустом листе (design, решение 6). Проверка: `agents.prompts.agent_prompt("coauthor")` содержит строку, API из этого worktree стартует

## 4. Проверки

- [x] 4.1 `./scripts/validate.sh` (через `env -u BASH_ENV`) и `git diff --check` проходят; `npm run build --prefix web` и `./web/scripts/check_web_tokens.sh` проходят. Итог — в `tmp/VERIFY.md`

## Workflow follow-up

- Verify, archive, merge `origin/main`, PR и merge по `CLAUDE.md` («OpenSpec is mandatory», шаг 4).
- После релиза: владелец проверяет лист в своём Safari на проде.
