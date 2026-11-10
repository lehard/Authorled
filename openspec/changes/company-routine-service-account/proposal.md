# Proposal

## Why

Ежедневная Routine `agentos-maintenance` (исполнитель `company-manager-internal`) на продакшне ни разу не запустилась: все 4 запуска с создания — `403 Insufficient permissions for scheduled target`. В Agno 3.1.10 Routine, объявленная в коде, не имеет владельца, планировщик запускает её с пустым снимком прав, и проверка маршрута `POST /agents/company-manager-internal/runs` её отбивает. Права человека Agno сохраняет в Routine, когда её правит вызывающий с токеном, но токена администратора для API у нас нет намеренно (вход `admins` только на `admin.soavtor.app`, `akadmin` без токенов). Бизнес-интент: `business-intents/company-routine-service-account.md`.

## What Changes

- Новая группа Authentik `routines` (blueprint `auth/blueprints/10-groups.yaml`) и её права в `GROUP_SCOPES`: запуск `company-manager-internal`, чтение и правка Routines и расписаний, чтение Company и предложения Projects и Tasks. Без административных прав и без запуска других агентов.
- Сервисная учётная запись `sa-routines` этой группы (`auth/blueprints/40-service-accounts.yaml`) без пароля приложения в blueprint: владелец выдаёт временный пароль приложения в админке Authentik, когда нужно сохранить права, и потом удаляет его.
- Новый скрипт `scripts/routines_authorize.sh`: читает пароль приложения со stdin, берёт токен `sa-routines` у Authentik и через `PATCH /company/routines/{id}` (тот же исполнитель) сохраняет снимок прав этой учётной записи в каждой Routine Products из `agno/app/company.py`. Текст, cron и исполнитель Routine не меняются. Один скрипт для локального стенда и сервера: адреса берутся из `.env`.
- Закрытый перечень групп контракта токена дополняется группой `routines`.
- Документация: `AGENTS.md`/`CLAUDE.md` (Company и Routines), README (модуль auth, сервисные учётные записи, шаг после первого релиза).

Решения, принятые как допущения (открытые вопросы интента): имя группы — `routines`; постоянного пароля приложения у `sa-routines` нет ни в blueprint, ни в env-файле сервера.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `auth`: «Права по группам» — группа `routines` и её scopes; «Контракт токена» — перечень групп с `routines`; новое требование «Сервисная учётная запись Routines» — учётная запись без постоянного пароля и правила её токена.
- `api/schedules`: новое требование «Права Routine из кода» — Routine из кода получает права сервисной учётной записи командой `scripts/routines_authorize.sh`, без них её запуск отвечает `403`; запуск с сохранёнными правами проходит и переживает перезапуск API. Требование «Расписания CompanyOS» не меняется.

## Scope

- `auth/blueprints/10-groups.yaml`, `auth/blueprints/40-service-accounts.yaml`.
- `agno/app/auth/authorization.py` (`GROUP_SCOPES`) и тест сопоставления групп, если он есть.
- `scripts/routines_authorize.sh` (новый).
- Спеки `auth` и `api/schedules` (дельты этого change).
- `AGENTS.md`/`CLAUDE.md`, `README.md`.
- Проверка на локальном стенде; на сервере — после релиза, по подтверждению владельца, отдельным небольшим PR с записью проверки.

## Non-goals

- Исправление в Agno (пустые права у Routine из кода) и обновление Agno.
- `Routine(enabled=False)`, новые Routines, изменение текста `MAINTENANCE`, cron и `auto_accept`.
- Изменение расписания `Company automation` (`GET /company/attention`): только проверить, работает ли оно.
- Вход администратора в API, токены `akadmin`, постоянный секрет `sa-routines` на сервере.
- Изменения в ядре, биллинге, фронтенде.

## Impact

- Authentik: новая группа и учётная запись применяются blueprints при запуске и деплое.
- AgentOS: новая роль `routines` в сохранённых ролях Agno (заменяется при каждом запуске, как остальные).
- Сохранённое состояние: у Routine `this-agentos.agentos-maintenance` в payload появляется снимок прав `sa-routines` (поле Agno `_agno_authorization`); при старте API объявления его не перезаписывают.
- Расход: Routine начнёт запускаться каждый день в 09:00 UTC и тратить вызовы модели.
