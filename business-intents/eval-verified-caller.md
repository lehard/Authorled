# Бизнес-интент: eval запускает агентов от имени проверенного пользователя разработки

Статус: вариант согласован с владельцем 2026-11-08 (вариант А: настоящий токен `writer@authorled.test`); change `eval-verified-caller` реализован, проверен локально и архивирован 2026-11-08 (`openspec/changes/archive/2026-11-08-eval-verified-caller/`, проверки — `tmp/VERIFY.md`). Владелец: lehard. Обновлено: 2026-11-08.
Рамки: спеки `runtime` («Evals», «Скрипт локальной разработки»), `auth` («Проверка токена», «Principal», «Пользователи для разработки», «Секреты модуля», «Состав и границы модуля»), `core/subscriptions` («Проверка лимита до запуска», «Журнал расхода соавтора»), `api/agents` («Соавтор»); `openspec/context/07-anti-patterns.md` (п. 26: fallback-и).

## Why

С коммита `c7558fc` у соавтора есть хук лимита `check_usage_limit` (`agno/agents/coauthor_usage.py`). Он берёт автора из `run_principal` (`agno/app/auth/principal.py`), а тот требует проверенного пользователя из токена. Это правильно: без проверенного пользователя запуск не должен идти без лимита.

Но `python -m evals` запускает агента напрямую (`agent.arun()` внутри `agno.eval.cli`), а не через HTTP. Проверенного пользователя Agno кладёт в запуск только на HTTP-запросе (`RunAuthorizationMiddleware`). Поэтому в eval его нет, хук отказывает («The agent run has no verified caller»), и случай `coauthor_uses_context` падает с `input_check_error` «Не удалось проверить лимит соавтора» ещё до вызова модели. Это заметили 2026-11-08 при проверке change `rename-soavtor`. С `c7558fc` eval соавтора не работает вообще, и поведение соавтора нельзя проверить кейсами.

В Agno 3.1.10 есть штатный способ для доверенного кода на Python: `agno.run.authorization.authorization_scope` с `RunAuthorization`. Пока он действует, Agno сам подставляет этого пользователя в `RunContext.authorization` каждого запуска, так же как делает HTTP-слой. В `Case` поля для этого нет, есть только `user_id`.

## What Changes

1. **Пароль приложения у `writer`.** `./scripts/dev.sh auth-users` вместе с пользователями разработки создаёт или обновляет у `writer@authorled.test` токен Authentik с intent `app_password` и ключом из нового секрета `.env` `AUTH_DEV_WRITER_TOKEN`. Так уже сделано для служебного `sa-dev` (`AUTH_DEV_SERVICE_TOKEN`). Без секрета команда завершается ошибкой с его именем, как сейчас без `AUTH_DEV_USER_PASSWORD`. Запись в `example.env` в блоке «Development only» с подсказкой, как сгенерировать ключ.
2. **Проверенный пользователь в CLI eval.** До запуска случаев `python -m evals`:
   - убеждается, что `RUNTIME_ENV=dev`; иначе завершается с ошибкой;
   - получает токен `writer` у локального Authentik (`client_credentials`, `username=writer`, пароль приложения), так же как `scripts/auth_check.sh` получает токен `sa-dev`;
   - проверяет токен тем же валидатором Agno (`JWTValidator`), с теми же ключами (`JWT_JWKS_FILE`), издателем (`AUTH_ISSUER`) и аудиторией (`AUTH_FRONTEND_CLIENT_ID`), что и API;
   - запускает все случаи внутри `authorization_scope` с `RunAuthorization`, собранным из проверенных данных токена, и подставляет в случаи `user_id`, равный пользователю из токена.

   Проверка токена и сборка `RunAuthorization` живут в `agno/app/auth/`: это единственное место, которое читает JWT и данные токена (граница модуля `auth`, `check_auth_boundary.sh`). CLI eval только вызывает функцию модуля.
3. **Аккаунт `writer` в ядре.** Если у пользователя из токена ещё нет аккаунта, eval создаёт его тем же путём, что и первый вход (`get_or_create_user` из почты и имени токена, с подпиской тарифа новых аккаунтов). Удалённый аккаунт — ошибка, как в `/api/v1/me`.
4. **Лимит проверяется по-настоящему.** Хуки соавтора и `run_principal` не меняются. Eval тратит лимит `writer`, и расход пишется в журнал. Исчерпанный лимит роняет случай с сообщением о лимите; поднять его можно через `./scripts/usage.sh local set-plan writer@authorled.test <plan>`.
5. **Спеки.** `runtime`, «Evals»: eval запускает случаи от имени проверенного пользователя разработки, случай `coauthor_uses_context` с тегом `coauthor`, сценарии отказа. `auth`, «Пользователи для разработки» и «Секреты модуля»: пароль приложения `writer` и `AUTH_DEV_WRITER_TOKEN`.

## Scope

- `auth/blueprints-dev/dev-users.yaml` или шаг `auth-users` в `scripts/dev.sh`: токен `app_password` у `writer`.
- `example.env`: `AUTH_DEV_WRITER_TOKEN`.
- `agno/app/auth/`: проверка токена разработки и сборка `RunAuthorization`.
- `agno/evals/__main__.py`: получение токена, создание аккаунта, `authorization_scope`, `user_id` случаев.
- Спеки `runtime` и `auth`.
- Проверка: `python -m evals --tag coauthor` проходит на локальном стенде, расход случая есть в журнале; `--tag smoke` проходит как раньше; отказы из Acceptance criteria. Результаты в `tmp/VERIFY.md`.

