# Tasks

## 1. Разбор результата

- [x] 1.1 Добавить `web/src/screens/project/chat/outcome.ts` с `readOutcome(content)` → `done` / `refused` (текст JSON-строки) / `unreadable` (невалидный JSON, число, массив, объект без `done` и `target`), без импортов времени выполнения (design, решение 1)
- [x] 1.2 Перевести `doneOf` и `changedResources` в `actions.ts` на `readOutcome`, не меняя их вызовы (design, решение 2)
- [x] 1.3 В `Outcome` (`ActionLines.tsx`) показывать «сделано» со ссылкой, как сейчас, отказ — красной строкой с текстом, нечитаемый результат — красной строкой «Не удалось прочитать результат действия» с `console.error` сырого `content` и id вызова (design, решение 3)

## 2. Проверка

- [x] 2.1 Добавить `web/scripts/check-chat.ts` с образцами из design (решение 4) и комментарием про `to_json_str` Agno 3.1.10, скрипт `check:chat` в `web/package.json` и шаг `check:chat` в цикл фронтенда `scripts/validate.sh`; проверить, что скрипт падает, если `readOutcome` вернёт для отказа сырой текст
- [x] 2.2 Перенести дельту в мастер-спеку `web/workspace` («Сделанное соавтором в чате»)
- [x] 2.3 Пройти `./scripts/validate.sh` и `git diff --check`; на локальном стенде вызвать отказ ядра в чате (например, персонаж с несуществующей ролью или правка на запертом драфте) и убедиться, что строка показывает «Отказ: …» читаемым текстом; записать результат в `tmp/VERIFY.md`

## Workflow follow-up

- `/opsx:verify` и `/opsx:archive` запускает владелец.
- Выкатка релизом после слияния, затем проверка строки отказа на `app.soavtor.app`.
