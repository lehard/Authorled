# Tasks

## 1. Ядро и API

- [x] 1.1 Добавить столбец `research` (JSONB, необязательный, проверка «объект или NULL») в `notes` в `agno/core/tables.py` и миграцию `agno/migrations/versions/0016_note_research.py`. Проверить `./scripts/dev.sh test`: тесты миграций (одна голова, таблицы совпадают с базой), вставка не-объекта отклоняется, старые заметки получают `NULL`.
- [x] 1.2 Добавить `NoteResearch` и `Note.research` в `agno/core/notes.py`, `create_research_note` и чтение признака в `_note`; `NoteResearchOut` и `NoteOut.research` в `agno/app/api/schemas.py`. Проверить тестами: заметка-задание в списке с `research`, обычная — `null`; `POST` и `PATCH` с полем `research` дают `422`; переименование не меняет `research`; чужая история — отказ, как у заметок.

## 2. Соавтор

- [x] 2.1 `create_research_brief` в `agno/agents/coauthor_tools.py` создаёт заметку через `create_research_note` с `screenplay` и `note_ids`; описание инструмента — по каркасу. Проверить `agno/tests/test_coauthor_tools.py`: `research` сохранён, отказы прежние.
- [x] 2.2 Переписать раздел «Задание на исследование» и справку о сервисе в `agno/skills/coauthor/SKILL.md` (design, решение 8). Проверить загрузку промпта тестом промптов.
- [x] 2.3 Переписать просьбы `research-*` в `agno/evals/coauthor/actions.toml` (design, решение 9); набор не прогонять. Проверить `test_release_set_loads`.

## 3. Фронтенд

- [x] 3.1 Добавить `research` в модель `Note` (`web/src/data/model.ts`), чтение в `readNote` (`apiProvider.ts`) и `research: null` в `fixturesProvider.ts`. Проверить `npm run typecheck`.
- [x] 3.2 Сделать `web/src/screens/project/docs/ResearchHead.tsx` (design, решение 7) и показать его в `NoteDoc.tsx` у заметки с `research`; копирование — текущий текст поля. Удалить `chat/ResearchCard.tsx` и особый случай в `ActionLines.tsx`. Проверить `./scripts/validate.sh` (сборка, токены).
- [x] 3.3 Открывать заметку задания после сделанного `create_research_brief` в живом ходе (`CoauthorChat.tsx`, design, решение 6). Проверить `npm run typecheck` и `eslint`.

## 4. Проверка

- [x] 4.1 На локальном стенде в браузере, глазами, без замеров:
  - «Последний паром», просьба про паромщиков в 90-е — соавтор уточняет;
  - после ответа — задание по каркасу, заметка открылась, плашка на месте, в чате одна строка;
  - правка текста и «Скопировать задание» — в буфере текст с правкой;
  - переименование — плашка на месте;
  - вложение в корзине — «Вложения нет»;
  - просьба «Русь XV века, обычаи» — уточнение, затем задание для мира книги или предложение разбить;
  - смена ширины окна и перезагрузка — заметка и плашка на месте.

  Итог и тексты двух заданий кратко записать в `tmp/VERIFY.md`.
- [x] 4.2 `./scripts/validate.sh`, `./scripts/dev.sh test` и `git diff --check` проходят.

## Workflow follow-up

- Verify, архив со сверкой спек, merge `origin/main`, проверки, PR и merge — по `AGENTS.md`, «OpenSpec is mandatory», шаг 4.
