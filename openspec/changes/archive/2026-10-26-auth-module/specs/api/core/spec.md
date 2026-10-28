# Spec Delta

## MODIFIED Requirements

### Requirement: Аутентификация защищённых маршрутов
Система MUST включать авторизацию при любом `RUNTIME_ENV`, включая `dev` (`authorization=build_authorization(db)` из `app/auth/` в `app/main.py`), и MUST отклонять запросы к защищённым маршрутам без валидного Bearer-токена кодом `401`. Маршруты `GET /health` и `GET /info` MUST оставаться доступными без токена.

#### Scenario: Запрос без токена в prd
- GIVEN приложение запущено с `RUNTIME_ENV=prd` и заданным `JWT_JWKS_FILE`
- WHEN клиент выполняет `GET /agents` без заголовка `Authorization`
- THEN система MUST вернуть `401` с телом `{"detail":"Authorization header missing"}`

#### Scenario: Невалидный токен в prd
- GIVEN приложение запущено с `RUNTIME_ENV=prd`
- WHEN клиент передаёт заголовок `Authorization: Bearer` с токеном, не подписанным ключом проверки
- THEN система MUST вернуть `401`

#### Scenario: Публичные маршруты в prd
- GIVEN приложение запущено с `RUNTIME_ENV=prd`
- WHEN клиент выполняет `GET /health` или `GET /info` без токена
- THEN система MUST вернуть `200`
- AND `GET /info` MUST вернуть `auth_mode: "jwt"`

#### Scenario: Режим разработки
- GIVEN приложение запущено с `RUNTIME_ENV=dev` (так задаёт `compose.yaml`) и заданным `JWT_JWKS_FILE`
- WHEN клиент выполняет `GET /agents` или `GET /sessions` без токена
- THEN система MUST вернуть `401`
- AND `GET /health` MUST вернуть `200` без токена

### Requirement: Отказ старта без ключа проверки JWT
Система MUST NOT стартовать без файла ключей `JWT_JWKS_FILE` при любом `RUNTIME_ENV`.

#### Scenario: prd без ключа
- GIVEN `JWT_JWKS_FILE` не задан (в `prd`, как и в `dev`)
- WHEN запускается `uvicorn app.main:app`
- THEN старт MUST завершиться ошибкой `RuntimeError: Required environment variable JWT_JWKS_FILE is not set`

#### Scenario: Файла ключей нет
- GIVEN `JWT_JWKS_FILE` указывает на несуществующий файл
- WHEN запускается `uvicorn app.main:app`
- THEN старт MUST завершиться ошибкой `RuntimeError`, называющей путь и необходимость выгрузить ключи из Authentik
