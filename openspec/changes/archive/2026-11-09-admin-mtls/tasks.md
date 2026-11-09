# Tasks

## 1. Настройка `AUTH_ADMIN_DOMAIN`

- [x] 1.1 Передать `AUTH_ADMIN_DOMAIN` серверу и worker Authentik в `auth/compose.yaml` через `${AUTH_ADMIN_DOMAIN:?AUTH_ADMIN_DOMAIN must be set in .env}` рядом с `AUTH_BRAND_DOMAIN`; добавить `AUTH_ADMIN_DOMAIN=localhost:9000` с комментарием в `example.env` и в локальный `.env`; проверка: `docker compose config` без переменной падает с этим сообщением, с ней проходит.
- [x] 1.2 Описать `AUTH_ADMIN_DOMAIN` в таблице настроек README и в production-настройках README и `.agents/skills/deploy-platform/SKILL.md` (на проде `admin.soavtor.app`); проверка: `grep -n AUTH_ADMIN_DOMAIN README.md .agents/skills/deploy-platform/SKILL.md example.env auth/compose.yaml` находит все четыре файла.

## 2. Вход суперпользователя только через адрес админки (blueprints)

- [x] 2.1 В `auth/blueprints/30-authentication-flow.yaml` добавить шаг отказа `authorled-authentication-admin-only` (deny stage, сообщение «Администратор входит только через адрес админки.»), expression policy `authorled-superuser-outside-admin` (суперпользователь и хост запроса без учёта регистра не равен `AUTH_ADMIN_DOMAIN`, значение через `!Format`/`!Env`) и привязку order 15 в `authorled-authentication` с `evaluate_on_plan: false`, `re_evaluate_policies: true`, с комментарием, ссылающимся на спеку `auth` («Вход суперпользователя»); проверка: `./scripts/dev.sh` поднимает Authentik, `ak apply_blueprint` этого файла проходит без ошибок.
- [x] 2.2 Там же объявить бренд `!Env AUTH_ADMIN_DOMAIN` (`default: false`, `flow_authentication` — поток продукта, `present`); проверка: при `AUTH_ADMIN_DOMAIN=localhost:9000` применение проходит, `/api/v3/core/brands/current/` на `localhost:9000` по-прежнему даёт `authorled-authentication` и заголовок бренда из админки не изменился.
- [x] 2.3 Проверить на локальном стенде, какой хост видит политика (design, Decision 3 и 8): временно `AUTH_ADMIN_DOMAIN=admin.localhost:9000`, `akadmin` на `http://localhost:9000` получает отказ до пароля и без письма в Mailpit, на `http://admin.localhost:9000` входит в админку; запрос из другого контейнера той же сети к `authentik-server:9000` с `X-Forwarded-Host: admin.localhost:9000` получает отказ, когда Authentik доверяет только шлюзу (временно `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS=<шлюз локальной сети>/32` в общем `authentik-server`, с подтверждения владельца); запрос с хоста через порт `9000` приходит как от шлюза и проходит — записать это; пользователь `writer` входит через dev-сервер фронтенда как раньше и видит своё обычное прохождение, а `akadmin` через фронтенд видит текст отказа; вернуть `localhost:9000` и прежнее доверие прокси; результат записать в `tmp/VERIFY.md`.
- [x] 2.4 Запустить `./scripts/auth_check.sh` после возврата настройки; проверка: проходит.

## 3. Обратный прокси

- [x] 3.1 В `deploy/Caddyfile` добавить сайт `admin.soavtor.app` с `tls { client_auth { mode require_and_verify; trust_pool file /etc/authorled/admin-client-ca.pem } }` и `reverse_proxy 127.0.0.1:9000`, с комментарием о спеках `runtime` и `auth`; проверка: `caddy adapt` (Caddy той же версии, что на сервере, v2.11.9, через `docker run caddy:2.11.9`) с тестовым PEM по этому пути разбирает файл, без файла — падает с его именем.
- [x] 3.2 На `auth.soavtor.app` закрыть `/if/admin/*` ответом 404, а `/if/flow/<slug>/` и `/api/v3/flows/executor/<slug>/` пропускать только для `authorled-authentication`, `authorled-enrollment`, `authorled-invalidation`, `default-provider-authorization-implicit-consent`; на `app.soavtor.app` сузить `@authentik` для executor тем же списком (`/flows/-/cancel/*` и `/application/o/revoke/*` без изменений), прочее под executor — 404; проверка: `caddy adapt` проходит, в JSON видны matchers с этим списком.
- [x] 3.3 Проверить маршрутизацию локально: Caddy v2.11.9 в контейнере с этим Caddyfile, внутренними сертификатами (`tls internal` через временный override только для проверки, не в репозитории) и заглушкой вместо Authentik; `curl --resolve` подтверждает 404 на `/if/admin/` и на чужой поток, пропуск потоков продукта, отказ TLS на адресе админки без клиентского сертификата, вход с тестовым клиентским сертификатом и отказ при `Host: admin.soavtor.app` поверх SNI `auth.soavtor.app`; результат записать в `tmp/VERIFY.md`.

