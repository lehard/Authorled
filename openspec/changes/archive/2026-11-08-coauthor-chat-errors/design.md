# Design

## Context

Мотив: proposal.md, «Why».

Как ошибка запуска соавтора попадает в чат сейчас:

- Agno 3.1.10 при исключении в запуске пишет в лог API `Error in Agent run: <текст>` (`agno/agent/_run.py`, `log_error`) и шлёт событие `RunErrorEvent` с `content = str(e)`, `error_type` и `additional_data`. AG-UI (`on_run_error` в `agno/os/interfaces/agui/handlers.py`) превращает его в `RUN_ERROR` с `message = content`, `code = error_type` и `rawEvent` = всё событие Agno. Исключение вне запуска агента роутер AG-UI логирует (`Error running entity: …`) и шлёт `RUN_ERROR` только с `message = str(e)`, без `rawEvent`.
- Отказы продукта приходят из хуков соавтора (`agno/agents/coauthor_usage.py`) как `InputCheckError` и `OutputCheckError` с понятным `message` и `additional_data.reason`: `usage_limit_reached`, `subscription_ended`, `usage_check_failed`, `usage_record_failed`.
- `runOrThrow` в `CoauthorChat.tsx` подписывается на агента. `onRunErrorEvent` для `usage_limit_reached` даёт `ChatError(message, null, "notice")`, а для всего остального — `ChatError("Соавтор не смог ответить: <message>. Попробуйте ещё раз.")`. `onRunFailed` кладёт ошибку как есть. Обработчик отправки показывает `e.message`.
- HTTP-запросы агента идут через `osFetch` (`chat/api.ts`, `fetch` агента). Ответы с кодом уже дают понятный `ChatError` (`describe`: 401, 403, 404, 5xx). Сбой самого `fetch` даёт «Нет связи с сервером. Проверьте интернет и попробуйте ещё раз (<e.message>).» — с технической причиной в скобках.
- Проверки фронтенда — Node-скрипты `web/scripts/check-*.ts`; `check:chat` уже в `validate.sh` и проверяет `outcome.ts`. Модули, которые они грузят, не импортируют ничего во время выполнения и не используют алиас `@/` (design `coauthor-refusal-text`, решение 1).

## Goals / Non-Goals

**Goals:**
- Одна функция решает, что показать автору по `RUN_ERROR`: текст бэкенда (отказ продукта) или текст о недоступности.
- Ни одна ветка ошибки запуска не выводит автору текст исключения.
- Образцы `RUN_ERROR` в виде Agno 3.1.10 проверяются в `validate.sh`.

**Non-Goals:**
- Менять бэкенд, AG-UI Agno или логирование API (proposal.md, Non-goals).
- Менять тексты ошибок истории бесед и загрузки файлов.

## Decisions

1. **Разбор в модуле `web/src/screens/project/chat/runError.ts` без импортов времени выполнения.** `readRunError(message: string, rawEvent: unknown)` возвращает `{ kind: "refusal", text, tone }` или `{ kind: "failure" }`. Причина берётся из `rawEvent.additional_data.reason`. Список причин продукта задан в модуле явно: `usage_limit_reached` → `tone: "notice"`, `subscription_ended`, `usage_check_failed`, `usage_record_failed` → `tone: "error"`; `text` — это `message` события. Нет `rawEvent`, нет причины или причина не из списка — `failure`. Там же лежат два текста: `UNAVAILABLE = "Соавтор сейчас недоступен. Попробуйте позже."` и `NO_CONNECTION = "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз."`. Нынешняя `limitReason` из `CoauthorChat.tsx` уходит в этот модуль.
   - Альтернатива: показывать `message` всегда, когда в данных есть любая `reason`. Отклонена: новая причина бэкенда (или чужая, из Agno) показалась бы автору без проверки, что её текст написан для человека (интент, Constraints).
   - Альтернатива: подменять текст на бэкенде — своим интерфейсом AG-UI или хуком. Отклонена: интерфейс AG-UI принадлежит Agno, обёртка над ним — обход фреймворка (07-anti-patterns, п. 27), а хуки Agno не перехватывают сбой модели. Решение о продукте здесь не принимается: тексты отказов пишет бэкенд, клиент только выбирает, показать их или общий текст (п. 10 не нарушается).
   - Альтернатива: разбирать текст исключения (`Insufficient Balance`, `RateLimitError`) и давать разные тексты. Отклонена: Non-goals; это хрупко и автору не нужно.

