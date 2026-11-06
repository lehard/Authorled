# Tasks

## 1. Настройка доверенного прокси

- [x] 1.1 Передать `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS` как обязательную в `authentik-server` и `authentik-worker` в `compose.prod.yaml`; проверить, что `docker compose -f compose.yaml -f compose.prod.yaml config` без неё падает с её именем, а локальный `compose.yaml` работает как раньше.
- [x] 1.2 Описать настройку в `example.env` и таблице настроек README; проверить, что `git diff --check` проходит.

## 2. Обратный прокси

- [x] 2.1 Добавить `deploy/Caddyfile` по `design.md`: домены продукта и Authentik, `/os/`, три пути Authentik, фронтенд с `try_files`; проверить `caddy validate --adapter caddyfile` в контейнере Caddy.

## 3. Скрипт деплоя

- [x] 3.1 Написать `deploy/deploy.sh <tag>` с шагами из `design.md` и явной ошибкой на отсутствующий тег, каталог или `.env`; проверить `bash -n` и `shellcheck`.
- [x] 3.2 Реализовать копию базы с проверкой `pg_restore --list`, хранением 10 копий и пропуском только без тома; проверить на локальной базе через временный проект compose, что копия создаётся и что сбой `pg_dump` останавливает скрипт до `git checkout`.
- [x] 3.3 Описать в README восстановление базы из копии и проверить команду на временном проекте compose.

## 4. Workflow GitHub

- [x] 4.1 Добавить в `validate.yml` `workflow_call` с входом `ref`, не меняя триггеры `push` и `pull_request`; проверить `actionlint`.
- [x] 4.2 Добавить `.github/workflows/deploy.yml`: триггеры, `concurrency`, `resolve` с проверкой тега, вызов `validate`, задачу `deploy` с проверкой настроек; проверить `actionlint`.
- [x] 4.3 Добавить в задачу `deploy` сборку фронтенда и проверку файлов сборки на тексты быстрых кнопок; проверить локально, что `npm run build --prefix web` с настройками продакшена проходит эту проверку.
- [x] 4.4 Добавить отправку фронтенда, запуск `deploy/deploy.sh` и проверку публичных `/os/health` и `/os/agents`; проверить `actionlint` и что секреты не выводятся в шагах.

## 5. Документация

- [x] 5.1 Описать в README разовую подготовку сервера (пользователь `deploy`, каталоги, симлинк `.env`, импорт Caddyfile, sudo на reload) и GitHub Environment `production`; проверить, что перечисленные секреты и переменные совпадают с `deploy.yml`.
- [x] 5.2 Описать в README и скилле `deploy-platform` выпуск релиза и откат; проверить, что `./scripts/validate.sh` и `git diff --check` проходят.

## 6. Подготовка и проверка на сервере

Эти шаги меняют сервер и GitHub, поэтому каждый выполняется после подтверждения владельца.

- [ ] 6.1 Подготовить сервер по README; проверить вход `deploy` по ключу и что sudo разрешён только на `systemctl reload caddy`.
- [ ] 6.2 Настроить GitHub Environment `production`; проверить, что запуск с пустым секретом падает с его именем и не подключается к серверу.
- [ ] 6.3 Опубликовать первый релиз, когда готовы `main`, SMTP и DNS; проверить зелёный запуск, HTTPS на обоих доменах, `/os/health`, `401` на `/os/agents` и вход на сайт.
- [ ] 6.4 Проверить, что после первого релиза нет историй и пользователей разработки: новый пользователь видит пустой список, `writer@authorled.test` и `editor@authorled.test` в Authentik нет.
- [ ] 6.5 Проверить, что пуш в `main` без релиза не меняет сервер, а тег не из `main` останавливается ошибкой.
- [ ] 6.6 Записать проверки и ограничения в `tmp/VERIFY.md`, отдельно результаты static, container и hosted, включая вход MCP с `AGENTOS_URL` на `/os`.

## Workflow follow-up

- Обновить статус `business-intents/deploy-on-release.md` после реализации.
- Заархивировать change после `/opsx:verify`.
