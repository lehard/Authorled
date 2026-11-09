# Tasks

## 1. Цвет обложки в ядре

- [x] 1.1 В `agno/core/projects.py` добавить кортеж `COVER_COLORS` (`blue`, `teal`, `amber`, `crimson`, `plum`, `graphite`), в `agno/core/tables.py` — колонку `cover_color` (`Text`, `nullable=False`, без `server_default`) и `CheckConstraint` `cover_color_known` из этого кортежа (design, решения 1–2). Проверка: `./scripts/dev.sh test` после задачи 1.2 — `test_tables_match_the_database` проходит.
- [x] 1.2 Миграция `agno/migrations/versions/0013_story_cover_colors.py` (`alembic revision --rev-id 0013_story_cover_colors` из `agno/`, написать руками): колонка без `NOT NULL`, заполнение по кругу палитры по каждому `owner_id` в порядке `created_at, id`, затем `NOT NULL` и `CHECK`; `downgrade` — `NotImplementedError` (design, «Migration Plan»). Проверка: тест в `agno/tests/test_migrations.py` по образцу `test_notes_migration_keeps_stories` — две истории одного автора и одна другого без колонки на версии `0012_coauthor_feedback` получают `blue`, `teal` и `blue`; `./scripts/validate.sh` видит одну голову.
- [x] 1.3 В `Project` добавить `cover_color`; в `create_project` вставлять `created_at = clock_timestamp()` и цвет, следующий за цветом последней созданной истории автора (корзина включена), у первой — `blue` (design, решения 3–4). Проверка: тесты в `agno/tests/test_stories_core.py` — три истории подряд `blue`, `teal`, `amber`; после `graphite` — `blue`; после цвета, выбранного автором (`plum`), — `graphite`; у другого автора — `blue`; история в корзине тоже считается; история из `create_project_from_file` получает следующий цвет.
- [x] 1.4 `update_project` принимает `cover_color` со значением из `COVER_COLORS`, иначе `Invalid` с полем `cover_color`; `updated_at` меняется, только если среди изменений есть `title` или `description`; сообщение «Передайте …» называет и `cover_color` (design, решение 5). Проверка: тесты в `test_stories_core.py` — смена цвета не меняет `updated_at`, `pink` даёт `Invalid` по `cover_color` и история не меняется, смена названия вместе с цветом меняет `updated_at`.

## 2. Маршруты историй

- [x] 2.1 В `agno/app/api/schemas.py` добавить `cover_color` в `ProjectOut`; обновить `summary` маршрута `PATCH /projects/{project_id}` в `agno/app/api/stories.py` (design, решение 6). Проверка: тесты в `agno/tests/test_story_routes.py` — `GET /api/v1/projects` и ответ `POST /api/v1/projects` содержат `cover_color`; `PATCH` с `{"cover_color": "amber"}` отвечает `200` с новым цветом и прежним `updated_at`; `PATCH` с `pink` и `POST` с `cover_color` отвечают `422` в `application/problem+json` с `cover_color` в `detail`.

## 3. Демо-данные

- [x] 3.1 В `web/src/data/demo.json` заменить `cover` на `coverColor` («Тихая вода» `blue`, «Последний паром» `teal`, «Без названия» `amber`); в `agno/demo/load.py` после `create_project` ставить цвет через `update_project` до отправки истории в корзину (design, решение 7). Проверка: тест в `agno/tests/test_demo.py` — после загрузки демо у историй цвета из `demo.json`.

## 4. Палитра обложек в дизайн-системе

- [x] 4.1 В `web/src/design-system/tokens.css` задать для светлой темы, сепии и тёмной токены `--cover-<c>-from`, `--cover-<c>-to`, `--cover-<c>-foreground` для шести цветов на шагах шкал `blue`, `teal`, `amber`, `crimson`, `plum`, `neutral` (design, решение 8). Проверка: `./web/scripts/check_web_tokens.sh` проходит.
- [x] 4.2 В `web/scripts/check-contrast.ts` добавить пары `--cover-<c>-foreground` на `--cover-<c>-from` и на `--cover-<c>-to` для каждого цвета (4,5:1). Проверка: `npm run check:contrast --prefix web` проходит во всех темах; временная порча точки янтарной обложки в тёмной теме роняет проверку с именем темы и пары (порчу откатить).
- [x] 4.3 На витрине `web/src/showcase/Showcase.tsx` раздел «Обложки» с шестью обложками и названием (design, решение 12). Проверка: в браузере `/showcase` в трёх темах — шесть обложек в цветах темы.

## 5. Обложки на экранах

- [x] 5.1 В `web/src/data/model.ts` — тип `CoverColor`, список `COVER_COLORS` с подписями («Синий», «Бирюзовый», «Янтарный», «Малиновый», «Сливовый», «Графит»); `Project.cover` заменить на `coverColor`. В `apiProvider.ts` `readProject` читает и проверяет `cover_color`, незнакомое значение — ошибка; `update` переводит `coverColor` в `cover_color`. В `fixturesProvider.ts` — следующий цвет у новой истории и без смены `updatedAt` при смене только цвета (design, решение 10). Проверка: `./scripts/validate.sh` (сборка и типы `web/`) проходит.
- [x] 5.2 В `web/src/screens/workspace.css` перевести `.book` и `.book-mini` на переменные цвета с правилами `[data-cover="<c>"]`, дуги — от цвета названия, классы `.art` убрать; `ShelfScreen.tsx` и `Navigator.tsx` ставят `data-cover` (design, решение 9). Проверка: в браузере на источнике `api` у всех демо-историй цветные обложки на полке и в навигаторе, серых нет. Итог (владелец, 2026-11-09): проверено в браузере на источнике `fixtures`; источник `api` в браузере заменён тестами маршрутов, потому что до слияния миграция `0013` на общей базе `ai` сломала бы создание историй у API из `main`; проверка на `api` — на локальном стенде после слияния.
- [x] 5.3 В меню карточки на полке подменю «Цвет обложки» с шестью образцами (`DropdownMenuRadioGroup`, текущий отмечен) и `setCoverColor` в `web/src/screens/shelf/storyActions.ts` (design, решение 11). Проверка: в браузере на источнике `api` выбор «Янтарный» у второй карточки меняет обложку, карточка остаётся второй, после перезагрузки цвет тот же, в навигаторе обложка янтарная; на источнике `fixtures` — то же без перезагрузки. Итог (владелец, 2026-11-09): проверено в браузере на источнике `fixtures`; источник `api` в браузере заменён тестами маршрутов, потому что до слияния миграция `0013` на общей базе `ai` сломала бы создание историй у API из `main`; проверка на `api` — на локальном стенде после слияния.

## 6. Проверка целиком

- [x] 6.1 Пройти в браузере сценарии требований «Цветная обложка истории» и «Цвет обложки на полке» в светлой теме, сепии и тёмной, на широком и узком экране; создать на полке новую историю и убедиться, что её цвет следующий после последней. Проверка: результаты и снимки записаны в `tmp/VERIFY.md`, отдельно deterministic и браузер. Итог: на источнике `fixtures`, результаты в `tmp/VERIFY.md`; меню карточки получило ширину по содержимому.
- [x] 6.2 Выполнить `./scripts/validate.sh`, `./scripts/dev.sh test` и `git diff --check`. Проверка: все проходят; итог в `tmp/VERIFY.md`.

## Workflow follow-up

- Verify, archive, слияние `origin/main`, проверки, PR и merge — по правилу «Finish in the same session» из `AGENTS.md`.
