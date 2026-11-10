# Verification: tracing-hide-tool-args (2026-11-10)

## Static

- `./scripts/validate.sh` (venv `agno/.venv`, `env -u BASH_ENV`): `Done.`, exit 0. Первый прогон упал на `mypy`: `AttributeValue` из `opentelemetry.util.types` (API 1.45) шире, чем тип `TraceConfig.mask`. В `agno/app/tracing.py` объединение записано явно, как в `openinference/instrumentation/_types.py`, приватный модуль не импортируется.
- `git diff --check`: чисто.

## Deterministic

- `./scripts/dev.sh test` (база `ai_test_tracing_hide_tool_args`): 928 passed. Новые тесты в `agno/tests/test_tracing.py`: `mask` убирает `tool.parameters`, `tool.parameters.content` и `tool.description`; `tool.name` остаётся, `input.value` по-прежнему `__REDACTED__`; спан через `OITracer(tracer, TRACE_CONFIG)` и `InMemorySpanExporter` без аргументов и описания и без фразы заметки, с `tool.name`.

## Model (local stand, Phoenix `127.0.0.1:6006`)

Метод отличается от текста задачи 2.1. API на хосте не запускался: порт 8000 держит `agentos-api` основной папки, и останавливать его не понадобилось. Соавтор запускался в процессе тем же кодом, что `python -m evals.coauthor actions-run` (`evals.coauthor.actions_run.run_request`): просьбы `note-casting` и `note-ferry-facts` из `agno/evals/coauthor/actions.toml` на базе `ai_dev_tracing_hide_tool_args`, пользователь замера действий, вызов `create_story_note` подтверждён и применён ядром. Трассировка подключена тем же `setup_agent_tracing()`, что вызывает `app/main.py`; в конце `provider.shutdown()`. Скрипт лежит в scratchpad, в репозиторий не попал.

- **До (код основной папки, `JournalTraceConfig` нет).** Venv основной папки подключает её `agno/` через `.pth`, поэтому первый прогон шёл на старом коде. Трассы `560bbba6…` и `6aa2df1c…`: у спана `create_story_note` есть `tool.description`, `tool.parameters.title` и `tool.parameters.body`, а фразы заметок («Кастинг», «канатной тяге», «5 км/ч», «Факты о переправах») находятся в атрибутах. Проблема воспроизведена.
- **После (`PYTHONPATH` = `agno/` worktree, `type(TRACE_CONFIG)` = `JournalTraceConfig`).** 4 трассы, 10 спанов с 09:49:44 UTC (`34ec2777…`/`a8b251a8…`, `05770312…`/`fba209b5…`). У `create_story_note` из `tool.*` только `tool.name`, статус `OK`. Поиск по всем атрибутам фраз «актрис», «непрофессиональная актриса», «канатной тяге», «5 км/ч», «Кастинг», «Факты о переправах» и начал описаний инструментов («Документы драфта», «Заметки истории») ничего не нашёл. У вызовов модели есть `llm.model_name` `deepseek-fast` и токены. У корней есть `session.id`.
- Замечено: подтверждение действия открывает отдельную трассу (`Соавтор.acontinue_run` — свой корень). Сессия у неё та же, поэтому фильтр по сессии находит обе. Так работает Agno, этот change это не меняет.
- Трассы «до» с демо-текстом заметок остались в локальном Phoenix: по решению владельца старые трассы не чистятся, через 30 дней их удалит срок хранения. Там демо-данные замера, не тексты авторов.

## Hosted

Не проверялось: после релиза отдельным PR (tasks.md, Workflow follow-up).
