# Design

## Context

Как Agno 3.1.10 запускает Routine из кода (проверено по исходникам закреплённой версии и воспроизведено локально):

- При старте `bootstrap.py` засевает Routine из `agno/app/company.py` как расписание `managed_by=company` без `user_id` и без снимка прав в payload. Уже существующее расписание он не трогает, поэтому сохранённые правки переживают перезапуск.
- Планировщик (`scheduler/executor.py`, `_call_endpoint`) шлёт запрос с внутренним токеном и заголовком `X-Agno-Run-Authorization`. Для Routine без снимка это пустой снимок `company_routine_unscoped`.
- Проверка токена (`os/middleware/jwt.py`, `_deny_for_schedule_owner`) восстанавливает снимок (`os/authz/run_context.py`) и спрашивает у его провайдера, можно ли вызвать `POST /agents/company-manager-internal/runs`. У пустого снимка нет ни scopes, ни `admin_scope`, поэтому ответ — 403.
- Снимок прав человека Agno сохраняет сам: правка Routine через `PATCH /company/routines/{id}`, которая меняет исполнение (payload или endpoint), сначала проверяет право вызывающего на запуск цели (`_require_endpoint_permission`), а затем пишет его снимок (`stamp_authorization`). Править Company-расписание через `/schedules/{id}` нельзя (409).
- В снимке хранятся контекст вызывающего: `principal_id` (`sub`), scopes и claims токена. При восстановлении провайдер приложения (`EngineAuthorizationProvider`, `roles_claim="groups"`) берёт роли из claims снимка, а права ролей — из текущих сохранённых ролей, которые `build_authorization` заменяет при каждом старте.
- Запуск без владельца Agno поддерживает: `user_id` запуска остаётся `None` (`os/routers/agents/router.py`, ветка `INTERNAL_SCHEDULER_USER_ID`).
- У Routine свои ограничения Agno: `_RoutineAuthorization` запрещает менять расписания, а принятие работы требует человека. Права группы на это не влияют.

Ограничения репозитория: JWT и claims читаются только в `agno/app/auth/` (`check_auth_boundary.sh`), перечень групп blueprints и `GROUP_SCOPES` совпадает, секреты не попадают в код и env-файлы проекта без нужды, без fallback.

## Goals / Non-Goals

**Goals:**
- Routine из кода запускается по расписанию с узкими правами сервисной учётной записи, без прав администратора.
- Одна воспроизводимая команда сохраняет эти права в Routine локально и на сервере.
- Постоянного секрета с правом запускать Company Manager нет.

**Non-Goals:**
- Исправление поведения Agno, обновление Agno, `Routine(enabled=False)`.
- Изменение текста, cron и `auto_accept` Routine.
- Своё хранение прав или свой обход проверки Agno.

## Decisions

1. **Группа `routines` с явным перечнем scopes.** В `GROUP_SCOPES`:
   - `agents:company-manager-internal:run` и `agents:company-manager-internal:read` — запуск и чтение своего запуска: планировщик после `202` опрашивает `GET /agents/company-manager-internal/runs/{id}`, и без права чтения запуск записывается `failed 403`, хотя агент работает (найдено на стенде 2026-11-10);
   - `routines:read`, `routines:write`, `schedules:read`, `schedules:write` — маршруты `GET/PATCH /company/routines/*` (`os/scopes.py`);
   - `products:read`, `sources:read`, `projects:read`, `tasks:read`, `wiki:read`, `decisions:read` — чтение, которое проверяют инструменты Company (`tools/company.py`);
   - `projects:write`, `tasks:write` — предложения работы;
   - `decisions:write` — Company Manager записывает причины своих предложений в журнал решений Company (`log_company_decision`; найдено на стенде 2026-11-10).
   Без `agent_os:admin`, `agents:run`, `agents:*:run`, `*:delete`, `products:write`, `sources:write`, `wiki:write`: Routine только предлагает. Если ручной запуск на стенде покажет, что инструменту не хватает права, перечень дополняется точечно, с записью причины в `tmp/VERIFY.md`; при необходимости более широкого права — остановиться и спросить владельца.
   *Альтернатива:* выдать группе `agent_os:admin` — отклонено: снимок с правами администратора в базе и запуск OS Manager.

