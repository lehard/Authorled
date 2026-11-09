# Tasks

## 1. Поля админки в blueprints

- [x] 1.1 Разделить на запись `state: created` (все поля для создания, `id` для `!KeyOf`) и следующую за ней запись `present` (только поля репозитория) потоки `authorled-authentication` и `authorled-enrollment`, бренд и шаги `authorled-authenticator-email-setup` и `authorled-authentication-password` в `auth/blueprints/30-authentication-flow.yaml`, а также поток `authorled-invalidation` в `auth/blueprints/20-oidc.yaml`, по таблице из `design.md`. Комментарий над каждой парой называет, какие поля принадлежат админке. Проверить, что после `docker compose up -d authentik-server authentik-worker` все четыре экземпляра blueprints в статусе `successful`.
- [x] 1.2 Проверить на локальном стенде сценарии «Правка в админке переживает релиз» и «Поле репозитория восстанавливается»: изменить в админке заголовок бренда, тему письма, число попыток пароля и срок кода, затем изменить комментарий в обоих файлах blueprints и дождаться применения (`ak apply_blueprint` в worker). Первые три значения должны остаться, срок кода должен вернуться к 10 минутам.
- [x] 1.3 Проверить сценарий «Пустая схема получает значения из репозитория» и прежние сценарии «Конфигурации из blueprints» на пустой схеме: `./scripts/dev.sh reset-db --yes` (только с подтверждения владельца), старт стека, `./scripts/auth_check.sh`, вход под `writer@authorled.test` после `./scripts/dev.sh auth-users`.

## 2. Список разрешённых почт

- [x] 2.1 Переписать в политике `authorled-email-not-registered` проверку списка на чтение атрибута `allowed_emails` группы `screenwriters`. При отсутствующей группе или атрибуте и при атрибуте, который не является списком строк, политика создаёт событие `configuration_error` с именем атрибута и группы, отвечает «Регистрация временно недоступна.» и возвращает `False`. Порядок проверок и разбор строк взять из `design.md`. Проверить на локальном стенде сценарии «Нет атрибута», «Неверный атрибут» и «Пустой список»: пользователь не появился, в Mailpit нет письма, событие видно в журнале Authentik.
- [x] 2.2 Проверить на локальном стенде остальные сценарии «Регистрации» и «Списка разрешённых почт»: почта добавлена в админке и проходит сразу, без перезапуска; другой регистр; `["*"]`; занятая почта не из списка даёт тот же отказ, что незнакомая; изменённый blueprint не трогает атрибут.
- [x] 2.3 Убрать `AUTH_ALLOWED_EMAILS` из `auth/compose.yaml`, `example.env` и локального `.env`. Проверить, что `grep -rn AUTH_ALLOWED_EMAILS` вне `business-intents/` и `openspec/changes/archive/` пуст, кроме текста миграции этого change, а `docker compose config` проходит без переменной.

## 3. Локальный стенд

- [x] 3.1 Добавить в `auth/blueprints-dev/dev-users.yaml` запись группы `screenwriters` с `attributes: {allowed_emails: ["*"]}` и обновить комментарии в нём и в `auth-users` в `scripts/dev.sh`. Проверить сценарий «Создание пользователей»: после `./scripts/dev.sh auth-users` у группы есть атрибут, и регистрация новой почты на экране `/login` проходит до кода в Mailpit.

## 4. Документация

- [x] 4.1 Добавить в README («Module auth») раздел «Админка Authentik»: адрес `/if/admin/`, вход под `akadmin` (пароль `AUTHENTIK_BOOTSTRAP_PASSWORD`, код на `AUTHENTIK_BOOTSTRAP_EMAIL`), почему личные аккаунты не добавляют в `admins`, список полей админки, какие правки откатит релиз, как изменить `allowed_emails` (YAML с примером). Убрать `AUTH_ALLOWED_EMAILS` из таблицы переменных и описания деплоя, а также из скиллов `setup-platform` и `deploy-platform`, добавив в `deploy-platform` шаг про атрибут на новом сервере. Проверить, что описанные в README шаги совпадают с проверенными в 1.2 и 2.2.

## 5. Итоговая проверка

- [x] 5.1 Запустить `./scripts/validate.sh` (с `env -u BASH_ENV` после `source agno/.venv/bin/activate`), `./scripts/check_auth_boundary.sh`, `./scripts/auth_check.sh` и `git diff --check`, убедиться, что реальных почт в диффе нет. Записать результаты и ограничения в `tmp/VERIFY.md`, отдельно отметив, что прод не проверялся.

## Workflow follow-up

- До релиза, с подтверждения владельца: в админке прода записать текущий список из `AUTH_ALLOWED_EMAILS` в `allowed_emails` группы `screenwriters` (`design.md`, «Migration Plan»).
- После релиза: проверить прод по шагу 3 плана миграции, затем, с подтверждения владельца, удалить `AUTH_ALLOWED_EMAILS` из `/etc/authorled/authorled.env`.
- Обновить статус `business-intents/auth-admin-ui.md`.
- Заархивировать change после `/opsx:verify`.
