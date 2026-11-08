# Tasks

## 1. Пароль приложения writer

- [ ] 1.1 В `auth/blueprints-dev/dev-users.yaml` дать записи `writer` `id` и добавить токен `writer-dev-token` (`intent: app_password`, `key: !Env AUTH_DEV_WRITER_TOKEN`, `expiring: false`, пользователь через `!KeyOf`) по образцу `sa-dev-token`; в шаге `auth-users` `scripts/dev.sh` читать `AUTH_DEV_WRITER_TOKEN` из `.env`, отвергать пустое значение и `***` с именем переменной до любого изменения и передавать его в `ak apply_blueprint` через `-e`; добавить `AUTH_DEV_WRITER_TOKEN=***` в блок «Development only» `example.env` с подсказкой `openssl rand -hex 24`; проверить: `./scripts/dev.sh auth-users` без переменной — ошибка с её именем, с ней — успех и `curl` `client_credentials` с `username=writer` выдаёт токен с `groups: ["screenwriters"]`, `email` и `name` (вывод без токена)
- [ ] 1.2 В README («Development users» и таблица переменных) описать `AUTH_DEV_WRITER_TOKEN`: что это пароль приложения `writer` только для локального стенда и что он нужен eval соавтора; проверить, что описанная команда `auth-users` выполняется как написано

## 2. Удостоверение для доверенного кода в модуле auth

- [ ] 2.1 Добавить `agno/app/auth/dev_caller.py`: `DevCaller` (`authorization`, `subject`, `identity`), `verified_caller(app, token)` (проверка `JWTValidator` с `JWT_JWKS_FILE`, `RS256`, `AUTH_ISSUER`, аудиторией `AUTH_FRONTEND_CLIENT_ID`; `groups` — список строк; непустые `email` и `name`; полномочия через `restore_authorization` с `service_account=False`, `enforce_tools=False`) и `dev_writer_caller(app)` (`RUNTIME_ENV == "dev"` до любого запроса, обязательные переменные, `***` = нет значения, запрос токена `urllib.request` с таймаутом 30 с, адрес Authentik из `AUTH_ISSUER` как в `auth_check.sh`); ошибки называют переменную, адрес или поле `error` ответа и никогда не содержат пароль или токен; экспортировать из `app/auth/__init__.py`; проверить `./scripts/check_auth_boundary.sh` и mypy
- [ ] 2.2 Добавить pytest `agno/tests/test_dev_caller.py` с JWKS из сгенерированного ключа RSA во временном файле: верный токен даёт полномочия, с которыми `run_principal` возвращает `sub` и группу `screenwriters`; чужая подпись, чужой `iss`, чужой `aud`, истёкший `exp`, нет `groups`, нет `email` — ошибка с причиной; `RUNTIME_ENV=prd` — ошибка без сетевого запроса; нет `AUTH_DEV_WRITER_TOKEN` или он `***` — ошибка с именем; в тексте ошибок нет значения секрета; проверить `./scripts/dev.sh test`

## 3. Случай соавтора в eval

- [ ] 3.1 Добавить `agno/evals/caller.py` с асинхронными `writer_setup()` и `writer_teardown(context, result)`: `setup` вызывает `dev_writer_caller(app)` через `asyncio.to_thread`, заводит аккаунт `get_or_create_user` в транзакции `get_engine().begin()`, входит в `authorization_scope(lambda: caller.authorization)` и возвращает открытый контекст-менеджер; `teardown` его закрывает; подключить к `coauthor_uses_context` в `agno/evals/cases.py` (`setup=`, `teardown=`), не трогая случаи `smoke`; проверить `./scripts/check_auth_boundary.sh` (в `agno/evals/` нет `jwt` и `authentik`) и mypy
- [ ] 3.2 Перенести дельты в мастер-спеки `runtime` («Evals» — `RUNTIME_ENV` обязателен без значения по умолчанию; «Eval соавтора от имени пользователя разработки») и `auth` («Пользователи для разработки», «Полномочия запуска для доверенного кода»); в README (раздел про evals) описать, что `--tag coauthor` запускается на хосте после `auth-users` с `AUTH_DEV_WRITER_TOKEN`, тратит лимит `writer` и из контейнера API не работает; в `AGENTS.md` (раздел Verification) заменить «The CLI defaults to `dev` unless configured otherwise» на то, что CLI требует `RUNTIME_ENV` (`dev` или `prd`) без значения по умолчанию; проверить `openspec validate eval-verified-caller --strict` и что `python -m evals --list` без `RUNTIME_ENV` падает с ошибкой, называющей переменную

## 4. Проверки целиком

- [ ] 4.1 На хосте (`agno/.venv`, локальный стенд в Docker, `RUNTIME_ENV=dev`, `JWT_JWKS_FILE=auth/jwks/jwks.json`, `DB_HOST=127.0.0.1`, `LITELLM_URL=http://127.0.0.1:4000`, `CLAMAV_HOST=127.0.0.1`, `CLAMAV_PORT=3310`) выполнить `python -m evals --tag coauthor`: случай доходит до модели, судья — PASS, причина прочитана; в журнале расхода есть запись запуска у `writer@authorled.test` (`./scripts/usage.sh local report`)
- [ ] 4.2 Проверить отказы eval соавтора без вызова модели и с ненулевым кодом: без `AUTH_DEV_WRITER_TOKEN` (имя переменной), с неверным паролем приложения (`invalid_grant`), с `RUNTIME_ENV=prd` (ошибка до запроса); убедиться, что в выводе нет секрета и токена
- [ ] 4.3 Выполнить `python -m evals --tag smoke` с остановленным Authentik и без `AUTH_DEV_WRITER_TOKEN`: три случая идут как раньше
- [ ] 4.4 Пройти `./scripts/validate.sh` (в `agno/.venv`, `env -u BASH_ENV`), `./scripts/dev.sh test` и `git diff --check`; записать в `tmp/VERIFY.md` статические, детерминированные, модельные и контейнерные результаты отдельно, с пометкой, что eval соавтора в контейнере API не запускается по дизайну

## Workflow follow-up

- `/opsx:verify` и `/opsx:archive` запускает владелец.
- После слияния: добавить `AUTH_DEV_WRITER_TOKEN` в свой `.env` и выполнить `./scripts/dev.sh auth-users`.