2. **Учётная запись `sa-routines` без пароля приложения в blueprints.** В `40-service-accounts.yaml` объявляется пользователь `type: service_account` в группе `routines`, без `authentik_core.token`. Пароль приложения владелец создаёт в админке Authentik (локально `http://localhost:9000/if/admin/`, на сервере `https://admin.soavtor.app/if/admin/`) только на время запуска команды и удаляет после. Локально для проверки исполнитель создаёт временный пароль приложения командой `ak shell` в `authentik-worker` и удаляет его после проверки (тестовое значение, на локальном стенде).
   *Альтернатива:* бессрочный пароль из env, как у `sa-dev` — отклонено: постоянный секрет на сервере с правом запускать Company Manager.

3. **Права сохраняет `PATCH /company/routines/{id}` с тем же исполнителем.** Тело: `{"executor_type": <target_type>, "executor_id": <target_id>}` — значения из `GET /company/routines`. Так Agno пересчитывает endpoint (он не меняется), проверяет право на запуск цели и сохраняет снимок вызывающего; текст и cron не трогаются. Передавать `instructions` заново не нужно: точный текст хранится в payload с префиксом Agno, и пришлось бы зависеть от его внутреннего формата.
   *Альтернатива:* писать `_agno_authorization` в базу напрямую — отклонено: обход проверок Agno.

4. **Скрипт `scripts/routines_authorize.sh` без аргументов цели.** Читает `.env` той папки, где запущен: `AUTH_ISSUER` (адрес Authentik — его начало до `/application/o/`, как в `auth_check.sh`), `AUTH_FRONTEND_CLIENT_ID`, `AGENTOS_URL` (локально `http://127.0.0.1:8000`, на сервере `https://app.soavtor.app/os`). Пароль приложения — со stdin, не аргументом и не из env. Шаги:
   1. токен `client_credentials` с `username=sa-routines`;
   2. `GET /company/routines` (все страницы);
   3. для каждой Routine с `managed_by=company`, Product которой объявлен в `agno/app/company.py`, — `PATCH` с тем же исполнителем;
   4. печать имён Routines, которым права сохранены.
   Любой ответ не `2xx` останавливает скрипт с кодом 1, шагом и кодом ответа, без тела токена. Перечень объявленных Products скрипт берёт из ответа API по имени Routine (`<product_id>.<name>`) и `metadata.product_id`; список ожидаемых Products задаётся в скрипте явно (`this-agentos`), неизвестный Product — ошибка, а не пропуск. JSON разбирается `python3` из системы, как в `auth_check.sh`; Python-код с JWT вне `agno/app/auth/` не появляется. На сервере команда запускается из `/srv/authorled/app` по SSH, пароль идёт через stdin: `ssh authorled 'cd /srv/authorled/app && ./scripts/routines_authorize.sh'`.

5. **Когда запускать.** После первого релиза с этим change и каждый раз, когда Routine пересоздана (новое объявление, удаление и засев заново). Изменение `GROUP_SCOPES` повторного запуска не требует: права роли берутся из текущего сопоставления.

## Risks / Trade-offs

- **Снимок застывает по группам.** В снимке группы из токена на момент сохранения. Удаление `sa-routines` или исключение из группы не отзовёт права Routine, пока их не перезапишут. Отзыв — пауза Routine (`POST /company/routines/{id}/pause`) токеном `sa-routines` по временному паролю или пересохранение. Записывается в README.
- **Неполный перечень scopes.** Проверка инструментом упадёт уже в запуске, после вызова модели. Снижение — ручной запуск на локальном стенде до сервера и разбор трассы и ответа.
- **Расход модели каждый день.** Routine начнёт работать в 09:00 UTC и тратить вызовы; результат — предложения в Backlog. Если они не нужны — пауза Routine.
- **Поведение Agno может измениться при обновлении.** Если новая версия начнёт давать Routine из кода права иначе, требование «Права Routine из кода» пересматривается вместе с обновлением.
- **Существующий fallback, не затрагиваемый этим change:** `GROUP_SCOPES.get(group, ())` в `agno/app/auth/principal.py` даёт неизвестной группе пустые права вместо ошибки. По правилам владельца он не расширяется и выносится в отчёт.
- **`Company automation`** (`GET /company/attention`, каждый час) в `ai.agno_schedule_runs` записей не имеет; проверить на стенде, проходит ли оно и пишет ли историю. Если оно тоже получает 403 по той же причине — остановиться и предложить владельцу дополнить change.
