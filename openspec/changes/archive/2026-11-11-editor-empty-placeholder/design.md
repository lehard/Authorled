## Context

Подсказка пустого абзаца — `::after` (у заголовка сцены `::before`, его `::after` занят номером) с `content: attr(data-placeholder)`. Атрибут стоит на каждом абзаце из схемы, а показ решал селектор `p[data-placeholder]:has(> br:only-child)`: у пустого текстового блока ProseMirror рисует только `<br class="ProseMirror-trailingBreak">`. С переносами строк (`whitespace: "pre"`, `editor-line-break-parenthetical`) тот же `<br>` появляется после текста, который кончается на `\n`, а текстовые узлы для `:only-child` не считаются. Пустой заголовок сцены уже помечался по документу (`pw-empty-heading`), потому что левый номер — его дочерний виджет.

## Goals / Non-Goals

**Goals:** один источник пустоты абзаца — документ; подсказки всех типов по одной метке; проверка без DOM.

**Non-Goals:** редактор прозы, вид и положение подсказок, срезание переноса в конце.

## Decisions

1. **Плагин `emptyParagraphsPlugin`** (`web/src/editor/plugins/emptyParagraphs.ts`): состояние — `DecorationSet` из `Decoration.node(pos, pos + size, { class: "pw-empty" })` для каждого текстового блока с `content.size === 0`; пересчёт при `docChanged`, иначе `map`. Чистая функция `emptyParagraphs(doc): number[]` даёт позиции и проверяется в Node. Так же устроены номера сцен; альтернатива — `nodeViews` для абзацев — заменила бы отрисовку всех 14 типов ради одного класса.
2. **Стили**: все правила подсказок `p[data-placeholder]:has(> br:only-child)` → `p.pw-empty[data-placeholder]`; заголовок сцены `p.pm-scene-heading.pw-empty[data-placeholder]::before`, а общее правило `::after` исключает заголовок (`:not(.pm-scene-heading)`), как раньше его исключал виджет номера.
3. **Номера сцен** больше не ставят `pw-empty-heading`; `sceneHeadings().empty` остаётся данными для проверки нумерации.

## Risks / Trade-offs

- Перебор абзацев при каждой правке → та же цена, что у номеров сцен.
- Два `Decoration.node` на одном абзаце (номер сцены и метка) → ProseMirror сливает атрибуты, класс и `data-scene-number` оба остаются; проверяется в браузере.
