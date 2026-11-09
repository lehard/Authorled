# Tasks

## 1. Phoenix в compose

- [x] 1.1 Выбрать точный тег `arizephoenix/phoenix` (последний стабильный не моложе двух недель) и проверить на нём путь проверки здоровья (`/healthz` или документированный путь этой версии), имена переменных `PHOENIX_SQL_DATABASE_URL`, `PHOENIX_SQL_DATABASE_SCHEMA`, `PHOENIX_DEFAULT_RETENTION_POLICY_DAYS`, `PHOENIX_TELEMETRY_ENABLED` и способ healthcheck внутри образа (design, решения 3 и 6). Проверка: тег, путь и способ записаны в `tmp/VERIFY.md` со ссылками на документацию Phoenix.
- [x] 1.2 `agno/phoenix/init.sql`: идемпотентно создать роль `phoenix` (`LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`, пароль из `-v phoenix_password`) и схему `phoenix`, владелец которой — эта роль, по образцу `agno/db/init.sql` (решение 6). Проверка: двойной прогон скрипта на локальной базе проходит. Под ролью `phoenix` чтение `authorled.projects` и `ai.agno_sessions` отказывает, а под ролью `agentos` отказывает чтение схемы `phoenix` (спека `agent-tracing`, «Отдельные данные Phoenix»).
- [ ] 1.3 Сервисы `phoenix-db-init` и `phoenix` в `agno/compose.yaml`: пароль `${PHOENIX_DB_PASSWORD:?...}`, схема, срок хранения 30 дней, выключенная телеметрия, порт `127.0.0.1:6006:6006`, healthcheck, `mem_limit`, зависимости от `agentos-db` и `phoenix-db-init`. `agentos-api` получает `PHOENIX_URL=http://phoenix:6006` и ждёт `phoenix` в состоянии `service_healthy` (спека `runtime`, «Контейнеры разработки»). Проверка: `docker compose up -d --build` поднимает `phoenix` до `agentos-api`. Без `PHOENIX_DB_PASSWORD` команда `docker compose config` падает с именем переменной.
- [x] 1.4 `compose.prod.yaml`: порт `phoenix` через `!override` только на `127.0.0.1:6006`, `restart: unless-stopped`. `deploy/Caddyfile` не меняется (спека `runtime`, «Production-override»). Проверка: `docker compose -f compose.yaml -f compose.prod.yaml config` показывает у `phoenix` только `127.0.0.1:6006`, в `deploy/Caddyfile` нет упоминания Phoenix.
- [ ] 1.5 `example.env`: `PHOENIX_DB_PASSWORD` в блоке Required с пояснением. `./scripts/dev.sh api` поднимает `phoenix` (вместе с `phoenix-db-init`) и экспортирует `PHOENIX_URL=http://127.0.0.1:6006`. Если `app.main` импортируют тесты `./scripts/dev.sh test`, то же для `test`. Проверка: `./scripts/dev.sh api` стартует API на хосте, `curl http://127.0.0.1:6006/<путь проверки>` отвечает `200`.

## 2. Трассировка приложения

- [x] 2.1 Добавить `opentelemetry-exporter-otlp-proto-http` в `agno/pyproject.toml` в версии линейки `opentelemetry-sdk==1.45.1`, перегенерировать `agno/requirements.txt` (`./agno/scripts/generate_requirements.sh`), обновить `agno/.venv`. Проверка: `git diff agno/requirements.txt` содержит только экспортёр и его транзитивные зависимости, остальные версии не сдвинулись; обе цели `agno/Dockerfile` собираются.
- [x] 2.2 Модуль `agno/app/tracing.py`: чтение обязательного `PHOENIX_URL` (без значения по умолчанию, ошибка с именем), проверка Phoenix при старте (ошибка с адресом), свой `TracerProvider` (не глобальный) с `BatchSpanProcessor`, OTLP-экспортёр на `${PHOENIX_URL}/v1/traces` в обёртке, которая пишет `ERROR` с адресом и числом потерянных спанов, `AgnoInstrumentor().instrument(tracer_provider=..., config=TraceConfig(...))` со скрытием текстов (design, решения 1–5). Проверка: `ruff` и `mypy` через `./scripts/validate.sh` проходят.
- [x] 2.3 В `agno/app/main.py` заменить `setup_tracing(db=db, batch_processing=True)` вызовом настройки из 2.2 до создания `AgentOS`, `tracing=False` оставить, комментарий обновить (спека `overview`, «Возможности AgentOS»). Проверка: API стартует. После старта `opentelemetry.trace.get_tracer_provider()` в процессе API — отложенный провайдер OpenTelemetry, а не провайдер SDK (если нет — стоп и вопрос владельцу, design, решение 1).
- [x] 2.4 pytest в `agno/tests/` для настройки трассировки, без моделей: отсутствующий `PHOENIX_URL` → ошибка с именем переменной; неотвечающий адрес → ошибка с адресом; сбой экспорта → запись уровня `ERROR` с адресом и результат `FAILURE` без исключения наружу. Проверка: `./scripts/dev.sh test` проходит.

