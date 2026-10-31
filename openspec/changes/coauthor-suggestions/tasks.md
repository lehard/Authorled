# Tasks

## 1. Редактор

- [x] 1.1 Метка `suggestion` (`id`, `inclusive: false`) в схеме и `MarkJSON`; запись в `ORIGIN.md` (решение 1). Проверка: `npm run check:editor --prefix web` — метка в JSON, Fountain и FDX со старым текстом.
- [x] 1.2 Команды без DOM `acceptSuggestion`, `rejectSuggestion`, места предложений, защита `filterTransaction`; поиск пропускает открытые предложения (решения 3, 4). Проверка: `check:editor` — правка внутри отклоняется, граница и удаление абзаца проходят, «Принять» отменяется ⌘Z, «Отклонить» вне истории.
- [x] 1.3 Плагин с декорациями было/стало, активным и кликом; методы `ScreenplayEditorView` (`setSuggestions`, `acceptSuggestion`, `rejectSuggestion`, `suggestionAnchor`, `scrollToSuggestion`, `selectSuggestion`), места в снимке; проп `suggestions` обёртки; стили на токенах `--ai`, `--ai-subtle`, `--deco-delete` (решения 2, 8). Проверка: `./web/scripts/check_web_tokens.sh`.

## 2. Данные

- [x] 2.1 Модель предложения, ресурс `suggestions` в `fixtures` с каскадным удалением истории, примеры `s1`, `s2` с метками в тексте «Тихой воды», `useSuggestions` (решение 5). Проверка: `npm run typecheck --prefix web`.

## 3. Экран

- [x] 3.1 `cardPlace.ts` из `useEditorComments`; `useEditorSuggestions` и карточка предложения; одна открытая карточка на `TextDoc` (решение 6).
- [x] 3.2 Кнопка обхода с числом и неактивное состояние (решение 7); «Обсудить в чате» и `openChat` в контексте окна истории (решение 8). Проверка: `npm run check:native-ui --prefix web`.

## 4. Документы и проверка

- [x] 4.1 ADR-004: предложения — метка на убираемом тексте, данные отдельно, создание агентом — с ядром; строка в `openspec/TODO.md`.
- [x] 4.2 Ручная проверка в Chrome, 1440 px и 375 px, светлая и тёмная темы: два предложения в тексте, правка внутри не проходит, карточка по клику, «Принять» и ⌘Z, «Отклонить», обход и счётчик, неактивная кнопка без предложений, «Обсудить в чате» (широкий и узкий экран), карточка комментария закрывает карточку предложения, экспорт Fountain до решения, перестановка сцены с предложением. Ошибок в консоли нет.
- [x] 4.3 `./scripts/validate.sh`, `git diff --check`, `openspec validate coauthor-suggestions --strict`; результаты и ограничения в `tmp/VERIFY.md`.
