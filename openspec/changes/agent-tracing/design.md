# Design: журнал работы агентов в Phoenix

## Context

Мотивация — в `proposal.md`, требования — в `specs/agent-tracing`, `specs/overview`, `specs/runtime`.

Что есть сейчас (Agno 3.1.10, FastAPI 0.159.1, opentelemetry-sdk 1.45.1, openinference-instrumentation-agno 1.0.15):

- `agno/app/main.py` вызывает `setup_tracing(db=db, batch_processing=True)` до `AgentOS(tracing=False)`. Agno создаёт `TracerProvider` с `DatabaseSpanExporter`, делает его глобальным (`trace_api.set_tracer_provider`) и подключает `AgnoInstrumentor`.
- FastAPI 0.159 сам пишет спаны запросов, если глобальный провайдер настроен (`fastapi/telemetry`: `enabled()` проверяет `_unconfigured(trace.get_tracer_provider())`). Поэтому HTTP-спаны становятся корнем, а запуск агента — дочерним спаном. Agno берёт агента, пользователя и сессию только с корня (`agno/tracing/schemas.py`, `create_trace_from_spans`).
- Документация Agno (tracing/overview) для случая «провайдером владеет другая интеграция» говорит настраивать экспортёры и `AgnoInstrumentor` напрямую.
- `AgnoInstrumentor.instrument()` принимает `tracer_provider` и `config` (`TraceConfig` openinference с флагами `hide_inputs`, `hide_outputs`, `hide_input_messages`, `hide_output_messages`, `hide_prompts` и др.).
- Сервисы бэкенда объявлены в `agno/compose.yaml`. Образец сервиса с собственной ролью и схемой в общей базе — `authentik-db-init` модуля `auth`. Роль API `agentos` готовит `agno/db/init.sql`.
- `app.main` импортируют `./scripts/dev.sh api`, `python -m evals` и `python -m evals.coauthor`.

## Goals / Non-Goals

**Goals:**
- Трассировка настраивается приложением своими средствами из документированных API OpenTelemetry, openinference и Agno, без обращения к закрытым полям FastAPI или Agno.
- Один путь записи трасс — в Phoenix. Таблицы трасс Agno не пишутся.
- Ошибка конфигурации видна при старте. Потеря Phoenix в работе видна в логе и не трогает авторов.

**Non-Goals:**
- Выбор сэмплирования: пишутся все запуски агентов (их немного).
- Метрики и логи OpenTelemetry, OTLP-коллектор между API и Phoenix.
- Изменение поведения агентов, хуков биллинга и маршрутов.

## Decisions

### 1. Свой `TracerProvider`, не глобальный

Приложение создаёт `TracerProvider` (с теми же лимитами атрибутов, что выставляет Agno, `SpanLimits(max_span_attributes=1024)`), добавляет `BatchSpanProcessor` с OTLP-экспортёром и вызывает `AgnoInstrumentor().instrument(tracer_provider=provider, config=trace_config)`. Провайдер **не** ставится глобальным, а `setup_tracing` больше не вызывается.

Почему: глобальный провайдер остаётся ненастроенным, поэтому встроенная телеметрия FastAPI и другие библиотеки, пишущие в глобальный трассировщик (клиент MCP: спаны `tools/list`, `MCP send initialize`), спанов не создают. Корнем трассы становится запуск агента или команды, и openinference кладёт на него агента, пользователя и сессию.

Отвергнуто:
- `setup_tracing` плюс выключение телеметрии FastAPI через `app._telemetry` у приложения из `agent_os.get_app()`: это закрытое поле, оно может поменяться в любой версии.
- `FastAPI(telemetry={"tracing": False})` через `base_app`: ADR-002 запрещает `base_app`, потому что Agno тогда снимает свои обработчики ошибок.
- Процессор, который отбрасывает HTTP-спаны: спан агента сохранит родителя, которого нет, и трасса останется без корня.

Проверка: после старта `trace.get_tracer_provider()` остаётся отложенным провайдером OpenTelemetry. Если какой-то компонент Agno или зависимости ставит глобальный провайдер сам, apply останавливается и выносит это владельцу.

### 2. OTLP по HTTP в Phoenix, адрес — `PHOENIX_URL`

Экспорт идёт `opentelemetry-exporter-otlp-proto-http` (версия из той же линейки, что `opentelemetry-sdk==1.45.1`) на `${PHOENIX_URL}/v1/traces`. Один порт 6006 обслуживает и интерфейс, и приём, так что gRPC (4317) не нужен и не публикуется.

