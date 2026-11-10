# Tasks

## 1. Подсказки пустых абзацев

- [x] 1.1 В `web/src/editor/styles.css` у правила подсказки `top: 0`, для бита `left: 12px`, для перехода `left: auto; right: 0`, для акта `right: 0; text-align: center` (design, решение 1). Проверка: в Chrome у пустых абзацев всех 14 типов подсказка на строке курсора и с той же стороны, что курсор; `./web/scripts/check_web_tokens.sh` проходит.

## 2. Заглавные при наборе

- [x] 2.1 Плагин `web/src/editor/plugins/capitals.ts` по решению 2, подключить в `web/src/editor/index.ts`. Проверка: `check:editor` — набор «инт. комната тримира — вечер», «дарьян (з.к.)», «склейка:» даёт заглавные, вставка в персонаж тоже, реплика как набрана, одна отмена возвращает абзац, транзакция `addToHistory: false` не меняется, курсор на месте.

## 3. Плашка выделения

- [x] 3.1 В `web/src/screens/project/chat/useSelectionIn.ts` сбрасывать фрагмент, когда его нет в тексте `[data-chat-source]` (design, решение 3). Проверка: в Chrome выделить «Река в тумане» и удалить — плашка исчезает; выделить и щёлкнуть в поле чата — плашка остаётся; открыть другой документ — плашка исчезает.

## 4. Перед слиянием

- [x] 4.1 `./scripts/validate.sh` (agno/.venv, `env -u BASH_ENV`), `npm run check:editor --prefix web`, `git diff --check`. Проверка: результаты в `verification.md` change.

## Workflow follow-up

- Verify, archive, merge `origin/main`, PR и merge — по `AGENTS.md`, «OpenSpec is mandatory», шаг 4.
