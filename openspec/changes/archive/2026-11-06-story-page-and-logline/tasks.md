# Tasks

## 1. Ядро и миграция

- [x] 1.1 `agno/core/fields.py`: убрать `tagline` из `ScriptFields`, добавить `logline: bool` в `ScriptParts`. Проверка: новые тесты в `agno/tests/test_stories_core.py` на `422` с именами `tagline` и `show.logline`.
- [x] 1.2 `agno/core/projects.py` и `agno/core/documents.py`: `create_project` пишет имя «Сценарий», `update_document` отказывает в правке `name` у `script`. Обновить ожидания имени в `test_drafts.py` и `test_stories_core.py`, добавить тест отказа. Проверка: `./scripts/dev.sh test`.
- [x] 1.3 Написать `agno/migrations/versions/0007_script_fields.py` по решению 3 в `design.md`: документы, снимки `fields`, точки драфтов. Проверка: тест в `agno/tests/test_migrations.py` ставит ревизию `0006_drafts_and_saves`, вставляет сценарий, снимок, точку и персонажа старой формы, применяет `head` и проверяет сценарии «Новой формы полей сценария», включая откат и сохранение логлайна.

## 2. Данные фронтенда и демо-контент

- [x] 2.1 `web/src/data/model.ts`: `SCRIPT_PARTS` с `logline` перед `synopsis`, `Script` без `name` и `tagline`. Обновить `apiProvider.ts` (`toScript`, `scriptChanges`, ключ `logline` в `ALL_PARTS`), `fixturesProvider.ts` и `storyActions.ts`. Проверка: `npm run typecheck --prefix web` падает только на экранах из группы 3.
- [x] 2.2 `web/src/data/demo.json` и `agno/demo/load.py` по решению 10. Проверка: `agno/tests/test_demo.py` через `./scripts/dev.sh test`.

## 3. Экраны

- [x] 3.1 `web/src/screens/project/docRef.ts`, `docTitle.ts`, `docs/DocView.tsx`: без `sp`, с частью `logline`. Проверка: `/p/<id>/sp` показывает «Не найдено», адрес `logline` открывается.
- [x] 3.2 `SynopsisDoc.tsx` → `ProseDoc`, «Логлайн» и «Синопсис» на нём, в обоих есть история сохранений. Проверка: в браузере логлайн сохраняется, свой в каждом драфте, в запертом драфте только чтение.
- [x] 3.3 `combineStatus` рядом с `useAutosave`; `InfoDoc.tsx` собирает страницу из решения 8 с подписью и подсказкой тэглайна; удалить `ScriptDoc.tsx`. Проверка: в браузере правки истории и галочек дают «Сохранено», конфликт одной из сущностей показывается, под замком закрыты только галочки.
- [x] 3.4 `Navigator.tsx`: без строки истории, папка «Сценарий» по решению 5, значок части, выделение шапки в `workspace.css`. Проверка: в браузере сценарии «Шапка открывает историю», «Папка только раскрывается», «Папка не зависит от названия истории».
- [x] 3.5 `docs/TextDoc.tsx`: имя файла экспорта из названия истории; `chat/docContext.ts` по решению 9. Проверка: экспорт из истории «Маяк» называется по ней, чат на «Истории» и «Логлайне» видит их содержимое.

## 4. Документация

- [x] 4.1 ADR-006 («Документы»): логлайн в частях сценария; `openspec/context/02-domain-glossary.md`: термины «Логлайн» и «Тэглайн». Проверка: `git diff --check`.

## 5. Итоговая проверка

- [x] 5.1 Применить миграцию к локальной базе (`./scripts/dev.sh migrate`) и проверить в браузере с источником `api` «Белую дачу»: логлайн на месте, откат к старому снимку и следующее сохранение проходят; полка показывает тэглайн. Проверить запросом, что `tagline` нет в документах, снимках и точках.
- [x] 5.2 В браузере с источником `fixtures` страница истории, логлайн и полка работают на узком и широком экране, в светлой, сепии и тёмной темах.
- [x] 5.3 `./scripts/validate.sh`, `./scripts/dev.sh test` и `git diff --check` проходят; результаты и ограничения записаны в `tmp/VERIFY.md`.
