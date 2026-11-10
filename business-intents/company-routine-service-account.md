# Бизнес-интент: сервисная учётная запись для Routine Company Manager

Статус: решение владельца 2026-11-10 (вариант «сервисная учётная запись» вместо токена администратора); OpenSpec change `company-routine-service-account` создан 2026-11-10, ждёт `/opsx:apply`. Открытые вопросы закрыты допущениями change: группа `routines`, учётная запись `sa-routines` без постоянного пароля. Владелец: lehard. Обновлено: 2026-11-10.
Рамки: мастер-спеки `auth` («Сопоставление групп и scopes», «Сервисные учётные записи плагинов», «Контракт токена»), `agent-tracing` (в журнале должны быть и запуски `company-manager-internal`), `AGENTS.md` (Company, Routines, «Production and saved state»).

## Why

Ежедневная Routine `agentos-maintenance` (`agno/app/company.py`, исполнитель `company-manager-internal`, 09:00 UTC) на продакшне ни разу не запустилась (проверка 2026-11-10, только чтение):

- `ai.agno_schedule_runs`: все 4 запуска с создания расписания — `failed`, `403 {"detail":"Insufficient permissions for scheduled target"}`. Агент не стартовал, поэтому и трасс в Phoenix нет.
- `ai.agno_schedules`, `this-agentos.agentos-maintenance`: `managed_by=company`, `user_id` пуст, в payload нет `_agno_authorization`. Расписание создано из объявления в коде, без человека.

Причина — в Agno 3.1.10, не в наших группах:

1. Планировщик (`agno/scheduler/executor.py`, `_call_endpoint`) для Routine без сохранённых прав собирает пустой снимок прав (`principal_id=None`, без scopes, `company_routine_unscoped`).
2. Проверка токена (`agno/os/middleware/jwt.py`, `_deny_for_schedule_owner`) проверяет по этому снимку маршрут `POST /agents/company-manager-internal/runs`, а пустой снимок его не проходит. Решение воспроизведено локально на закреплённом Agno: `allowed: False`.
3. Пока проверка токенов включена, Routine, объявленная в коде, не запускается никогда. В 3.1.11 и 3.1.12 это не исправлено.

Agno даёт Routine права человека, когда расписание правит вызывающий с токеном: правка payload через `PATCH /schedules/{id}` сохраняет снимок его прав (`stamp_authorization`), и следующие запуски идут с ним. Сделать это токеном администратора нельзя: в продакшне `admins` входят только на `admin.soavtor.app`, а `akadmin` держим без API-токенов и паролей приложений. У групп авторов нужных scopes нет. Писать снимок в базу вручную значит обходить проверки Agno; это запрещено.

## What Changes

1. **Новая группа Authentik для Routine Company Manager** (рабочее имя `routines`; см. Open Questions) в `auth/blueprints/10-groups.yaml` и в `GROUP_SCOPES` (`agno/app/auth/authorization.py`). Права — только на то, что нужно Routine, которая предлагает работу:
   - запуск `agents:company-manager-internal:run`;
   - сохранение прав в расписании `schedules:read`, `schedules:write`;
   - чтение Company: `products:read`, `sources:read`, `projects:read`, `tasks:read`, `wiki:read`, `decisions:read`;
   - предложения: `projects:write`, `tasks:write`.
   Без `agent_os:admin`, без `agents:run`, `agents:*:run` и без запуска OS Manager и `claude-engineer`. Точный перечень сверяется с проверками инструментов Company в закреплённом Agno (`agno/tools/company.py`, `agno/os/scopes.py`) на этапе design. Принятие задач и правку расписаний самой Routine Agno запрещает и так (`_RoutineAuthorization`).
2. **Сервисная учётная запись этой группы** в `auth/blueprints/40-service-accounts.yaml`, без постоянного пароля приложения в blueprint (см. Open Questions).
3. **Команда, которая один раз даёт Routine права этой учётной записи.** Скрипт в `scripts/` получает токен учётной записи (client credentials, как `scripts/auth_check.sh`) и правит payload расписания `this-agentos.agentos-maintenance` через `PATCH /schedules/{id}`, не меняя текст и время. Agno сохраняет снимок прав. Работает локально и на сервере; на сервере запускается по подтверждению владельца после релиза.
4. **Контракт токена:** в спеке `auth` закрытый перечень групп дополняется новой группой, сопоставление групп и scopes её описывает.
5. **Документация:** `AGENTS.md`, раздел про Company, — Routine из кода получает права только этой командой; без неё она получает 403. README, раздел модуля auth, — новая группа и учётная запись.

## Scope

