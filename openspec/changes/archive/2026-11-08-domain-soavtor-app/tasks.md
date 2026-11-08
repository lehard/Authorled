# Tasks

## 1. Обратный прокси

- [x] 1.1 В `deploy/Caddyfile` переименовать блок `coauthor.glavai.ru` в `app.soavtor.app`, в `header_up Host` поставить `auth.soavtor.app`, блок `auth.coauthor.glavai.ru` заменить на `auth.soavtor.app` (design, решение 1). Проверка: `caddy validate --adapter caddyfile --config deploy/Caddyfile` (локально через `docker run --rm -v "$PWD/deploy:/d:ro" caddy:2 caddy validate --adapter caddyfile --config /d/Caddyfile`).
- [x] 1.2 Добавить переадресации: `coauthor.glavai.ru` → `https://app.soavtor.app{uri}` (301), `www.soavtor.app` → `https://soavtor.app{uri}` (301), `soavtor.app` → `https://app.soavtor.app{uri}` (302), с комментарием, что корень займёт сайт из `product-site` (design, решение 2). Проверка: `caddy validate` из 1.1 и `caddy adapt` — в JSON у трёх хостов `static_response` с нужными `Location` и кодами.

## 2. Blueprints при деплое

- [x] 2.1 Локально проверить, какой код выхода у `ak apply_blueprint` при неверном blueprint (временный файл в `/blueprints-dev` со ссылкой на несуществующий `!Env` или `!Find`, удалить после проверки). Проверка: записать код выхода в `tmp/VERIFY.md`; если он 0 — остановиться и попросить владельца запустить `/opsx:update` (design, риск про код выхода).
- [x] 2.2 В `deploy/deploy.sh` после `up -d --build` добавить шаг: `up -d --wait authentik-server authentik-worker`, затем `exec -T authentik-worker ak apply_blueprint` для каждого `/blueprints/custom/*.yaml` по порядку имён; сбой — `fail` с именем файла, без продолжения (design, решение 3). Список файлов берётся из `auth/blueprints/` релиза, а не из жёсткого перечня. Проверка: `bash -n deploy/deploy.sh`, локально те же команды compose на стенде разработки применяют все четыре файла с кодом 0.
- [x] 2.3 Локально проверить, что смена env без правки файлов доходит до Authentik: на стенде разработки поменять `AUTH_FRONTEND_LOGOUT_URI` в `.env`, пересоздать Authentik, выполнить шаг из 2.2 и убедиться через API Authentik, что у провайдера `authorled-web` новый адрес выхода; вернуть значение и повторить. Проверка: результат в `tmp/VERIFY.md`.

## 3. Проверки репозитория

- [x] 3.1 `./scripts/validate.sh` и `git diff --check` проходят; `openspec validate domain-soavtor-app --strict` проходит. Записать в `tmp/VERIFY.md`.

## 4. Выпуск (каждый шаг на сервере и в GitHub — после подтверждения владельца в чате)

- [x] 4.1 Проверить публичный DNS (`https://dns.google/resolve`) для `soavtor.app`, `www.soavtor.app`, `app.soavtor.app`, `auth.soavtor.app` — A `66.151.34.151` — и что домен `soavtor.app` в Resend проверен. Проверка: ответы в `tmp/VERIFY.md`.
- [x] 4.2 Записать в `tmp/VERIFY.md` нынешние значения 7 строк env сервера и 4 переменных GitHub (они не секретные) для отката.
- [x] 4.3 Заменить переменные окружения `production` в GitHub: `PUBLIC_URL=https://app.soavtor.app`, `AUTH_ISSUER=https://auth.soavtor.app/application/o/authorled/`, `AUTH_FRONTEND_REDIRECT_URI=https://app.soavtor.app/auth/callback`, `AUTH_FRONTEND_LOGOUT_URI=https://app.soavtor.app/login`. Проверка: `gh api repos/lehard/Authorled/environments/production/variables`.
- [x] 4.4 Заменить в `/etc/authorled/authorled.env`: `AGENTOS_URL=https://app.soavtor.app/os`, `AUTH_BRAND_DOMAIN=auth.soavtor.app`, `AUTH_ISSUER`, `AUTH_FRONTEND_REDIRECT_URI`, `AUTH_FRONTEND_LOGOUT_URI` (как в 4.3), `AUTHENTIK_COOKIE_DOMAIN=.soavtor.app`, `AUTHENTIK_EMAIL__FROM="CoAuthor <noreply@soavtor.app>"`; перед правкой — копия файла рядом. Проверка: `grep` этих 7 строк без вывода других.
- [x] 4.5 После влития в `main` опубликовать релиз; деплой проходит, включая применение blueprints и проверку `https://app.soavtor.app/os/health`. Проверка: зелёный запуск `deploy.yml`.

## 5. Проверка на сервере

- [x] 5.1 Вход на `https://app.soavtor.app/login`: код приходит с `noreply@soavtor.app`, в заголовках письма DKIM и SPF `pass`; после входа открывается полка; соавтор отвечает в чате. Проверка: запись в `tmp/VERIFY.md` (hosted).
- [x] 5.2 Токены выдаёт `https://auth.soavtor.app/application/o/authorled/`; `/api/v3/core/brands/current/` на `auth.soavtor.app` содержит поток `authorled-authentication`; у провайдера `authorled-web` только новые адреса возврата и выхода. Проверка: ответы в `tmp/VERIFY.md`.
- [x] 5.3 Переадресации из спеки `runtime` (старая ссылка, `www`, корень) отвечают кодами и `Location` как в сценариях; `auth.coauthor.glavai.ru` не доходит до Authentik; у всех новых адресов действующие сертификаты. Проверка: `curl -sI` по каждому адресу, вывод в `tmp/VERIFY.md`.
- [ ] 5.4 `./scripts/mcp_check.sh` против `https://app.soavtor.app` проходит. Проверка: вывод в `tmp/VERIFY.md`.
  - 2026-11-08: не пройдёт без отдельной работы. Подключение MCP по OAuth сломано и до переезда: три адреса `/.well-known/...` и форма согласия уходят мимо `/os/`. Без токена `/os/mcp` отвечает 401, метаданные `/os/.well-known/oauth-authorization-server` с новым адресом на месте. Задача перенесена в бэклог («Подключение чат-приложений к MCP по OAuth»).
- [x] 5.5 С подтверждения владельца удалить старый бренд `auth.coauthor.glavai.ru` в Authentik и домен `coauthor.glavai.ru` в Resend (Resend — делает владелец в кабинете). Проверка: бренда нет в `/api/v3/core/brands/`; повторный вход проходит.
  - 2026-11-08: бренд удалён по подтверждению владельца. Домен `coauthor.glavai.ru` в Resend нужен, пока работает старая переадресация: удаляется вместе с ней после 2027-05-08 (бэклог «Убрать старый адрес coauthor.glavai.ru»).

## Workflow follow-up

- `/opsx:verify domain-soavtor-app`, затем `/opsx:archive`.
- Обновить заметки о сервере (`~/.claude/CLAUDE.md`, память проекта о хостинге): новые домены.
- Переадресацию `coauthor.glavai.ru` и записи `coauthor` в зоне `glavai.ru` убрать не раньше чем через полгода — запись в `openspec/context/backlog-stage-2.md`.
