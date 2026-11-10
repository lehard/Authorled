# Proposal: аргументы и описания инструментов не попадают в журнал Phoenix

Бизнес-интент: `business-intents/tracing-hide-tool-args.md` (решения владельца 2026-11-10).

## Why

Проверка журнала 2026-11-10 после релиза `agent-tracing` показала: у спана инструмента есть атрибут `tool.parameters`, JSON всех аргументов вызова. Его всегда пишет `openinference-instrumentation-agno`, и ни один флаг `TraceConfig` его не скрывает. Сейчас там видны только id документов. Но у `suggest_edit`, `create_story_note`, `update_story_note`, `create_story_document`, `update_story_document` и `comment_on_screenplay` аргументы — это текст автора, и первый такой вызов положит его в журнал. Это нарушает требование «Журнал без текстов» спеки `agent-tracing`. Атрибут `tool.description` несёт описания инструментов из кода. Это часть промпта агента, которую спека тоже относит к запрещённому содержимому.

## What Changes

- Атрибуты `tool.parameters` (со всем, что вложено в него) и `tool.description` не записываются в спаны: ни у соавтора, ни у других агентов и команд.
- Скрытие делается документированной точкой расширения openinference: подкласс `TraceConfig` с переопределённым `mask` в `agno/app/tracing.py`. Фильтра в экспортёре и правок пакета нет.
- Имя инструмента, статус, время, текст ошибки, а у вызова модели — модель и токены остаются как есть.
- Трассы, где `tool.parameters` уже записан, не чистятся: там только id, через 30 дней их удалит срок хранения.

## Scope

- `agno/app/tracing.py`: подкласс `TraceConfig` и его передача в `AgnoInstrumentor` вместо `TRACE_CONFIG`.
- `agno/tests/test_tracing.py`: тест скрытия без моделей.
- Спека `agent-tracing`: требование «Журнал без текстов» явно называет аргументы и описания инструментов, новый сценарий с текстовым инструментом.
- `tmp/VERIFY.md`: проверка на локальном стенде; на сервере — после релиза.

## Non-goals

- Список имён инструментов агента (`agno.tools`) у корня трассы: это имена из кода, не текст.
- Обновление, замена или правка пакетов openinference, запрос в openinference.
- Очистка уже записанных трасс в Phoenix.
- Изменения биллинга, сессий Agno, самого Phoenix и compose.
- Плановая проверка `agentos-maintenance` с ответом 403: отдельная задача.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `agent-tracing`: в «Журнал без текстов» к скрытому содержимому добавляются описания инструментов, и появляется сценарий, где инструмент с текстовым аргументом не оставляет этот текст в трассе.

## Impact

- Код: `agno/app/tracing.py`, `agno/tests/test_tracing.py`.
- Зависимости не меняются: `openinference-instrumentation==0.1.71`, `openinference-instrumentation-agno==1.0.15`, Agno 3.1.10.
- В Phoenix у спанов инструментов пропадают поля `tool.parameters.*` и `tool.description`. id документа, который трогал инструмент, теперь смотрят в сессии Agno.
