# Проверки company-routine-service-account (2026-11-10)

## Статические

- `./scripts/check_auth_boundary.sh`: проходит; с группой `routines`, убранной из `auth/blueprints/10-groups.yaml`, падает и называет её.
- `bash -n scripts/routines_authorize.sh`: без ошибок; shellcheck на Mac не установлен.
- `./scripts/validate.sh`, `git diff --check`: прошли (после merge `origin/main`).
- `openspec validate company-routine-service-account --strict`: valid.

## Детерминированные

- `./scripts/dev.sh test` (`ai_test_payments_tochka_a9b7da`): 932 passed. `tests/test_auth_groups.py` падает, если группе `routines` добавить `agent_os:admin`.
- `routines_authorize.sh` с пустым stdin: код 1 до сетевых запросов; с удалённым паролем приложения: код 1, «token: Authentik answered 400».

## На локальном стенде

`agentos-api` основной папки остановлен с 10:10 до 10:37 UTC с согласия владельца и после ответа соседних сессий, потом `docker start`. API ветки — `./scripts/dev.sh api` на `ai_dev_payments_tochka_a9b7da`. Blueprints ветки применены к локальному Authentik через `Importer.from_string` в `ak shell`: `sa-routines` — сервисная учётная запись в `routines`, токенов 0. Временный пароль приложения создан в `ak shell` и удалён после проверок.

- Ручной запуск идёт с правами вызывающего, поэтому плановый путь проверен иначе: cron Routine через `PATCH /company/routines/{id}` (только cron, права не сохраняются) ставился `* * * * *` и возвращался `0 9 * * *` после каждого запуска.
- До скрипта: в payload нет `_agno_authorization`; плановый запуск 10:13:12 — `failed 403 Insufficient permissions for scheduled target`, как на продакшне.
- Скрипт: «authority of sa-routines saved in this-agentos.agentos-maintenance»; в payload `_agno_authorization` с `sub` `sa-routines` и группами `["routines"]`; md5 `payload.message`, cron, `target_type`, `target_id` прежние.
- Плановый запуск 10:14:12: `POST /agents/company-manager-internal/runs` → 202, но опрос `GET /agents/company-manager-internal/runs/{id}` → 403, запуск записан `failed 403`, хотя агент работал; `log_company_decision` отказан (`decisions:write`). Оба scope добавлены (design, решение 1).
- После перезапуска API сохранённые права на месте.
- Плановый запуск 10:25:07 с новыми scopes: без 403 (`status_code 200`), все решения авторизации `routines` — True; в Company 6 задач Backlog, ничего не принято; в Phoenix 2 корневые трассы `Company_Manager.arun`.
- Токен `sa-routines`: `POST /agents/os-manager-internal/runs`, `/agents/claude-engineer/runs`, `/agents/coauthor/runs`, `/agents/coauthor/agui`, `GET /users` → 403; `GET /company/routines`, `/company/tasks` → 200.
- `Company automation` выполняется внутри процесса (`agno/company/routines.py`, `_AUTOMATION_SCHEDULE_ID`), без HTTP и снимка прав: 403 его не касается, строк в `agno_schedule_runs` он не пишет.

## Модельные (вне этого change)

Оба локальных запуска закончились `failed` проверкой ответа Agno (`CheckTrigger.OUTPUT_NOT_ALLOWED`), хотя предложения в Backlog сделаны: в первом модель сначала вызывала `propose_company_task` (Routine должна предлагать через `intake_product_source`), во втором прочитала папку как файл. Поведение агента Routine, не авторизации.

## На сервере

- Релиз `v0.3.15` (PR lehard/Authorled#66): деплой `success`; `sa-routines` — сервисная учётная запись в группе `routines`, токенов 0; роль `routines` в `ai.agno_authz_roles`; `https://app.soavtor.app/os/health` → 200.
- Временный пароль приложения создан владельцем в `admin.soavtor.app` (Directory → Tokens and App passwords), передан через stdin: `ssh authorled 'cd /srv/authorled/app && ./scripts/routines_authorize.sh'` → «authority of sa-routines saved in this-agentos.agentos-maintenance», код 0. Локальный файл пароля удалён.
- `ai.agno_schedules`: у `this-agentos.agentos-maintenance` `_agno_authorization` с группами `["routines"]`, cron `0 9 * * *`, `enabled`, исполнитель `agent`/`company-manager-internal`, md5 `payload.message` тот же, что до правки; следующий запуск 2026-11-11 09:00 UTC.
- Не проверено: плановый запуск на сервере (2026-11-11 09:00 UTC). Проверка поставлена задачей `authorled-routine-check-2026-11-11` на 12:45 по Москве.