## 3. Проверка поведения на локальном стенде

- [x] 3.1 Запуск соавтора от пользователя разработки в UI: в Phoenix одна трасса с корнем — запуск `coauthor`, у корня видны агент, пользователь и сессия, внутри шаги модели (имя модели, токены, время) и инструментов. Второй запуск в том же разговоре находится фильтром по сессии вместе с первым (спека `agent-tracing`, «Журнал запусков», «Корень трассы»). Проверка: снимок трассы и фильтра описан в `tmp/VERIFY.md`.
- [x] 3.2 Открыть полку, историю и комментарии без обращения к соавтору: новых трасс в Phoenix нет. Число строк `ai.agno_traces` и `ai.agno_spans` до и после запусков из 3.1 не изменилось. Проверка: числа и наблюдение в `tmp/VERIFY.md`.
- [x] 3.3 Сообщение соавтору с уникальной фразой, соавтор читает сценарий и отвечает. Поиск этой фразы, фразы из ответа и фрагмента системного промпта по атрибутам всех шагов трассы (через API или базу Phoenix) ничего не находит. Если текст найден в атрибутах, которые `TraceConfig` не скрывает, — стоп и вопрос владельцу (design, решение 5). Проверка: запросы и пустой результат в `tmp/VERIFY.md`.
- [x] 3.4 Отказы: API без `PHOENIX_URL` не стартует с именем переменной. API при остановленном Phoenix не стартует с адресом. Phoenix остановлен при работающем API: соавтор отвечает, в логе API ошибка отправки с адресом. После запуска Phoenix трассы снова пишутся (спека `agent-tracing`, «Обязательный Phoenix при старте», «Потеря Phoenix во время работы»). Проверка: фрагменты логов в `tmp/VERIFY.md`.
- [x] 3.5 Настройки Phoenix: срок хранения по умолчанию 30 дней в интерфейсе, телеметрия выключена в окружении контейнера. Подобрать `mem_limit` по пиковой памяти Phoenix за проверки 3.1–3.4 с запасом. Проверка: значения и замер в `tmp/VERIFY.md`, `mem_limit` в `agno/compose.yaml` равен выбранному.
- [ ] 3.6 Сценарий `overview` «Параллельные запросы не ждут трасс»: 8 одновременных `GET /health` внутри контейнера API отвечают быстрее 100 мс. Проверка: время в `tmp/VERIFY.md`.

## 4. Документы и контекст

- [x] 4.1 README: раздел о журнале агентов (Phoenix локально на `http://127.0.0.1:6006`, на сервере через `ssh -L 6006:127.0.0.1:6006 authorled`, срок 30 дней, текстов нет, `/traces` Agno пусты, evals и `dev.sh api` требуют Phoenix). Навык `deploy-platform`: `PHOENIX_DB_PASSWORD` в настройках сервера, туннель, проверка после релиза. Проверка: обе инструкции описывают одну и ту же команду туннеля и одни и те же переменные.
- [x] 4.2 `AGENTS.md` (через него и `CLAUDE.md`): сервисы `phoenix` и `phoenix-db-init` в описании `compose.yaml`, `agno/app/tracing.py` в «Where changes belong», Phoenix в «Verification». Контекст-пак: `03-architecture.md` (сервис журнала агентов), `05-security-and-compliance.md` (журнал без текстов, на своём сервере, 30 дней, вход по SSH). Проверка: `grep -rn "setup_tracing" AGENTS.md openspec/context README.md` не находит устаревших описаний.

## 5. Проверки перед слиянием

- [x] 5.1 `./scripts/validate.sh` (с `env -u BASH_ENV` после активации `agno/.venv`), `./scripts/dev.sh test` и `git diff --check` проходят. Проверка: результаты в `tmp/VERIFY.md` в разделах static и deterministic.

## Workflow follow-up

- Verify, archive, merge `origin/main`, проверки, PR и merge — по `AGENTS.md`, «OpenSpec is mandatory», шаг 4.
- Перед релизом владелец добавляет `PHOENIX_DB_PASSWORD` в `/etc/authorled/authorled.env` (подтверждение в чате).
- После релиза отдельным маленьким PR от свежего `origin/main`: проверка на сервере (трасса соавтора через туннель, порт 6006 снаружи закрыт, нет новых строк в `ai.agno_traces`) в `tmp/VERIFY.md`.
- После проверки сервера — разовая очистка `TRUNCATE ai.agno_spans, ai.agno_traces;` локально и на сервере, на сервере только с подтверждения владельца в момент выполнения (design, решение 8).