`PHOENIX_URL` обязателен, без значения по умолчанию: `http://phoenix:6006` для контейнера API (задаётся в `agno/compose.yaml`, как `DB_HOST`), `http://127.0.0.1:6006` для API на хосте (`./scripts/dev.sh api`, evals). Пустая или отсутствующая переменная даёт `RuntimeError` с её именем.

Отвергнуто: gRPC-экспортёр (лишняя зависимость `grpcio`, второй порт); `PHOENIX_COLLECTOR_ENDPOINT` с автонастройкой `phoenix.otel.register` (ставит глобальный провайдер и тянет пакет Phoenix в API).

### 3. Проверка Phoenix при старте

До создания `AgentOS` приложение делает `GET ${PHOENIX_URL}/healthz` с таймаутом в несколько секунд. Если ответа нет или он не `200`, приложение бросает `RuntimeError` с адресом. Так ловится ошибка конфигурации (неверный адрес, Phoenix не поднят). В compose `agentos-api` дополнительно ждёт `phoenix: condition: service_healthy`.

Путь `/healthz` проверяется на выбранной версии образа при apply. Если его нет, используется документированный путь проверки этой версии.

### 4. Потеря Phoenix в работе: ошибка в лог, авторы не затронуты

Исключение из правила «без запасных путей», согласованное владельцем 2026-11-09 (спека `agent-tracing`, «Потеря Phoenix во время работы»).

`BatchSpanProcessor` отправляет пакеты в своём потоке, поэтому запуск агента от экспорта не зависит. Новой логики восстановления нет: нет повторов сверх штатных повторов OTLP-экспортёра, нет буфера на диске, нет переключения на другой приёмник.

Единственное добавление — тонкая обёртка экспортёра. Если `export()` вернул `FAILURE` или бросил исключение, она пишет в лог `ERROR` с адресом Phoenix и числом потерянных спанов и возвращает тот же результат. Это нужно, потому что штатный экспортёр пишет такие сбои как предупреждения.

### 5. Тексты скрыты настройкой openinference в коде

`TraceConfig(hide_inputs=True, hide_outputs=True, hide_input_messages=True, hide_output_messages=True, hide_prompts=True, hide_input_text=True, hide_output_text=True, hide_choices=True, hide_input_images=True, hide_embeddings_text=True)`. Параметры передаются в коде, а не переменными окружения, чтобы настройка не зависела от `.env`. Число токенов, имя модели, имена инструментов и шагов, статусы и ошибки остаются.

При apply трасса реального запуска соавтора проверяется поиском уникальной фразы автора, фразы ответа и фрагмента системного промпта по всем атрибутам. Если Agno-инструментор кладёт текст в атрибуты, которые `TraceConfig` не скрывает (например, свои `agno.*`), apply останавливается и выносит выбор владельцу: своего фильтра атрибутов без решения не пишем.

### 6. Phoenix в compose: своя роль и схема в общей базе

- `phoenix-db-init` на образе `agnohq/pgvector:18` выполняет `agno/phoenix/init.sql` под загрузочным суперпользователем, как `agentos-db-init`, и после него, чтобы два скрипта не правили каталог одновременно. Скрипт идемпотентно создаёт роль `phoenix` (`LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE`, пароль `PHOENIX_DB_PASSWORD` через `${...:?}`), даёт ей `CREATE` на базу и создаёт схему `phoenix`, владелец которой — эта роль. Право на базу нужно, потому что Phoenix перед миграциями выполняет `CREATE SCHEMA IF NOT EXISTS`, а PostgreSQL проверяет право раньше, чем существование схемы. Такое же право есть у `agentos` и `authentik`. Прав на чужие схемы у роли нет.
- `phoenix` (`agentos-phoenix`): образ `arizephoenix/phoenix:version-20.26.1-nonroot`. Окружение: `PHOENIX_POSTGRES_HOST/PORT/USER/PASSWORD/DB` (пароль не попадает в URL), `PHOENIX_SQL_DATABASE_SCHEMA=phoenix`, `PHOENIX_DEFAULT_RETENTION_POLICY_DAYS=30`, `PHOENIX_TELEMETRY_ENABLED=false`, `PHOENIX_ALLOW_EXTERNAL_RESOURCES=false` (Phoenix сам не ходит в интернет: шрифты, телеметрия, загрузка WASM). Порт `127.0.0.1:6006:6006`. Healthcheck по `/healthz` через Python образа: в distroless-образе нет shell и curl. Есть `mem_limit`. Зависит от успешного `phoenix-db-init`.
- `compose.prod.yaml`: тот же порт на `127.0.0.1` (`!override`, как у Authentik), пароль загрузочного суперпользователя для `phoenix-db-init` из `DB_PASS`, как у других init-сервисов. `deploy/Caddyfile` не меняется.

