# Tasks

## 1. Порядок слоёв CSS

- [x] 1.1 В `web/index.html` первым элементом стилей в `<head>` добавить `<style>` с `@layer properties, theme, base, components, utilities;` и комментарием со ссылкой на требование «Порядок слоёв CSS». Проверка: в собранном `web/dist/index.html` объявление стоит раньше всех `<link rel="stylesheet">`.
- [x] 1.2 В `web/scripts/check-bundle.mjs` добавить проверку `dist/index.html`. Она падает с сообщением при отсутствии объявления, при объявлении после первой таблицы стилей и при расхождении списка слоёв с порядком их первого появления в CSS входа из манифеста. Проверка: `npm run build --prefix web` проходит, а с временно убранным объявлением падает с этим сообщением.

## 2. Узор обложки

- [x] 2.1 В `web/src/data/model.ts` рядом с палитрой добавить `COVER_PATTERNS` (4 варианта) и чистую `coverPattern(id)`: FNV-1a по `id`, остаток от числа вариантов, пустой `id` — `throw`. Проверка: `npm run typecheck --prefix web`; для двух известных `id` демо-историй одного цвета варианты разные (записать их в `tmp/VERIFY.md`).
- [x] 2.2 В `web/src/screens/workspace.css` описать варианты узора `[data-pattern="0".."3"]` для `.book` и `.book-mini` на `::before` и `::after`: размеры в процентах, цвет `--cover-fg`. Убрать у `.book` отступы и типографику названия. Проверка: `./web/scripts/check_web_tokens.sh` проходит, сырых цветов нет.

## 3. Полка, навигатор, витрина

- [x] 3.1 В `web/src/screens/shelf/ShelfScreen.tsx` сделать обложку пустой (`aria-hidden`, `data-pattern={coverPattern(p.id)}`). Название, мета-строка и логлайн остаются только под обложкой. Проверка: на полке название каждой истории встречается на карточке один раз.
- [x] 3.2 У карточки «Новая история» в `ShelfScreen.tsx` убрать подпись «Полнометражный сценарий». Проверка: под пунктирной рамкой только «Новая история».
- [x] 3.3 В `web/src/screens/project/Navigator.tsx` передать маленькой обложке `data-pattern={coverPattern(project.id)}`. Проверка: в навигаторе тот же вариант узора, что у этой истории на полке.
- [x] 3.4 В `web/src/showcase/Showcase.tsx` показать шесть обложек без текста с названием цвета под каждой и четыре варианта узора на одном цвете. Обновить комментарий о цвете рисунка в `web/scripts/check-contrast.ts`. Проверка: `/showcase` в трёх темах, `npm run check:contrast --prefix web` проходит.

## 4. Ядро и API

- [x] 4.1 `agno/core/projects.py`: `create_project(..., cover_color=None)` — без значения круг, иначе `_cover_color` (`Invalid` с полем `cover_color`); публичная `next_cover_color(connection, owner_id)` поверх `_next_cover_color`. `agno/core/imports.py`: `create_project_from_file` передаёт `cover_color`. Проверка: тесты ядра в `agno/tests/test_stories_core.py` и `test_import_routes.py` — выбранный цвет, цвет вне палитры, круг продолжается после выбранного цвета, рукопись с цветом.
- [x] 4.2 `agno/app/api/stories.py`: `cover_color` в JSON и multipart `POST /api/v1/projects` (и в `openapi_extra`), маршрут `GET /api/v1/projects/next-cover-color` до маршрутов с `{project_id}`, схема ответа в `schemas.py`. Проверка: тесты маршрутов в `agno/tests/test_story_routes.py` — сценарии «Цвет при создании» и «Цвет новой истории» (первая история, после бирюзовой в корзине, совпадает с созданием), `./scripts/dev.sh test` проходит.

## 5. Выбор цвета во фронтенде

- [x] 5.1 Данные: `cover_color` в создании истории (`apiProvider.create`, `files.createFromFile`), ресурс `next-cover-color` в `apiProvider` и `fixturesProvider` (`nextCoverColor` по историям примера), хук `useNextCoverColor` в `hooks.ts`, цвет в `createStory` (`storyActions.ts`). Проверка: `npm run typecheck --prefix web`.
- [x] 5.2 Компонент `CoverColorPicker` в `web/src/screens/shared/`: маленькая обложка с узором и шесть образцов-радиокнопок с названиями цветов. Проверка: `npm run check:native-ui --prefix web` проходит (без системных радиокнопок), `check_web_tokens.sh` проходит.
- [x] 5.3 `InfoDoc.tsx`: поле «Цвет обложки» после «Тэглайн», сохранение через `story.save({ coverColor })`. Проверка: в браузере выбор «Сливовый» даёт «Сохранено» и сливовую обложку в навигаторе.
- [x] 5.4 `NewStoryDialog.tsx`: ряд «Цвет обложки» между «Название» и «Каркас»; отмечен цвет ядра; при ошибке — причина у ряда и требование выбрать цвет; цвет уходит в `onSubmit`. Проверка: в браузере отмечен цвет ядра, история создаётся выбранного цвета, в том числе из рукописи.
- [x] 5.5 Кнопка «⋯» на карточке полки видна всегда, приглушённо. Проверка: на широком экране без наведения кнопка видна у каждой карточки.

## 6. Проверка

- [x] 6.1 `./scripts/validate.sh` и `git diff --check` проходят.
- [x] 6.2 Проверка в браузере на собранном фронтенде (`vite preview` или стенд), не только в dev, в светлой, сепии и тёмной темах, на ширине 1280 и 375 px: у обложек на полке видны дуги, текста на обложке нет, сетка ровная. В навигаторе у пунктов есть отступы, маленькая обложка с тем же узором. Страница и чат окна истории выглядят как в dev. Выбор цвета на странице «История» и в диалоге новой истории (в том числе отказ `next-cover-color`), кнопка «⋯» видна. Результаты и скриншоты записать в `tmp/VERIFY.md`.

## Workflow follow-up

- Verify, archive со синхронизацией спек `api/stories`, `web/workspace` и `web/design-system`, merge `origin/main`, PR в `main` (правила `CLAUDE.md`, «OpenSpec is mandatory», п. 4).
- После релиза проверить полку на `app.soavtor.app`: у обложек есть дуги, у навигатора отступы.