## 4. Сертификаты владельца

- [x] 4.1 Написать `scripts/admin_cert.sh` с командами `init [--replace-ca]` и `client` по design (Decision 6): каталог `~/.config/authorled/admin-ca/` с правами 700, удостоверяющий центр «Authorled admin CA» EC P-256 на 10 лет, клиентский сертификат EC P-256 на 2 года с `clientAuth`, `.p12` с паролем из `read -s`, совместимый со Связкой ключей, явный отказ без `openssl` или нужного провайдера, без перезаписи существующего удостоверяющего центра; каталог переопределяется только явным аргументом для проверки; проверка: в каталоге из scratchpad `init` выпускает файлы, повторный `init` отказывает, `client` выпускает новый сертификат, `openssl verify -CAfile ca.pem client.pem` проходит, `openssl pkcs12 -info` читает `.p12`.
- [x] 4.2 Описать в README («Admin interface»): адрес `https://admin.soavtor.app/if/admin/`, выпуск сертификата, импорт `.p12` в Связку ключей и выбор его в Safari и Chrome, файл `/etc/authorled/admin-client-ca.pem`, перевыпуск при истечении срока и при потере Mac, что `akadmin` не входит через публичные адреса и не должен иметь токенов и app passwords, что локально админка на `localhost:9000` без сертификата; проверка: раздел содержит все эти пункты, ссылки в README ведут на существующие файлы.

## 5. Деплой и проверка после него

- [x] 5.1 В `deploy/deploy.sh` (`check_inputs`) отказывать, если нет `/etc/authorled/admin-client-ca.pem`, с именем файла, до бэкапа и `compose up`; проверка: `bash -n deploy/deploy.sh` и `shellcheck`, если он есть в `validate.sh`; фрагмент `check_inputs` с отсутствующим файлом в scratchpad даёт `deploy: … admin-client-ca.pem …` и ненулевой код.
- [x] 5.2 Написать `deploy/check_admin.sh <admin host> <auth origin> <app origin>` с пятью проверками из design (Decision 7) и сообщениями `::error::` с адресом и кодом, по образцу `deploy/check_site.sh`; проверка: на текущем проде (до релиза) скрипт падает на проверках 1 и 3 с понятными сообщениями, ничего не меняя.
- [x] 5.3 Добавить шаг `deploy/check_admin.sh` в `.github/workflows/deploy.yml` после `check_site.sh`; проверка: `./scripts/validate.sh` проходит, шаг виден в workflow с теми же адресами, что в Caddyfile.
- [x] 5.4 Дописать в `.agents/skills/deploy-platform/SKILL.md` порядок первого включения из design (Migration Plan, шаги 1–6) и восстановление после потери ключей; проверка: шаги совпадают с design.
- [x] 5.5 В `deploy/deploy.sh` (`check_inputs`) читать шлюз сети `authorled_agentos` (`docker network inspect`) и `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS` из `.env`; если сети нет или значение не равно ровно `<шлюз>/32`, отказывать с обоими значениями до бэкапа и `compose up` (design, Decision 9); проверка: `bash -n`, фрагмент в scratchpad с несовпадающим значением и с отсутствующей сетью даёт `deploy: …` с обоими значениями и ненулевой код, с совпадающим — проходит.
- [x] 5.6 Заменить «`172.16.0.0/12`» на «шлюз сети `/32`» в README (таблица настроек и production-настройка), `example.env`, комментарии `compose.prod.yaml` и `.agents/skills/deploy-platform/SKILL.md` (шаг 2 первого включения: значение в `/etc/authorled/authorled.env`, сверить шлюз, с подтверждения владельца); проверка: `grep -rn 172.16.0.0/12 README.md example.env compose.prod.yaml .agents/skills/deploy-platform/SKILL.md` ничего не находит.

## 6. Контекст и итоговые проверки

- [x] 6.1 Обновить `openspec/context/05-security-and-compliance.md`: админка Authentik — только на `admin.soavtor.app` по клиентскому сертификату владельца, суперпользователь входит только там; проверка: строка о группе `admins` в разделе «Аутентификация и авторизация» обновлена.
- [x] 6.2 Прогнать `./scripts/validate.sh`, `git diff --check` и `openspec validate admin-mtls --strict`; записать статические, контейнерные и (после релиза) hosted результаты раздельно в `tmp/VERIFY.md`; проверка: все команды проходят.

## Workflow follow-up

- Verify, archive, merge `origin/main`, PR и merge по AGENTS.md («OpenSpec is mandatory», шаг 4).
- Перед релизом с подтверждения владельца: `scripts/admin_cert.sh init` на Mac, файл удостоверяющего центра, `AUTH_ADMIN_DOMAIN` и `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS=<шлюз>/32` на сервере, A-запись `admin.soavtor.app`, проверка токенов `akadmin`.
- После релиза: ручная проверка входа с Mac в Safari и Chrome, отказ `akadmin` на `app.soavtor.app`, завершение старых сессий `akadmin`; проверка после релиза — отдельным маленьким PR от свежего `origin/main`.
