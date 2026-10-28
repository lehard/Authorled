# Tasks

## 1. Фрагмент compose модуля auth

- [x] 1.1 Сохранить эталон: `docker compose config > tmp/compose-before.yaml` и `docker compose -f compose.yaml -f compose.prod.yaml config > tmp/compose-prod-before.yaml` (с текущим `.env`); проверить, что оба файла непустые
- [x] 1.2 Перенести `authentik-db-init`, `authentik-server`, `authentik-worker`, `authentik-jwks-export` (с якорем `&authentik-env` и комментариями) в `modules/auth/compose.yaml` с путями томов относительно `modules/auth/`; в корневом `compose.yaml` добавить `include: [modules/auth/compose.yaml]` (D1); проверить: `docker compose config` и prod-вариант совпадают с эталонами из 1.1 (`diff` пустой по сервисам модуля, путям и переменным); после сравнения удалить оба эталона — в них раскрыты секреты из `.env`
- [x] 1.3 Добавить в `scripts/check_auth_boundary.sh` поиск `goauthentik/server` в `compose*.yaml` вне `modules/auth/` (D5); проверить: скрипт проходит, а при временно добавленном образе Authentik в корневой `compose.yaml` падает с сообщением
- [x] 1.4 Обновить описание расположения сервисов Authentik в `AGENTS.md` (раздел «Where changes belong»), `README.md` (раздел «Module auth») и комментариях `compose.prod.yaml`; сверить ADR-001 и `openspec/context/03-architecture.md` — они уже говорят о compose-фрагменте, правка не нужна, если формулировка совпадает; проверить `grep -rn "compose.yaml" AGENTS.md README.md` на устаревшие утверждения

## 2. Контракт токена

- [x] 2.1 Добавить в `scripts/check_auth_boundary.sh` сверку групп (D2): имена `authentik_core.group` из `modules/auth/blueprints/*.yaml` против ключей `GROUP_SCOPES`; при ошибке импорта или несовпадении — выход с ненулевым кодом и именем группы; проверить: проходит на текущем репозитории и падает, если временно добавить группу только в blueprints и только в `GROUP_SCOPES`
- [x] 2.2 Сослаться на требование «Контракт токена» спеки `auth` из docstring `app/auth/authorization.py` у `GROUP_SCOPES` и из комментария в `modules/auth/blueprints/10-groups.yaml`; проверить `./scripts/validate.sh`

## 3. Роль Agno без суперпользователя

- [x] 3.1 На существующей локальной базе (до изменений) записать в `tmp/VERIFY.md`: схему расширения `vector`, владельцев схемы `ai` и её таблиц, атрибуты роли `ai`; закрывает Open Question design
- [x] 3.2 Написать `db/init.sql` по D3 (роль `agentos`, схема `ai`, расширение `vector`, передача владения кроме объектов расширения, `search_path`); добавить сервис `agentos-db-init` в корневой `compose.yaml`, у `agentos-api` — `DB_USER: agentos`, `DB_PASS: ${AGENTOS_DB_PASSWORD:?AGENTOS_DB_PASSWORD must be set in .env}` и зависимость от `agentos-db-init`; убрать `DB_PASS` у `agentos-api` в `compose.prod.yaml` и добавить там `PGPASSWORD: ${DB_PASS:?…}` для `agentos-db-init`; проверить: два `docker compose up` подряд проходят без ошибок (идемпотентность)
- [x] 3.3 Проверить на существующей базе: после `up` владелец схемы `ai` и её таблиц — `agentos`, `GET /sessions` с токеном возвращает сохранённые сессии, `/config` отвечает; на пустой базе (`./scripts/dev.sh reset-db --yes`, затем `up`) API стартует и создаёт таблицы в `ai` (факт: сессий в локальной базе не было — проверено чтение ролью `agentos` записей Company, расписаний и трейсов, созданных суперпользователем; пустая база поднята отдельным проектом `-p authorled-verify` вместо `reset-db`, чтобы не стирать рабочий том)
- [x] 3.4 Проверить изоляцию: под `agentos` `SELECT` из таблицы `authentik.*` завершается отказом в правах, `rolsuper` у `agentos` — `false`; под `authentik` `SELECT` из `ai.*` по-прежнему отказ
- [x] 3.5 Проверить отказ без переменной: `docker compose config` без `AGENTOS_DB_PASSWORD` в `.env` завершается ошибкой, называющей переменную
- [x] 3.6 Обновить `scripts/dev.sh` по D4 (`DB_USER=agentos`, пароль из `AGENTOS_DB_PASSWORD` с явной ошибкой, `agentos-db-init` в `api`); проверить: `./scripts/dev.sh api` поднимает API на хосте и `./scripts/auth_check.sh` проходит
- [x] 3.7 Документация роли: `example.env` (обязательная `AGENTOS_DB_PASSWORD` в блоке Required, пояснение, что `DB_PASS` в prod — пароль загрузочного суперпользователя), `README.md` (таблица переменных, раздел про prod и смену пароля БД), `AGENTS.md`, `.agents/skills/setup-platform/SKILL.md`, `.agents/skills/deploy-platform/SKILL.md`; `openspec/context/03-architecture.md` и `05-security-and-compliance.md` — убрать «обратная изоляция не обеспечивается», описать роль `agentos`; проверить `grep -rn "обратная изоляция\|DB_USER" README.md AGENTS.md openspec/context example.env .agents/skills`

## 4. Итоговые проверки

- [x] 4.1 `./scripts/validate.sh` и `git diff --check` проходят
- [x] 4.2 `./scripts/auth_check.sh` и `./scripts/mcp_check.sh` проходят против API в контейнере
- [x] 4.3 Записать результаты в `tmp/VERIFY.md` раздельно (static, deterministic, container); отметить, что prod-хост не проверялся
