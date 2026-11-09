# Spec Delta

## MODIFIED Requirements

### Requirement: Возможности AgentOS
Система MUST включать в `AgentOS`: MCP (`mcp=True`), планировщик (`scheduler=True`, `scheduler_base_url=AGENTOS_URL`), изоляцию пользователей (`user_isolation=True`), каталог пользователей (`user_directory=True`), долговечную очередь (`QueueConfig(durable=True, db=db)`), OS Manager, CompanyOS, знание `shared-knowledge`, реестр и манифест `app/config.yaml`. Трассировка запусков агентов MUST быть включена до создания `AgentOS` и MUST отправлять спаны в Phoenix пакетами в фоне (спека `agent-tracing`), у самого `AgentOS` — `tracing=False`, чтобы обработка HTTP-запроса не ждала записи трасс; сбой настройки трассировки MUST останавливать запуск. Авторизация MUST быть включена при любом `RUNTIME_ENV`, включая `dev`; без ключа проверки JWT система MUST NOT запускаться. По умолчанию `RUNTIME_ENV` равен `prd`.

#### Scenario: Значения по умолчанию окружения
- GIVEN `RUNTIME_ENV` и `AGENTOS_URL` не заданы
- WHEN импортируется `app.main`
- THEN `runtime_env` MUST быть `prd`, а `agentos_url` MUST быть `http://127.0.0.1:8000`

#### Scenario: Авторизация в dev
- GIVEN `RUNTIME_ENV=dev` и ключ проверки JWT задан
- WHEN клиент вызывает защищённый маршрут без токена
- THEN система MUST вернуть `401`

#### Scenario: dev без ключа
- GIVEN `RUNTIME_ENV=dev` и `JWT_JWKS_FILE` не задан
- WHEN запускается API
- THEN запуск MUST завершиться ошибкой

#### Scenario: Параллельные запросы не ждут трасс
- GIVEN API запущен, трассировка включена
- WHEN клиент одновременно отправляет 8 запросов `GET /health`
- THEN все 8 ответов MUST прийти быстрее 100 мс, считая внутри контейнера API

#### Scenario: Трассы запуска агента сохраняются
- GIVEN API и Phoenix запущены
- WHEN автор отправляет сообщение соавтору и ждёт ответа
- THEN не позже чем через 10 секунд после ответа в Phoenix MUST быть трасса этого запуска
- AND `GET /traces` Agno MUST NOT возвращать новую трассу этого запуска
