# Tasks

## 1. Ядро и API

- [x] 1.1 Миграция `agno/migrations/versions/0017_drop_note_research.py` и `notes` без `research` в `agno/core/tables.py`; убрать признак из `agno/core/notes.py` и `agno/app/api/schemas.py` (design, решение 5). Тесты: таблицы совпадают с базой, `0017` на базе с `0016` убирает столбец и оставляет заметку, `_undo_*` в `test_migrations.py`, `research` в `POST` и `PATCH` даёт `422` как неизвестное поле, столбцы заметок без `research`. Проверить `./scripts/dev.sh test`.

## 2. Соавтор

- [x] 2.1 Убрать `create_research_brief` и `BRIEF_MAX_CHARS` из `agno/agents/coauthor_tools.py` и `CHANGING_TOOLS`, из `records.py` и `actions.py` замера; просьбы `research-*` в `actions.toml` — `expect = "none"`, набор не прогонять. Поправить тесты `test_coauthor_tools.py` и `test_coauthor_actions.py`. Проверить `./scripts/dev.sh test`.
- [x] 2.2 Переписать раздел «Задание на исследование» и справку о сервисе в `agno/skills/coauthor/SKILL.md` (design, решение 8). Проверить загрузку промпта тестом.

## 3. Фронтенд

- [x] 3.1 Убрать `research` из `Note` и `readNote`, `fixturesProvider`; удалить `docs/ResearchHead.tsx` и его место в `NoteDoc.tsx`; убрать `create_research_brief` из `chat/actions.ts`, `confirmations.ts` и переход в `CoauthorChat.tsx`. `NewNote.body` и `add(title, body)` (design, решение 3). Проверить `npm run typecheck` и `eslint`.
- [x] 3.2 Сделать `chat/ResearchBlock.tsx` и подключить через `components.pre` в `Markdown` ответа; «Сохранить в заметки» через `add` (design, решения 2–3). Проверить `./scripts/validate.sh` (сборка, токены).
- [x] 3.3 Перенести `outcomes` в `ChatRunsContext` (`chatRuns.ts`, `CoauthorProvider.tsx`, `CoauthorChat.tsx`) и значки `allowed` / `denied` в `ActionLines.tsx` (design, решения 6–7). Проверить `npm run typecheck`.

## 4. Проверка

- [x] 4.1 На локальном стенде в браузере, глазами, без замеров:
  - «паромщики в 90-е»: уточнение, после ответа — блок задания без «Разрешить» и без заметки;
  - «Развернуть целиком» и «Свернуть»;
  - «Скопировать» даёт текст целиком;
  - ссылки без текста в адресе;
  - «Сохранить в заметки» создаёт заметку и ведёт к ней;
  - блок после перезагрузки и смены ширины на месте;
  - персонаж в режиме «Сам», сужение до шторки и обратно — строка «Создан персонаж …» на месте;
  - «Разрешено» с галочкой и «Отклонено» с перечёркнутым кругом.

  Итог в `tmp/VERIFY.md`.
- [x] 4.2 `./scripts/validate.sh`, `./scripts/dev.sh test` и `git diff --check` проходят.

## Workflow follow-up

- Verify, архив со сверкой спек, merge `origin/main`, проверки, PR и merge — по `AGENTS.md`, «OpenSpec is mandatory», шаг 4.
