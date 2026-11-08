# Tasks

## 1. Ссылка на сайт во фронтенде

- [x] 1.1 `web/vite.config.ts`: передать `SITE_ORIGIN` в сборку через `define` (значение или `null`, как `__AUTH_CONFIG__`), объявить константу в `web/src/app/env.d.ts`. Проверка: `npm run build --prefix web` без `.env` проходит.
- [x] 1.2 `web/src/app/config.ts`: `SITE_ORIGIN` обязателен, абсолютный `http(s)`, без значения по умолчанию; `AppConfig.siteOrigin`. Проверка: dev-сервер без `SITE_ORIGIN` в окружении показывает экран ошибки с именем `SITE_ORIGIN`; с `SITE_ORIGIN=ftp://x` — тоже.
- [x] 1.3 `web/src/auth/LoginScreen.tsx`: ссылка «О продукте» на `siteOrigin` в подвале карточки на всех шагах, только семантические токены. Проверка: в браузере на `/login` ссылка видна на шаге почты и шаге кода, ведёт на `http://localhost:5174`, доступна с Tab; `./web/scripts/check_web_tokens.sh` проходит.
- [x] 1.4 `example.env`: в комментарии к `SITE_ORIGIN` сказать, что его читает и фронтенд сервиса (ссылка с экрана входа). Проверка: `git diff example.env` — только комментарий.

## 2. Сборка и выкладка в деплое

- [x] 2.1 `.github/workflows/deploy.yml`: `SITE_ORIGIN` и `SITE_APP_URL` в шаге «Check the settings»; кэш `setup-node` по `web/package-lock.json` и `site/package-lock.json`; `SITE_ORIGIN` в окружение сборки `web/`; шаг «Build the site» (`npm ci --prefix site`, `npm run build --prefix site`); шаг «Send the site» (`rsync site/dist/` в `/srv/authorled/site/incoming/$TAG/`). Проверка: `actionlint` или `python -c 'import yaml;yaml.safe_load(open(".github/workflows/deploy.yml"))'` и чтение диффа: сборка сайта идёт до SSH, без переменных запуск падает с их именем.
- [x] 2.2 `deploy/deploy.sh`: `check_inputs` проверяет `site/incoming/<tag>/index.html`; `switch_frontend` → `switch_release <каталог> <tag>` для `web` и `site`, сайт переключается до `caddy validate`. Проверка: `bash -n deploy/deploy.sh`, `shellcheck deploy/deploy.sh`; прогон `check_inputs` и `switch_release` во временном каталоге (подставленный `ROOT`) показывает отказ без файлов сайта и верную ссылку `site/current`.
- [x] 2.3 `deploy/Caddyfile`: блок `soavtor.app` по design (решение 5) вместо `302`; комментарий о временной переадресации убрать. Проверка: `docker run --rm -v "$PWD/deploy:/etc/caddy:ro" caddy:2.11 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` проходит.
- [x] 2.4 Проверка Caddy локально: тот же образ с `deploy/Caddyfile`, где домены заменены на `http://:8080` для сайта, `root` указывает на `site/dist`, а API — на локальный `127.0.0.1:8000`. Проверка: `/` → `200` с `Content-Encoding: gzip` при `Accept-Encoding: gzip`, `/privacy` → переадресация на `/privacy/` → `200`, `/no-such-page` → `404` со страницей 404, `/os/health` → `404` сайта, `POST /os/api/v1/beta-requests` с пустым телом → `422` без `Content-Encoding`. Временный файл не коммитится; вывод в `tmp/VERIFY.md` (container).
- [x] 2.5 `deploy.yml`, шаг «Check the site» после «Check the public addresses» (скрипт `deploy/check_site.sh`): проверить `$SITE_ORIGIN/` и `/privacy/` → `200`, `/no-such-page` → `404`, пустой `POST /os/api/v1/beta-requests` → `422`; ошибка печатает адрес и код. Проверка: прогон тела шага локально против Caddy из 2.4 (адрес подставлен) — зелёный; с остановленным API — красный с адресом.

## 3. Документы

- [x] 3.1 `README.md` («Deploy by release»): сайт собирается и выкладывается в релизе, каталог `/srv/authorled/site`, переменные `SITE_ORIGIN`, `SITE_APP_URL`, откат на теги до `v0.3.5` через «Use workflow from» (design, решение 9). Проверка: `git diff README.md` по этим пунктам.
- [x] 3.2 `.agents/skills/deploy-platform/SKILL.md`: те же переменные и каталог сайта в разовой подготовке и проверке после деплоя. Проверка: чтение диффа.
- [x] 3.3 `AGENTS.md`: в абзаце про `site/` заменить «Not deployed until the product has its own domain» на выкладку релизом на `soavtor.app` (только маршрут заявки идёт в API). Проверка: `grep -n "Not deployed" AGENTS.md` пуст.
- [x] 3.4 `./scripts/validate.sh` (с `env -u BASH_ENV` после `source agno/.venv/bin/activate`) и `git diff --check` проходят. Проверка: вывод в `tmp/VERIFY.md` (static).

## 4. Разовая подготовка и выпуск (с подтверждения владельца)

- [x] 4.1 Создать `/srv/authorled/site/incoming` под пользователем `deploy` (`ssh authorled-deploy install -d -m 755 /srv/authorled/site/incoming`). Проверка: `stat -c "%U %a" /srv/authorled/site/incoming` — `deploy 755`.
- [x] 4.2 Задать в GitHub Environment `production` переменные `SITE_ORIGIN=https://soavtor.app` и `SITE_APP_URL=https://app.soavtor.app`. Проверка: `gh api repos/lehard/Authorled/environments/production/variables` показывает обе.
- [x] 4.3 После влития в `main` опубликовать релиз. Проверка: зелёный запуск `deploy.yml`, включая проверку адресов сайта.

## 5. Проверка на сервере

- [x] 5.1 `https://soavtor.app/` и `/privacy/` открываются, `canonical` — `https://soavtor.app/...`, «Войти» ведёт на `https://app.soavtor.app`; `https://www.soavtor.app/x` → `301` на `https://soavtor.app/x`; `https://soavtor.app/os/agents` не доходит до API; ответ главной сжат. Проверка: `curl -sI` и выдержки HTML в `tmp/VERIFY.md` (hosted).
- [x] 5.2 Заявка владельца с формы на `soavtor.app` сохраняется и видна в `./scripts/usage.sh prod beta-requests`. Проверка: строка списка (без чужих данных) в `tmp/VERIFY.md` (hosted).
- [x] 5.3 Выход из редактора на `app.soavtor.app` открывает экран входа со ссылкой «О продукте», она открывает `https://soavtor.app/`. Проверка: запись в `tmp/VERIFY.md` (hosted).

## Workflow follow-up

- `/opsx:verify site-deploy`, затем `/opsx:archive`.
- Обновить статус в `business-intents/site-deploy.md` и заметку о сервере (`~/.claude/CLAUDE.md`, память о хостинге): `soavtor.app` — сайт, каталог `/srv/authorled/site`.