Отвергнуто: SQLite в томе (отдельный том вне резервной копии базы; две разные базы для одного стека); отдельный контейнер PostgreSQL (лишняя память на сервере с 8 ГБ). Спаны без текстов маленькие, поэтому резервная копия базы перед деплоем (`deploy.sh`) вырастет незначительно, а срок хранения ограничивает рост.

### 7. Вход только через SSH-туннель

Своего входа у Phoenix нет (`PHOENIX_ENABLE_AUTH` не включается). Безопасность держится на том, что порт слушает только `127.0.0.1` хоста и сеть контейнеров `agentos`. Команда туннеля и адрес описываются в README («Agent tracing») и в навыке `deploy-platform`.

### 8. Разовая очистка старых трасс

Это не миграция: схема `ai` принадлежит Agno, её Alembic ядра не трогает. Очистка — ручной шаг владельца после релиза: `TRUNCATE ai.agno_spans, ai.agno_traces;` под ролью `agentos` (владелец схемы) через `./scripts/dev.sh psql` локально и через `docker compose exec` на сервере, только с подтверждения владельца в чате. Таблицы остаются: их создаёт и ждёт Agno.

### 9. Документы

README, навык `deploy-platform`, `example.env` (`PHOENIX_DB_PASSWORD` в блоке Required), `CLAUDE.md`/`AGENTS.md` (сервис Phoenix в разделах compose и Verification), контекст-пак: `03-architecture.md` (сервис журнала), `05-security-and-compliance.md` (журнал без текстов, на своём сервере, 30 дней).

## Risks / Trade-offs

- [Инструментор openinference пишет текст в атрибуты, не покрытые `TraceConfig`] → проверка поиском фраз при apply, при находке — стоп и вопрос владельцу (решение 5).
- [Какая-то зависимость ставит глобальный провайдер, и HTTP-спаны возвращаются] → проверка глобального провайдера после старта и сценарий «Щелчки в интерфейсе не пишутся» (решение 1).
- [Phoenix съедает память на сервере 8 ГБ] → `mem_limit`. Число подбирается замером при apply и записывается в `tmp/VERIFY.md`. Перезапуск по памяти покрыт решением 4.
- [Без текстов труднее разбирать ответы] → переписка остаётся в сессиях Agno, по `session_id` из трассы её можно открыть рядом.
- [Evals и `dev.sh api` теперь требуют Phoenix] → `dev.sh api` поднимает его сам, README называет это для evals.
- [Phoenix без входа виден любому процессу на сервере] → на сервере работают только наши контейнеры, вход по SSH — только у владельца.
- [Маршруты `/traces` Agno пусты, и это может выглядеть как поломка] → спека `overview` и README говорят, что журнал в Phoenix.

## Migration Plan

1. До релиза владелец добавляет `PHOENIX_DB_PASSWORD` в `/etc/authorled/authorled.env` (подтверждение в чате).
2. Релиз из `main`: `deploy.sh` делает копию базы, `phoenix-db-init` создаёт роль и схему, `phoenix` поднимается, `agentos-api` стартует после него.
3. Проверка на сервере: трасса запуска соавтора в Phoenix через туннель, порт 6006 снаружи закрыт, в `ai.agno_traces` нет новых строк. Результаты — в `tmp/VERIFY.md`.
4. Очистка старых трасс (решение 8) с подтверждения владельца.

Откат: релиз с прошлым тегом. Он снова вызывает `setup_tracing` и пишет в таблицы Agno, а сервис `phoenix` прошлым compose не объявлен и останавливается. Схема `phoenix` остаётся и прошлой версии не мешает.

## Open Questions

- Точный тег образа Phoenix (последний стабильный не моложе двух недель на момент apply) и проверочный путь этой версии.
- Значение `mem_limit` для Phoenix — по замеру при apply.