## Non-goals

- Отключать или ослаблять хуки лимита и журнала в eval, вводить «режим тестов» в `run_principal`.
- Собирать «проверенного» пользователя из настройки без токена (вариант Б, отклонён: пользователя никто не проверяет).
- Гонять eval через HTTP API своим раннером поверх `agno.eval`.
- Запускать eval на сервере или с токенами production.
- Отдельный пользователь или тариф для eval: используется `writer`, его лимит и журнал.
- Менять `Case` или раннер Agno.

## Constraints (из контекст-пака)

- Без fallback (07-anti-patterns, п. 26): нет секрета, Authentik не отвечает, токен не прошёл проверку, `RUNTIME_ENV` не `dev` — eval завершается ненулевым кодом до первого случая и называет, что именно не так. Никакого запуска «без пользователя» или с пользователем по умолчанию.
- Только `agno/app/auth/` читает JWT и данные токена.
- `AUTH_DEV_WRITER_TOKEN` нужен только `auth-users` и eval: `compose.yaml` и `compose.prod.yaml` его не требуют, production без него стартует как сейчас.
- Пароль приложения у `writer` есть только на локальном стенде: blueprint пользователей разработки по-прежнему применяет только `auth-users` и только при `RUNTIME_ENV=dev`.
- Секрет и токен не печатаются в вывод eval.

## Acceptance criteria

- На локальном стенде после `./scripts/dev.sh auth-users` команда `python -m evals --tag coauthor` доходит до модели и оценивает ответ судьёй; в журнале расхода есть запись запуска с пользователем `writer`.
- `python -m evals --tag smoke` проходит как раньше; запуски OS Manager идут от имени `writer`.
- Без `AUTH_DEV_WRITER_TOKEN` eval завершается ненулевым кодом до первого случая и называет переменную.
- С неверным паролем приложения или недоступным Authentik eval завершается ненулевым кодом до первого случая и называет причину.
- Токен с чужой подписью, издателем или аудиторией отклоняется так же, как в API.
- При `RUNTIME_ENV`, отличном от `dev`, eval завершается ненулевым кодом до первого случая.
- При исчерпанном лимите `writer` случай соавтора падает с сообщением о лимите, а не с «Не удалось проверить лимит».
- `./scripts/validate.sh` проходит, граница модуля `auth` соблюдена.

## Risks

- **Authentik может не выдать токен внутреннему пользователю по `client_credentials`.** Сейчас так получают токен только для служебного `sa-dev`. Смягчение: в design проверить на локальном Authentik, что токен `writer` выдаётся и в нём есть `groups`, `email` и `name`. Если нет, вернуться к владельцу, а не подставлять обход.
- **Пароль приложения обходит вход по коду из почты.** Для `writer` это допустимо: пользователь существует только на локальном стенде. Смягчение: ограничения из Constraints.
- **Eval тратит лимит `writer`.** Частые прогоны могут его исчерпать и мешать ручной проверке соавтора тем же пользователем. Смягчение: явное сообщение о лимите и `set-plan`.
- **Токен истекает во время долгого прогона.** `authorization_scope` держит уже проверенные данные, повторной проверки внутри прогона нет; это то же поведение, что у HTTP-запуска, начатого с действующим токеном.

## Open Questions

- Решено 2026-11-08: вариант А (настоящий токен `writer`, проверенный валидатором Agno, запуск в `authorization_scope`).
- Решено 2026-11-08 по рекомендации: eval создаёт аккаунт `writer` в ядре путём первого входа, если его нет; проверенный пользователь передаётся всем случаям, а не только соавтору. Владелец может пересмотреть до `/opsx:propose`.
- Пересмотрено при `/opsx:propose` 2026-11-08: проверенный пользователь передаётся только случаям соавтора, а ошибка получения токена роняет случай соавтора, а не весь прогон. Причина: Agno включает проверку прав для инструментов OS Manager, как только у запуска есть пользователь, а у `screenwriters` нет прав на OS Manager, так что `smoke` сломался бы; кроме того, `--tag smoke` не должен зависеть от Authentik. Пункт 2 What Changes и критерии «до первого случая» и «запуски OS Manager идут от имени `writer`» читать с этой поправкой (`design.md`, решение 2).

## References

- Падение `coauthor_uses_context` при проверке `rename-soavtor` 2026-11-08: `input_check_error` «Не удалось проверить лимит соавтора», в логе «The agent run has no verified caller».
- `agno/agents/coauthor_usage.py` (`check_usage_limit`, `record_usage`), `agno/app/auth/principal.py` (`run_principal`), `agno/evals/__main__.py`, `agno/evals/cases.py`.
- Agno 3.1.10: `agno/run/authorization.py` (`RunAuthorization`, `authorization_scope`; «Explicit RunAuthorization instances enforce by default for trusted Python callers»), `agno/os/authz/run_context.py` (`RunAuthorizationMiddleware`), `agno/os/middleware/jwt.py` (`JWTValidator`), `agno/eval/suite.py` (`Case.user_id`, вызов `arun`).
- `auth/blueprints/40-service-accounts.yaml` (пароль приложения `sa-dev`), `scripts/auth_check.sh` (получение токена), `scripts/dev.sh` (`auth-users`), `agno/core/users.py` (`get_or_create_user`).
