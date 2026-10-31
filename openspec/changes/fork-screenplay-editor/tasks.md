# Tasks

## 1. Перенос исходников

- [ ] 1.1 Скопировать `src/` из `plotwell-ai/plotwell-editor` (коммит `880f369`) в `web/src/editor/` без `importers/tiptap.ts` и `demo/`; положить `LICENSE` и `ORIGIN.md` (решение 1). В `web/package.json` и `package-lock.json` добавить пакеты ProseMirror точными версиями (последние, вышедшие больше двух недель назад): `prosemirror-commands`, `-history`, `-inputrules`, `-keymap`, `-model`, `-state`, `-transform`, `-view`. Проверка: `npm ci --prefix web` проходит, `@plotwell/editor` в `package.json` нет.
- [ ] 1.2 Привести код к настройкам `web/`: `import type`, без `any` в экспортах (`extraPlugins: Plugin[]`), без неиспользуемого, удалить ссылку на plotwell.co и флаг `attribution`. Проверка: `npm run typecheck --prefix web` и `npm run lint --prefix web` проходят без новых исключений в `eslint.config.js`.

## 2. Типы абзацев и клавиши

- [ ] 2.1 Таблица `ELEMENTS` (решение 2) и схема на 14 типов + `pageBreak`; стили каждого типа в `styles.css`. Проверка: `npm run build --prefix web` проходит.
- [ ] 2.2 Модуль клавиш (решение 3): Enter, Tab, Shift+Tab, Backspace по таблице; Ctrl+0…9, Ctrl+Shift+0/1, Ctrl+Space, Ctrl+Shift+Space; Mod+B/I/U, отмена, повтор. Автоподстановка заголовка сцены для «ИНТ.», «НАТ.», «ИНТ./НАТ.», «INT.», «EXT.», «INT./EXT.».
- [ ] 2.3 `web/scripts/check-editor.ts` и команда `check:editor` (решение 12): переходы всех 14 типов против `TYPES` макета v2, клавиши, автоподстановка. Добавить `check:editor` в цикл шагов `scripts/validate.sh`. Проверка: `npm run check:editor --prefix web` проходит; при подменённом переходе в `ELEMENTS` падает с названием типа.

## 3. Метки цвета

- [ ] 3.1 `tokens.css`: `--mark-1…4` и `--mark-1-fill…4-fill` для всех тем (решение 5); `check-contrast.ts`: пары и проверка оттенка против `--ai`. Проверка: `npm run check:contrast --prefix web` проходит; при `--mark-1` на шкале `plum` падает с названием темы и токена.
- [ ] 3.2 Метки `textColor` и `highlight`, команды назначить и снять, пункты в меню выделения (решение 4). В `check-editor.ts` — метка цвета попадает в JSON документа и снимается, не трогая жирный. Проверка: `npm run check:editor --prefix web`.

## 4. Импорт, экспорт, печать

- [ ] 4.1 Fountain по таблице решения 6, FDX по типам абзацев; импорт строит документ целиком и бросает `ImportError` с причиной (решение 7). В `check-editor.ts` — круг Fountain для документа из 14 типов. Проверка: `npm run check:editor --prefix web`.
- [ ] 4.2 Печать (решение 8): без `@import` Google Fonts, Cousine из сборки, титульная страница с полями `title`, `genre`, `author`, `contacts`, `place`; заблокированное окно печати — ошибка с текстом. Проверка: `grep -rn "googleapis\|plotwell.co" web/src` пуст.

## 5. Оформление, язык, React

- [ ] 5.1 `styles.css` на переменных `--pw-*`, связанных с токенами; удалить `pw-dark` и `darkMode` (решение 9); русские строки в значке типа, списке и меню (решение 10). Проверка: `./web/scripts/check_web_tokens.sh` проходит.
- [ ] 5.2 `ScreenplayEditor.tsx` (решение 11) и раздел «Редактор сценария» на витрине: пример из макета v2 «Тихая вода» со всеми 14 типами и меткой цвета.

## 6. Документы и итоговая проверка

- [ ] 6.1 ADR-004: форк в `web/src/editor/` вместо npm-пакета, дата обновления; строка про редактор в `openspec/context/03-architecture.md`.
- [ ] 6.2 Ручная проверка на витрине в Chrome, светлая и тёмная темы: набор сцены Tab/Enter и Ctrl+цифрами, автоподстановка «НАТ.», цвет и заливка с переключением темы, круг FDX (экспорт → импорт), битый FDX (ошибка, документ цел), печать с титульной страницей и без внешних запросов (вкладка сети), один экземпляр редактора в StrictMode, пагинация документа длиннее трёх страниц. Ошибок в консоли нет.
- [ ] 6.3 `./scripts/validate.sh` и `git diff --check` проходят; `openspec validate fork-screenplay-editor --strict` проходит. Результаты и ограничения (Firefox, Safari, IME, экранные дикторы не проверены) — в `tmp/VERIFY.md`.
