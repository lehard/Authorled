# Design: аргументы и описания инструментов не попадают в журнал Phoenix

## Context

Зачем это нужно, описано в `proposal.md`, требование — в `specs/agent-tracing`.

Что есть сейчас (Agno 3.1.10, `openinference-instrumentation==0.1.71`, `openinference-instrumentation-agno==1.0.15`):

- `agno/app/tracing.py` передаёт `AgnoInstrumentor().instrument(tracer_provider=..., config=TRACE_CONFIG)` экземпляр `TraceConfig` со всеми флагами `hide_*`, которые касаются текста.
- Инструментор оборачивает трейсер в `OITracer`. Тот прогоняет каждый атрибут через `config.mask(key, value)`: и при создании спана, и при `set_attribute(s)` (`openinference/instrumentation/_spans.py`, `_tracers.py`). Если `mask` вернул `None`, атрибут не записывается.
- Спан инструмента получает `tool.name`, `tool.description` и `tool.parameters`. Последний — это `safe_json_dumps(function_call.arguments)` (`openinference/instrumentation/agno/_tools_wrapper.py`, `_function_call_attributes`). `input.value` и `output.value` того же спана уже скрыты флагами `hide_inputs` и `hide_outputs`.
- `TraceConfig.mask` не знает ни `tool.parameters`, ни `tool.description`. В `main` openinference на 2026-11-10 так же.
- openinference сам предусматривает подклассы `TraceConfig` с переопределённым `mask`: `mask_without_externalization` проверяет, принимает ли `mask` подкласса аргумент `externalize`.
- Аргументы вызовов инструментов внутри сообщений модели (`llm.input_messages.*.tool_calls.*`, `llm.output_messages.*`) уже не пишутся флагами `hide_input_messages` и `hide_output_messages`.

## Goals / Non-Goals

**Goals:**
- Атрибуты `tool.parameters`, все `tool.parameters.*` и `tool.description` не записываются ни в один спан.
- Всё остальное в журнале остаётся как было.

**Non-Goals:**
- Скрывать атрибуты по содержимому (поиск текста в значениях). Скрываются только названные ключи.
- Проверять другие инструменторы: в приложении подключён только `AgnoInstrumentor`.

## Decisions

### 1. Подкласс `TraceConfig` с переопределённым `mask`

В `agno/app/tracing.py` объявляется `class JournalTraceConfig(TraceConfig)`, точное имя выбирается при apply. Его `mask(key, value, *, externalize=True)` возвращает `None` для `tool.description`, для `tool.parameters` и для ключей, начинающихся с `tool.parameters.`. Остальные ключи он передаёт `super().mask(key, value, externalize=externalize)`. Имена ключей берутся из `openinference.semconv.trace.SpanAttributes` (`TOOL_PARAMETERS`, `TOOL_DESCRIPTION`), а не строками. Модульный `TRACE_CONFIG` становится экземпляром подкласса с теми же флагами `hide_*`.

Сигнатура повторяет базовую, вместе с `externalize`. Тогда `mask_without_externalization` вызывает её без обходного пути для двухаргументного `mask`.

Альтернативы:
- **Фильтр атрибутов в `LoggedExporter`.** Отвергнут. Спаны к этому моменту уже собраны, их пришлось бы копировать с правкой `ReadableSpan`. Это своя машинерия поверх SDK, а атрибут при этом успел побывать в процессоре.
- **Свой `SpanProcessor.on_start`/`on_end`.** Отвергнут: атрибуты `ReadableSpan` в `on_end` не меняются, а `on_start` не видит атрибутов, которые выставили позже.
- **Обновить openinference или прислать правку в пакет.** Вне scope: закреплённые зависимости не обновляем внутри другой задачи (`07-anti-patterns.md`, п. 28), а в `main` пакета исправления нет.
- **Переменные окружения `OPENINFERENCE_HIDE_*`.** Для этих ключей их нет. Кроме того, настройка трассировки задаётся в коде, а не через `.env` (решение change `agent-tracing`).

### 2. Проверка: pytest на `mask` и поиск фразы в живой трассе

- pytest без моделей и без Phoenix в `agno/tests/test_tracing.py`. `TRACE_CONFIG.mask` возвращает `None` для `tool.parameters`, `tool.parameters.content` и `tool.description`. Для `tool.name` значение возвращается без изменений. `input.value` по-прежнему заменяется на `__REDACTED__`: базовые флаги не потерялись. Второй тест создаёт спан с атрибутами инструмента через публичный `OITracer(tracer, config)` из `openinference.instrumentation` над провайдером с `InMemorySpanExporter` и проверяет атрибуты готового спана.
- На локальном стенде: соавтор по просьбе создаёт заметку с уникальной фразой в режиме `ask`. Через Phoenix REST (`GET /v1/projects/default/spans`) фраза ищется во всех атрибутах трассы. У спана `create_story_note` нет `tool.parameters*` и `tool.description`, есть `tool.name` и статус.

## Risks / Trade-offs

- [Новая версия openinference назовёт атрибут иначе или добавит новый с текстом] → ключи берутся из `SpanAttributes`; при обновлении openinference поиск фразы на стенде повторяется так же, как в задачах этого change.
- [Без аргументов дольше искать, какой документ трогал инструмент] → id и аргументы есть в сессии Agno, на которую трасса указывает через `session.id` и `agno.run.id`.
- [Подкласс сломается при смене сигнатуры `mask` в openinference] → pytest на `mask` падает при обновлении пакета.

## Migration Plan

Релиз из `main` по обычному порядку. Данных и схем не трогаем. После релиза: на сервере новая трасса с вызовом инструмента без `tool.parameters*` и `tool.description`, отдельным маленьким PR с записью в `tmp/VERIFY.md`. Откат — откат релиза. Уже записанные трассы не чистятся (решение владельца 2026-11-10).
