## Why

После Shift+Enter в конце абзаца подсказка типа ложится поверх его текста и остаётся, пока абзац кончается переносом (v0.3.16–v0.3.17). Стили угадывают пустоту абзаца по разметке `br:only-child`, а ProseMirror ставит такой же служебный `<br>` и после переноса в конце текста. Пустоту решают три механизма: эти стили, класс `pw-empty-heading` номеров сцен и плагин редактора прозы. Интент: `business-intents/editor-empty-placeholder.md`.

## What Changes

- Новый плагин редактора сценария помечает классом `pw-empty` каждый текстовый абзац без содержимого.
- Правила подсказок в `web/src/editor/styles.css` переходят с `:has(> br:only-child)` на `.pw-empty`; заголовок сцены тоже, `pw-empty-heading` уходит из плагина номеров сцен.
- `check-editor` проверяет метку и отсутствие правил по `br:only-child`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `web/screenplay-editor`: «Подсказка пустого абзаца» — подсказка только у абзаца без текста, в том числе не у абзаца, который кончается переносом строки.

## Impact

- `web/src/editor/plugins/emptyParagraphs.ts` (новый), `web/src/editor/index.ts`, `web/src/editor/styles.css`, `web/src/editor/plugins/sceneNumbers.ts`, `web/scripts/check-editor.ts`.
- Ядро, API и экспорт не меняются.
