# Tasks

## 1. Плашка выделения

- [x] 1.1 В `CoauthorChat.tsx` колонка сетки над полем ввода — `minmax(0, 1fr)`, текст плашки — `min-w-0` с `truncate`. Проверка: `npm run lint --prefix web`, `npm run typecheck --prefix web`.

## 2. Проверка

- [x] 2.1 В браузере: выделить сцену в «Тексте сценария» на 1440 px и 375 px — плашка в пределах чата, текст с многоточием, «Убрать» видна и снимает выделение.
- [x] 2.2 `./scripts/validate.sh`, `git diff --check`, `openspec validate fix-chat-selection-chip --strict`; результат в `tmp/VERIFY.md`.
