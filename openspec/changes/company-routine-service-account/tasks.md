# Tasks

Проверки на локальном стенде идут из worktree этой ветки. API с кодом ветки запускается `./scripts/dev.sh api`, а для этого порт 8000 должен быть свободен. Контейнер `agentos-api` основной папки останавливается и возвращается (`docker start agentos-api`) только с согласия владельца и по договорённости с сессиями, которые пользуются портом. Blueprints применяются к общему локальному Authentik: новая группа и учётная запись только добавляются, чужие записи не меняются. Временные пароли приложения `sa-routines` удаляются в конце каждой проверки. На сервере в этом change ничего не меняется.

## 1. Группа и учётная запись

- [ ] 1.1 Добавить группу `routines` в `auth/blueprints/10-groups.yaml` и её перечень scopes в `GROUP_SCOPES` (`agno/app/auth/authorization.py`) по design, решение 1, с комментарием, почему каждой группы прав достаточно и чего у неё нет; проверить: `./scripts/check_auth_boundary.sh` проходит, а с группой, убранной из blueprints, падает с её именем
- [ ] 1.2 Добавить учётную запись `sa-routines` (`type: service_account`, группа `routines`, без `authentik_core.token`) в `auth/blueprints/40-service-accounts.yaml` (design, решение 2); проверить на локальном стенде: после применения blueprints (`ak apply_blueprint` в `authentik-worker`) учётная запись есть в группе `routines`, токенов и паролей приложения у неё нет
- [ ] 1.3 Тест в `agno/tests/` на сопоставление: у `routines` есть `agents:company-manager-internal:run`, нет `agent_os:admin`, `agents:run`, `agents:*:run`, других `agents:<id>:run` и `*:delete`; проверить: `./scripts/dev.sh test` проходит, тест падает, если добавить группе `agent_os:admin`
- [ ] 1.4 Документация модуля auth: README («Module auth»: группа `routines`, учётная запись `sa-routines`, временный пароль приложения и его удаление), строки про группы в `AGENTS.md`/`CLAUDE.md`; проверить: в README и `AGENTS.md` перечень групп совпадает с `GROUP_SCOPES`

## 2. Сохранение прав Routine

- [ ] 2.1 Написать `scripts/routines_authorize.sh` по design, решение 4: `.env` (`AUTH_ISSUER`, `AUTH_FRONTEND_CLIENT_ID`, `AGENTOS_URL`), пароль приложения со stdin, токен `client_credentials`, `GET /company/routines` по всем страницам, `PATCH /company/routines/{id}` с тем же `executor_type` и `executor_id`, явный перечень Products (`this-agentos`), отказ с кодом 1 на любом ответе не `2xx` и на неизвестном Product, без печати пароля и токена; проверить: `bash -n`, `shellcheck`, если он есть в `validate.sh`; пустой stdin — код 1 с сообщением о пароле до сетевых запросов
- [ ] 2.2 Проверить на локальном стенде с API ветки (`./scripts/dev.sh api`): до запуска скрипта ручной запуск Routine (`POST /company/routines/{id}/trigger` токеном `sa-routines`) отвечает или записывает `403`; создать временный пароль приложения `sa-routines` через `ak shell`, передать его в скрипт; скрипт печатает `this-agentos.agentos-maintenance`; в `ai_dev_<worktree>.ai.agno_schedules` у Routine в payload есть `_agno_authorization` с `sub` `sa-routines` и группой `routines`; `payload.message`, `cron_expr`, `timezone`, `target_type`, `target_id` прежние (сравнить с записью до запуска)
- [ ] 2.3 Проверить запуск с сохранёнными правами: ручной запуск Routine проходит без `403`, в `ai.agno_schedule_runs` новой базы запуск не `failed 403`, в Phoenix (`http://127.0.0.1:6006`) есть трасса `company-manager-internal`; если запуск падает на праве инструмента — дополнить перечень scopes по design, решение 1, записать причину и повторить; право шире перечня design — остановиться и спросить владельца. Запуск тратит вызовы модели
- [ ] 2.4 Проверить, что права переживают перезапуск: остановить и снова запустить `./scripts/dev.sh api`, снимок прав в payload Routine на месте
- [ ] 2.5 Проверить отказы токеном `sa-routines`: `POST /agents/os-manager-internal/runs`, `POST /agents/claude-engineer/runs`, `POST /agents/coauthor/agui` и `GET /users` отвечают `403`, `GET /company/routines` — `200`; затем удалить временный пароль приложения и убедиться, что токен по нему больше не выдаётся
- [ ] 2.6 Проверить расписание `Company automation` на той же базе: пишет ли оно историю и проходит ли без `403`; результат записать в `tmp/VERIFY.md`; если оно получает `403` по той же причине — остановиться и предложить владельцу дополнить change
- [ ] 2.7 Документация: `AGENTS.md`/`CLAUDE.md`, раздел Company (Routine из кода получает права только `scripts/routines_authorize.sh`, без них — `403`; когда запускать повторно; как приостановить), README — шаг после релиза: `ssh authorled 'cd /srv/authorled/app && ./scripts/routines_authorize.sh'` с паролем на stdin; проверить: описанные команды совпадают со скриптом

## 3. Итоговые проверки

- [ ] 3.1 `./scripts/validate.sh`, `git diff --check` и `./scripts/dev.sh test` проходят; результаты проверок 1.2–2.6 записаны в `tmp/VERIFY.md` с разделением на статические, детерминированные, модельные и контейнерные; контейнер `agentos-api` основной папки возвращён, если его останавливали

## Workflow follow-up

- После merge и релиза — по подтверждению владельца: владелец создаёт временный пароль приложения `sa-routines` в `https://admin.soavtor.app/if/admin/`, запускается `ssh authorled 'cd /srv/authorled/app && ./scripts/routines_authorize.sh'` с паролем на stdin, пароль удаляется; проверить ручным запуском или ближайшим запуском в 09:00 UTC, что в `ai.agno_schedule_runs` нет `403` и в Phoenix есть трасса. Запись проверки — небольшой PR от свежего `origin/main`.
