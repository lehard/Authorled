## MODIFIED Requirements

### Requirement: Состав и границы модуля
Модуль `auth` MUST состоять из двух частей:
- деплой-часть — каталог `auth/` в корне репозитория;
- кодовая часть — `agno/app/auth/` в модуле бэкенда.

Вне `auth/` MUST NOT находиться настройки Authentik (blueprints, оформление, инициализация БД) и объявления его сервисов. Сервисы модуля (инициализация БД Authentik, сервер, worker, выгрузка ключей) MUST объявляться во фрагменте `auth/compose.yaml`, который корневой `compose.yaml` MUST подключать через `include`. Вне фрагмента MUST оставаться только его подключение и зависимости других сервисов от сервисов модуля.

Вне `agno/app/auth/` код MUST NOT читать JWT и claims токена и MUST NOT импортировать что-либо из Authentik. Остальные модули MUST получать удостоверение только через `Principal` и проверять доступ к проекту только через интерфейс модуля.

#### Scenario: Claims читаются только в модуле
- GIVEN репозиторий собран
- WHEN выполняется поиск обращений к JWT, claims и Authentik в Python-коде вне `agno/app/auth/`
- THEN обращений MUST NOT быть

#### Scenario: Настройки Authentik в одном месте
- GIVEN репозиторий собран
- WHEN выполняется поиск конфигурации Authentik (blueprints, `AUTHENTIK_*`) вне `auth/`, `compose.prod.yaml`, `example.env`, `scripts/` и документации
- THEN конфигурации MUST NOT быть

#### Scenario: Сервисы Authentik во фрагменте модуля
- GIVEN репозиторий собран
- WHEN выполняется поиск объявлений сервисов с образом Authentik вне `auth/compose.yaml`
- THEN объявлений MUST NOT быть
- AND `docker compose config` MUST содержать сервисы `authentik-db-init`, `authentik-server`, `authentik-worker` и `authentik-jwks-export`

#### Scenario: Конфигурация не изменилась
- GIVEN один и тот же `.env`
- WHEN сравниваются результаты `docker compose config` до и после переноса модуля из `modules/auth/` в `auth/`
- THEN образы, команды, порты, переменные окружения, тома и зависимости сервисов модуля MUST совпадать, кроме путей к файлам на хосте

### Requirement: Конфигурация из blueprints
Группы (`screenwriters`, `editors`, `admins`, `plugins`), OIDC-приложение и провайдер для фронтенда, потоки входа с двухфакторной проверкой, сопоставление групп и scopes и сервисные учётные записи плагинов MUST описываться blueprints в `auth/` и MUST применяться автоматически при запуске Authentik. Поток входа MUST быть привязан к бренду домена Authentik (`AUTH_BRAND_DOMAIN`) и MUST NOT зависеть от других blueprints, потому что порядок их применения не определён. Конфигурация MUST воспроизводиться на пустой схеме без ручных шагов в интерфейсе, кроме создания первого администратора.

#### Scenario: Пустая схема
- GIVEN схема `authentik` пуста
- WHEN запускаются сервер и worker Authentik
- THEN MUST существовать группы `screenwriters`, `editors`, `admins`, OIDC-приложение фронтенда и сопоставление групп и scopes

#### Scenario: Вход с двумя факторами
- GIVEN пользователь группы `screenwriters` с настроенным вторым фактором
- WHEN пользователь входит через интерфейс Authentik
- THEN поток входа MUST запросить второй фактор до выдачи токена
