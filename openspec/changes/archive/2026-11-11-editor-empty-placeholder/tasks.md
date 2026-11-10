# Tasks

## 1. Метка пустого абзаца

- [x] 1.1 Плагин `web/src/editor/plugins/emptyParagraphs.ts` (`emptyParagraphs(doc)`, `emptyParagraphsPlugin`) по решению 1, подключить в `web/src/editor/index.ts`. Проверка: `check:editor` — позиции пустых абзацев, абзац «текст\n» не пустой, после набора метка уходит.
- [x] 1.2 `web/src/editor/styles.css`: правила подсказок на `.pw-empty`, заголовок сцены тоже; из `plugins/sceneNumbers.ts` убрать `pw-empty-heading` (решения 2–3). Проверка: `check:editor` — в стилях нет `br:only-child` и `pw-empty-heading`; в Chrome Shift+Enter в конце действия не показывает подсказку, пустые абзацы всех 14 типов и пустой заголовок сцены с номерами показывают.

## 2. Перед слиянием

- [x] 2.1 `./scripts/validate.sh` (agno/.venv, `env -u BASH_ENV`), `npm run check:editor --prefix web`, `git diff --check`. Проверка: результаты в `verification.md` change.

## Workflow follow-up

- Verify, archive, merge `origin/main`, PR и merge — по `AGENTS.md`, «OpenSpec is mandatory», шаг 4.
