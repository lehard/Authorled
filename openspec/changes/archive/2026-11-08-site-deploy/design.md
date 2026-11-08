# Design: выкладка сайта «Соавтора» на soavtor.app

## Context

Мотивация — `proposal.md`, «Why». Что есть сейчас:

- `deploy.yml` на релиз: `resolve` → `validate` (вызывает `validate.yml`, который уже собирает `site/` с нейтральными адресами) → `deploy`: проверка переменных, `npm ci` и сборка `web/`, `deploy/check_web_build.sh`, `rsync` в `/srv/authorled/web/incoming/<tag>/`, `deploy/deploy.sh` по SSH, проверка `/os/health` и `/os/agents`.
- `deploy.sh` (выполняется версией из тега): `check_inputs` → копия базы → `git checkout` тега → `up -d --build` → blueprints → `switch_frontend` (`incoming/<tag>` → `<tag>`, ссылка `current`, удаление прочих `v*`) → `caddy validate` и `systemctl reload caddy`.
- `deploy/Caddyfile`: `soavtor.app { redir https://app.soavtor.app{uri} 302 }`, `www.soavtor.app` → `301` на `soavtor.app`. На сервере Caddy 2.11.9, `/srv/authorled` принадлежит `deploy`.
- Сборка сайта (`npm run build --prefix site`): `vite build`, SSR-сборка, `prerender.mjs`, `check-build.mjs`; итог в `site/dist` (`index.html`, `privacy/index.html`, `404.html`, `sitemap.xml`, `robots.txt`, ресурсы). Настройки `SITE_ORIGIN`, `SITE_APP_URL` читаются `loadEnv` из `.env` корня или из окружения процесса; без них сборка падает. Нужен `web/node_modules`.
- Форма сайта шлёт `POST /os/api/v1/beta-requests` на свой адрес (`site/src/site.ts`). Маршрут ядра открыт без токена (`PUBLIC_ROUTES`), пустое тело получает `422` («Тело запроса — не JSON»), частота ограничена по данным ядра.
- Фронтенд: настройки входа приходят в сборку через `define` (`__AUTH_CONFIG__`, значение или `null`) и проверяются при старте в `web/src/app/config.ts` (`ConfigError` с именем настройки). Поэтому CI собирает `web/` без `.env`.
- Релизы `v0.3.5` и `v0.3.6` уже содержат `site/`, более ранние — нет.

## Goals / Non-Goals

**Goals:**
- Сайт выкладывается тем же релизом и тем же путём, что фронтенд: сборка в Actions, `incoming/<tag>`, переключение ссылки `current`.
- Домен продукта открывает API только для маршрута заявки.
- Отсутствие переменной, файлов сайта или неверный ответ после выкладки останавливают деплой с именем проблемы.

**Non-Goals:**
- Отдельный workflow или ручная выкладка сайта без релиза.
- Общий механизм выкладки «N статических модулей»: модулей два, абстракция не нужна.
- Изменения сборки `site/` и маршрута заявки.

## Decisions

1. **Сайт собирается в job `deploy`, рядом с фронтендом.** После `npm ci --prefix web` и сборки `web/` идут `npm ci --prefix site` и `npm run build --prefix site` с `SITE_ORIGIN`, `SITE_APP_URL` из `vars` окружения `production`; `check-build.mjs` внутри `build` проверяет результат. Кэш `setup-node` получает оба lock-файла. Альтернатива — отдельный job с артефактом: лишняя передача файлов между job ради минуты сборки.
2. **Переменные проверяются в шаге «Check the settings».** `SITE_ORIGIN` и `SITE_APP_URL` добавляются в общий список; запуск падает до сборки и SSH. Значения: `https://soavtor.app` и `https://app.soavtor.app` — ставит владелец в GitHub, в репозиторий не коммитятся (как прочие `vars`).
3. **Файлы на сервере — `/srv/authorled/site/{incoming/<tag>,<tag>,current}`.** `rsync site/dist/` в `site/incoming/<tag>/`, как фронтенд. Каталог `site/incoming` создаётся один раз руками под `deploy` (как было с `web/incoming`); `deploy.sh` его не создаёт и падает, если файлов нет. Альтернатива `rsync --mkpath` скрыла бы неготовый сервер.
4. **`deploy.sh`: одна функция переключения для двух каталогов.** `switch_frontend` превращается в `switch_release <каталог> <tag>` и вызывается для `web` и `site`; `check_inputs` проверяет `web/incoming/<tag>/index.html` и `site/incoming/<tag>/index.html` до копии базы. Переключение сайта идёт после фронтенда и до `caddy validate`/`reload`, поэтому новый `Caddyfile` всегда видит `site/current`.
5. **Caddy для `soavtor.app`:**
   ```
   soavtor.app {
   	handle /os/api/v1/beta-requests {
   		uri strip_prefix /os
   		reverse_proxy 127.0.0.1:8000
   	}
   	handle {
   		encode gzip
   		root * /srv/authorled/site/current
   		file_server
   	}
   	handle_errors 404 {
   		root * /srv/authorled/site/current
   		rewrite * /404.html
   		file_server
   	}
   }
   ```
   Точный путь (не `/os/*`) — другие пути `/os/` попадают в статический `handle` и получают 404 сайта. `encode` только для статики: ответ API идёт без сжатия, как требует «Ответы API через обратный прокси». `file_server` сам переадресует `/privacy` на `/privacy/` и отдаёт `index.html` каталога; `try_files` на `index.html` не нужен — у сайта нет клиентской маршрутизации. Блок `www.soavtor.app` не меняется. Альтернатива — проксировать весь `/os/` на домене продукта: открывает токенные маршруты и MCP на втором домене без нужды.