- `auth/blueprints/10-groups.yaml`, `auth/blueprints/40-service-accounts.yaml`.
- `agno/app/auth/authorization.py` (`GROUP_SCOPES`), `scripts/check_auth_boundary.sh` (перечень групп).
- Новый скрипт в `scripts/` для сохранения прав Routine.
- Спеки `auth` (сопоставление групп, контракт токена, сервисные учётные записи), при необходимости `runtime` или `orchestrator` (как запускаются Routines из кода).
- `AGENTS.md`/`CLAUDE.md`, README.
- Проверка: локальный стенд, затем сервер после релиза (отдельный небольшой PR с записью проверки, по `dev-workflow`).

## Non-goals

- Исправление в самом Agno (что объявленная в коде Routine получает пустые права); можно сообщить в Agno отдельно.
- Обновление Agno до 3.1.12 и `Routine(enabled=False)`.
- Автоматическое принятие предложений (`auto_accept`), новые Routines, изменение текста `MAINTENANCE` и расписания.
- Права для расписания `agno-company-automation` (`GET /company/attention` каждый час), если оно не нуждается в правке; проверить в design.
- Вход администратора в API, токены для `akadmin`.

## Constraints (из контекст-пака)

- Без fallback: если токена учётной записи нет или Agno отказал, скрипт падает с ошибкой, называющей причину; Routine без сохранённых прав не обходится другим путём.
- Группы и их права задаются кодом и заменяют сохранённые при каждом запуске (спека `auth`); `check_auth_boundary.sh` сверяет перечень групп blueprints и `GROUP_SCOPES`.
- Секреты учётной записи не попадают в код, blueprints, образы, коммиты и чат.
- Изменение на сервере — только после подтверждения владельца в чате; код на сервер — только релизом из `main`.

## Acceptance criteria

- После запуска скрипта у расписания `this-agentos.agentos-maintenance` в payload есть сохранённые права новой учётной записи; текст, cron и исполнитель не изменились.
- Ручной запуск Routine (`POST /schedules/{id}/trigger` или `/company/routines/{id}/trigger`) и плановый запуск в 09:00 UTC проходят без 403: в `ai.agno_schedule_runs` статус не `failed 403`, в Phoenix есть трасса запуска `company-manager-internal`.
- Токен новой группы получает `403` на запуск `os-manager-internal`, `claude-engineer` и `coauthor` и на маршруты администратора (`/users`).
- `./scripts/validate.sh` проходит, включая проверку границы `auth`.

## Risks

- **Снимок прав застывает.** Agno берёт группы из claims сохранённого токена, а права группы — из текущего сопоставления, поэтому изменение `GROUP_SCOPES` действует сразу. Но если учётную запись удалить или убрать из группы, Routine продолжит работать со старым снимком, пока права не сохранят заново. Отзыв — правка расписания другим токеном или выключение Routine.
- **Routine тратит деньги каждый день.** Каждый запуск идёт к модели (обзор релизов Agno и кода). Стоимость видна в отчёте использования; при лишних тратах — выключить Routine.
- **Перечень scopes неполный.** Если инструменту Company Manager не хватит права, запуск упадёт на инструменте, а не на маршруте. Проверить ручным запуском на локальном стенде до сервера.
- **Сохранённый снимок содержит claims токена.** У сервисной учётной записи в нём нет почты и имени, только `sub` и `groups`.

## Open Questions

- Имя группы: `routines` или другое.
- Пароль приложения учётной записи. Рекомендация: в blueprint не задавать; владелец выдаёт временный пароль приложения в админке Authentik на время запуска скрипта и затем удаляет. Альтернатива — постоянный пароль из env-файла сервера, как у `sa-dev`, но тогда на сервере лежит постоянный секрет с правом запускать Company Manager.
- Нужно ли то же для расписания `agno-company-automation`; по истории запусков у него нет записей в `ai.agno_schedule_runs`.

## References

- `agno/app/company.py` — объявление Routine `agentos-maintenance`.
- `agno/app/auth/authorization.py` — `GROUP_SCOPES`, `build_authorization` (`roles_claim="groups"`).
- Agno 3.1.10: `agno/scheduler/executor.py` (`_call_endpoint`), `agno/os/middleware/jwt.py` (`_deny_for_schedule_owner`), `agno/os/authz/run_context.py` (`restore_authorization`), `agno/os/authz/engine.py` (`EngineAuthorizationProvider`), `agno/os/routers/schedules/router.py` (`stamp_authorization` при правке), `agno/tools/company.py`.
- `auth/blueprints/30-authentication-flow.yaml` — вход суперпользователя только на адресе админки; README, «Admin interface».
- Данные продакшна 2026-11-10: `ai.agno_schedules` (id `ce2c04bf-2992-45d2-b2a9-448df6e5d522`), `ai.agno_schedule_runs` (4 запуска, все 403).
