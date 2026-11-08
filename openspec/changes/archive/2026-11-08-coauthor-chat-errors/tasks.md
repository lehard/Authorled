# Tasks

## 1. Разбор ошибки запуска

- [x] 1.1 Добавить `web/src/screens/project/chat/runError.ts` без импортов времени выполнения: `readRunError(message, rawEvent)` → `refusal` (текст и тон) для причин `usage_limit_reached` (`notice`), `subscription_ended`, `usage_check_failed`, `usage_record_failed` (`error`) или `failure` для всего остального; константы `UNAVAILABLE` и `NO_CONNECTION` (design, решение 1)
- [x] 1.2 В `runOrThrow` (`CoauthorChat.tsx`) хранить итог `RUN_ERROR` отдельно от ошибки `onRunFailed`; `RUN_ERROR` важнее; `refusal` → `ChatError(text, null, tone)`, `failure` → `ChatError(UNAVAILABLE)`; полное событие и ошибку не из `ChatError` писать в `console.error`; не `ChatError` из `onRunFailed` → `ChatError(UNAVAILABLE)`; убрать `limitReason` и шаблон «Соавтор не смог ответить: …» (design, решение 2)
- [x] 1.3 В `osFetch` (`chat/api.ts`) при сбое `fetch` бросать `ChatError(NO_CONNECTION)` без причины в скобках, причину писать в `console.error` (design, решение 3)
- [x] 1.4 В `runOrThrow` ловить отказ самого `copilotkit.runAgent` (CopilotKit 1.79.1 пробрасывает ошибку `detachActiveRun`) и разбирать его как ошибку `onRunFailed`: `ChatError` как есть, иначе `console.error` и `ChatError(UNAVAILABLE)`; найдено при `/opsx:verify`, правку одобрил владелец 2026-11-08 (design, решение 2)

## 2. Проверка

- [x] 2.1 Дополнить `web/scripts/check-chat.ts` образцами `RUN_ERROR` из design (решение 4), включая текст исключения LiteLLM от 2026-11-08, и проверкой, что `UNAVAILABLE` и `NO_CONNECTION` не содержат LiteLLM, DeepSeek и Agno; убедиться, что скрипт падает, если `readRunError` вернёт `refusal` для неизвестной причины
- [x] 2.2 Пройти `./scripts/validate.sh` и `git diff --check`
- [x] 2.3 Живая проверка на локальном стенде: сбой модели (пока баланс DeepSeek нулевой — как есть; иначе только с согласия владельца на перезапуск LiteLLM с неверным ключом) → «Соавтор сейчас недоступен. Попробуйте позже.», текст в поле, полный текст в консоли и `Error in Agent run` в логе API; остановленный API (только с согласия владельца) или отключённая сеть в браузере → «Нет связи с сервером…» без скобок; исчерпанный лимит → сообщение о лимите уведомлением; записать результат в `tmp/VERIFY.md`. Выполнено подменой ответа API в браузере: к проверке баланс DeepSeek был пополнен, владелец 2026-11-08 засчитал подмену вместо перезапуска LiteLLM (`tmp/VERIFY.md`, «coauthor-chat-errors: локальная проверка»)
- [x] 2.4 Перенести дельту в мастер-спеку `web/workspace` («Чат с соавтором»)

## Workflow follow-up

- `/opsx:verify` и `/opsx:archive` запускает владелец.
- Выкатка релизом после слияния, затем проверка текста сбоя на `app.soavtor.app`.
