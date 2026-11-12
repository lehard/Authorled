# Tasks

## 1. Диалог

- [x] 1.1 `web/src/screens/project/docs/ImportSkipped.tsx`: `AlertDialog` вместо плавающего блока по design (решения 1–4): заголовок «Часть проекта не перенеслась», строка «Текст сценария импортирован. В файле STARC не было:», группы с числом и именами в столбик в прокручиваемом блоке, абзац причины, кнопка «Понятно»; контракт `{ skipped, onClose }` прежний. Проверка: `npm run build --prefix web`, `./web/scripts/check_web_tokens.sh`.
- [x] 1.2 `web/src/screens/project/docs/TextDoc.tsx`: показ диалога без условия `error === null`. Проверка: 1.3.
- [x] 1.3 Проверка в браузере на локальном стенде (API и Vite worktree): история из облачного файла владельца — затемнение, диалог с «Сценарии (9)» и «Локации (1)» в столбик; клик мимо окна не закрывает; «Понятно» и Esc закрывают; после перезагрузки диалога нет; импорт того же файла в редакторе — тот же диалог; полный `project.starc` — без диалога; ширина 390 px — список прокручивается, «Понятно» видна. Итог и снимок — в `tmp/VERIFY.md`.

## 2. Проверки

- [x] 2.1 `./scripts/validate.sh` (через `env -u BASH_ENV`), `git diff --check` и `openspec validate starc-skipped-dialog` проходят.

## Workflow follow-up

- Verify, archive, merge `origin/main`, проверки, PR и merge — по AGENTS.md, «OpenSpec is mandatory», шаг 4.