2. **`runOrThrow` держит ошибку `RUN_ERROR` отдельно от `onRunFailed`, и `RUN_ERROR` важнее.** Сейчас обе подписки пишут в одну переменную, и итог зависит от порядка вызовов в CopilotKit. После правки: `onRunErrorEvent` сохраняет результат `readRunError` и пишет полное событие в `console.error`; `onRunFailed` сохраняет свою ошибку. После запуска: если был `RUN_ERROR` — `refusal` даёт `ChatError(text, null, tone)`, `failure` — `ChatError(UNAVAILABLE)`. Иначе ошибка `onRunFailed`, а без неё — отказ самого `runAgent` (CopilotKit 1.79.1 пробрасывает ошибку `detachActiveRun`, добавлено после `/opsx:verify`): `ChatError` (из `osFetch`, у него уже текст для человека и код для 401) бросается как есть, любая другая ошибка пишется в `console.error` и становится `ChatError(UNAVAILABLE)`.
   - Альтернатива: оставить одну переменную. Отклонена: нынешний порядок — деталь CopilotKit, и при ошибке клиента после `RUN_ERROR` автор снова увидел бы сырой текст.

3. **`osFetch` при сбое `fetch` бросает `ChatError(NO_CONNECTION)`, а причину пишет в `console.error`.** Текст в скобках уходит. `osFetch` используют и история бесед, и переименование: там тот же текст без скобок только лучше. `NO_CONNECTION` берётся из `runError.ts`, чтобы текст был в одном месте.

4. **Проверка в `web/scripts/check-chat.ts`, рядом с образцами результатов действий.** Образцы `readRunError`:
   - сбой модели: `message` — текст исключения LiteLLM из скриншота 2026-11-08 (с `Insufficient Balance`), `rawEvent` с `error_type` и без `additional_data` → `failure`;
   - сбой без `rawEvent` (исключение роутера AG-UI) → `failure`;
   - `usage_limit_reached` с текстом лимита → `refusal`, `notice`, текст как есть;
   - `subscription_ended`, `usage_check_failed`, `usage_record_failed` → `refusal`, `error`;
   - неизвестная причина `something_new` → `failure`;
   - `additional_data` не объект, `reason` не строка → `failure`.
   Отдельно скрипт проверяет, что `UNAVAILABLE` и `NO_CONNECTION` не содержат слов LiteLLM, DeepSeek и Agno. Рядом комментарий: образцы повторяют `on_run_error` Agno 3.1.10, при обновлении Agno сверить.
   - Альтернатива: только живая проверка. Отклонена: разбор детерминирован, и ошибка в списке причин без проверки снова дойдёт до автора.

5. **Логирование на сервере не меняется.** Agno 3.1.10 уже пишет текст исключения запуска в лог API (Context). Лог содержит текст исключения провайдера, а не текст произведения (07-anti-patterns, п. 19). Живая проверка подтверждает строку в логе.

## Risks / Trade-offs

- [Сбой модели теперь не виден по скриншоту автора] → владелец смотрит лог API; предупреждение о балансе — в бэклоге этапа 2.
- [Agno при обновлении поменяет форму `RUN_ERROR` или `additional_data`] → отказы продукта начнут показываться общим текстом, а не сырым; образцы в `check-chat.ts` это покажут, комментарий напоминает сверить.
- [Новая причина отказа на бэкенде без правки клиента] → автор увидит «Соавтор сейчас недоступен», а не её текст. Это сознательно: список причин — контракт клиента и бэкенда, новая причина добавляется в оба места.
- [«Попробуйте позже» не говорит, когда] → честнее обещания «мы уже разбираемся»: автоматического оповещения пока нет.

## Migration Plan

Меняется только клиент. Выкатка — обычным релизом, откат — релизом предыдущего тега. Данных и миграций нет.
