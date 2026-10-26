# Spec Delta

## MODIFIED Requirements

### Requirement: Возможности AgentOS
Система MUST включать в `AgentOS`: MCP (`mcp=True`), трассировку (`tracing=True`), планировщик (`scheduler=True`, `scheduler_base_url=AGENTOS_URL`), изоляцию пользователей (`user_isolation=True`), каталог пользователей (`user_directory=True`), долговечную очередь (`QueueConfig(durable=True, db=db)`), OS Manager, CompanyOS, знание `shared-knowledge`, реестр и манифест `app/config.yaml`. Авторизация MUST быть включена при любом `RUNTIME_ENV`, включая `dev`; без ключа проверки JWT система MUST NOT запускаться. По умолчанию `RUNTIME_ENV` равен `prd`.

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