6. **Проверка после деплоя — отдельный шаг «Check the site» после проверки API, скрипт `deploy/check_site.sh <SITE_ORIGIN>`** (его же можно запустить локально против Caddy). Четыре `curl`: `https://soavtor.app/` → `200`, `/privacy/` → `200`, `/no-such-page` → `404`, `POST /os/api/v1/beta-requests` с пустым телом → `422`. Ошибка печатает адрес и код. Адрес сайта берётся из `vars.SITE_ORIGIN`, не выводится из `PUBLIC_URL`. Пустое тело не создаёт заявку и не расходует лимит частоты (лимит считает сохранённые заявки).
7. **Адрес сайта во фронтенде — `SITE_ORIGIN`, проверка при старте.** `web/vite.config.ts` передаёт `SITE_ORIGIN` в сборку через `define` (значение или `null`, как `__AUTH_CONFIG__`), `config.ts` требует его и проверяет абсолютный `http(s)` адрес, `AppConfig` получает `siteOrigin`. Так CI-сборка без `.env` проходит, а приложение без настройки показывает экран ошибки с её именем — тот же контракт, что у настроек входа. Отдельное имя (`APP_SITE_URL`) не вводится: в `.env` уже есть `SITE_ORIGIN` с тем же смыслом, локально ссылка ведёт на `http://localhost:5174`. В job `deploy` сборка `web/` получает `SITE_ORIGIN` из `vars`.
8. **Ссылка на экране входа.** «О продукте» — обычная ссылка `<a href={siteOrigin}>` в подвале карточки входа рядом со строкой «Ваши тексты не используются для обучения моделей.», на всех шагах; стили — семантические токены (`text-primary`, подчёркивание при наведении), как ссылки на сайте. Отдельного компонента не нужно.
9. **Откат.** Ручной запуск `deploy.yml` из `main` с тегом `v0.3.5`/`v0.3.6` собирает их `site/` и работает; их `deploy.sh` не знает про сайт и не переключает его, а их `Caddyfile` возвращает `302`. Для тегов до `v0.3.5` (нет `site/`) владелец выбирает в «Use workflow from» сам этот тег — запускается его прежний `deploy.yml`. Это записывается в README.

## Risks / Trade-offs

- [Ошибка в `Caddyfile` видна только на сервере (`caddy validate` в `deploy.sh`), после `up`] → перед релизом проверить файл `docker run --rm -v "$PWD/deploy:/etc/caddy:ro" caddy:2.11 caddy validate --config /etc/caddy/Caddyfile` (задача проверки); при ошибке на сервере Caddy продолжает со старой конфигурацией, запуск красный.
- [Первый релиз упадёт, если не создан `site/incoming` или нет переменных] → разовые шаги в задачах идут до релиза и проверяются; падение происходит до копии базы и смены кода.
- [Открытая форма на домене + сервер в Финляндии] → принятый риск владельца 2026-11-08 в `05-security-and-compliance.md`; лимит частоты и размера тела уже в ядре.
- [Сайт медленно грузится из России] → вне этого change (`web-first-load`); `encode gzip` и бюджет скриптов главной смягчают.
- [`handle_errors 404` перехватит и `404` от API на маршруте заявки] → маршрут отвечает `202/413/422/429`, `404` от него не ожидается; если появится — посетитель увидит страницу 404 вместо JSON, это допустимо.

## Migration Plan

1. До релиза (с подтверждения владельца): `ssh authorled-deploy install -d -m 755 /srv/authorled/site/incoming`; в GitHub Environment `production` — `SITE_ORIGIN=https://soavtor.app`, `SITE_APP_URL=https://app.soavtor.app`.
2. Слить change в `main`, опубликовать релиз. Деплой собирает и выкладывает сайт, переключает Caddy, проверяет адреса.
3. Проверить вручную: главная, политика, заявка с формы видна в `./scripts/usage.sh prod beta-requests`, `www` → `301`, ссылка «О продукте» на экране входа. Записать в `tmp/VERIFY.md` (hosted).
4. Откат — ручной запуск с прошлым тегом (решение 9); `soavtor.app` снова переадресует на сервис.
