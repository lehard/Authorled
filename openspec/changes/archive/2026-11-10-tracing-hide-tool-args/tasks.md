# Tasks

## 1. Скрытие в настройке трассировки

- [x] 1.1 В `agno/app/tracing.py` объявить подкласс `TraceConfig` с `mask(key, value, *, externalize=True)`. Для `SpanAttributes.TOOL_PARAMETERS`, ключей с префиксом `f"{SpanAttributes.TOOL_PARAMETERS}."` и `SpanAttributes.TOOL_DESCRIPTION` он возвращает `None`, остальное отдаёт `super().mask(...)` (design, решение 1). `TRACE_CONFIG` сделать экземпляром подкласса с прежними флагами `hide_*`, обновить docstring модуля: аргументы и описания инструментов скрыты. Проверка: `ruff` и `mypy` через `./scripts/validate.sh` проходят.
- [x] 1.2 pytest в `agno/tests/test_tracing.py`, без моделей и Phoenix (design, решение 2):
  - `TRACE_CONFIG.mask` возвращает `None` для `tool.parameters`, `tool.parameters.content` и `tool.description`;
  - `tool.name` возвращается без изменений, `input.value` — как `__REDACTED__`;
  - спан, созданный через `OITracer(tracer, TRACE_CONFIG)` над провайдером с `InMemorySpanExporter` и атрибутами инструмента, после завершения не содержит `tool.parameters*` и `tool.description`, но содержит `tool.name`.

  Проверка: `./scripts/dev.sh test` проходит.

## 2. Проверка на локальном стенде

- [x] 2.1 Запустить API этого worktree на хосте (`./scripts/dev.sh api`). Если порт 8000 занят контейнером `agentos-api` основной папки, остановить его только с подтверждения владельца в чате. В режиме `ask` попросить соавтора создать заметку с уникальной фразой и разрешить действие. Через Phoenix REST (`GET /v1/projects/default/spans`) найти трассу. Фразы нет ни в одном атрибуте ни одного шага. У спана `create_story_note` нет `tool.parameters*` и `tool.description`, есть `tool.name` и статус `OK`. У вызова модели по-прежнему есть модель, токены и длительность (спека `agent-tracing`, «Текст в аргументе инструмента не попадает в журнал», «Журнал запусков агентов в Phoenix»). Проверка: запрос, id трассы и результат поиска записаны в `tmp/VERIFY.md` в разделе model.

## 3. Проверки перед слиянием

- [x] 3.1 `./scripts/validate.sh` (после активации `agno/.venv`, с `env -u BASH_ENV`), `./scripts/dev.sh test` и `git diff --check` проходят. Проверка: результаты записаны в `tmp/VERIFY.md` в разделах static и deterministic.

## Workflow follow-up

- Verify, archive, merge `origin/main`, проверки, PR и merge — по `AGENTS.md`, «OpenSpec is mandatory», шаг 4.
- После релиза — отдельным маленьким PR от свежего `origin/main`: на сервере новая трасса с вызовом инструмента без `tool.parameters*` и `tool.description` (через `ssh authorled`, Phoenix REST на `127.0.0.1:6006`), запись в `tmp/VERIFY.md`.
- Уже записанные трассы не чистятся (решение владельца 2026-11-10).
