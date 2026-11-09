# Design

## Context

Зачем это нужно: proposal.md, «Why». Что известно о текущем устройстве:

- `deploy/Caddyfile` описывает сайты `app.soavtor.app`, `auth.soavtor.app`, `soavtor.app` и переадресации. `/etc/caddy/Caddyfile` на сервере состоит из одной строки `import` этого файла, поэтому глобальных опций Caddy в репозитории нет. На сервере Caddy v2.11.9.
- `app.soavtor.app` ведёт на Authentik только `/api/v3/flows/executor/*`, `/flows/-/cancel/*`, `/application/o/revoke/*` и подменяет `Host` на `auth.soavtor.app`. Сейчас executor открыт для любого slug, значит, через домен сервиса доступны и потоки Authentik по умолчанию (`default-authentication-flow`). Они правил продукта не содержат.
- `auth.soavtor.app` ведёт на Authentik всё подряд. Authentik в prod доверяет прокси из `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS`, сейчас это `172.16.0.0/12`. Caddy приходит в Authentik через docker-proxy порта `127.0.0.1:9000`, то есть с адреса шлюза сети `authorled_agentos` (на проде `172.18.0.1`). Адреса сети в compose не закреплены.
- Поток `authorled-authentication` (`auth/blueprints/30-authentication-flow.yaml`) идёт так: identification (10) → password по политике (20) → код на почту (30) → login (100). Бренд `AUTH_BRAND_DOMAIN` привязывает к домену поток входа. Authentik выбирает бренд по хосту запроса и сравнивает его с концом хоста (`iendswith`). Для хоста без бренда действует бренд по умолчанию с потоками по умолчанию.
- Поток согласия OIDC-провайдера `default-provider-authorization-implicit-consent` — это поток авторизации: он работает только для пользователя, который уже вошёл, и сам никого не входит.
- Веб-фронтенд уже показывает отказ потока (`ak-stage-access-denied` → `SignInError("page", error_message)` в `web/src/auth/flow/flowClient.ts`).
- `deploy/deploy.sh` проверяет входные данные в `check_inputs`, затем выполняет `compose up`, применяет blueprints и в самом конце запускает `caddy validate` и `reload`. Workflow после деплоя запускает `deploy/check_site.sh`.
- Cookie сессии Authentik общая для родительского домена (`AUTHENTIK_COOKIE_DOMAIN`).

## Goals / Non-Goals

**Goals:**
- Административная часть Authentik и вход суперпользователя доступны только с клиентским сертификатом владельца. Обойти это нельзя ни другим потоком, ни другим хостом, ни подменой заголовков.
- Каждая ошибка конфигурации (нет файла удостоверяющего центра, нет `AUTH_ADMIN_DOMAIN`, нет DNS или сертификата сайта) ломает релиз или его проверку, а не открывает админку.

**Non-Goals:**
- Закрывать сертификатом API Authentik (`/api/v3/…`) на публичном домене целиком. Профиль и согласие пользуются этим API с сессией. Без сессии суперпользователя он безопасен, а сессию снаружи получить нельзя (см. Decisions 3–4).
- Менять `GROUP_SCOPES`, контракт токена и права группы `admins` в API AgentOS.

## Decisions

### 1. Отдельный хост `admin.soavtor.app`, а не сертификат на пути

Caddy запрашивает клиентский сертификат на уровне TLS, до HTTP-пути. Если повесить `client_auth` на `auth.soavtor.app` даже в режиме «проверить, если прислан», браузер может показать авторам окно выбора сертификата. Отдельный хост с `client_auth { mode require_and_verify; trust_pool file /etc/authorled/admin-client-ca.pem }` не затрагивает других пользователей вовсе.

Альтернатива, SSH-туннель к `127.0.0.1:9000`, не подходит. Authentik выбирает бренд и cookie по хосту, через туннель вход ломается. К тому же владелец просил именно mTLS.

### 2. Подмену хоста закрывает Caddy

Сертификат проверяется только для SNI `admin.soavtor.app`. Злоумышленник может открыть TLS как `auth.soavtor.app`, без сертификата, и отправить `Host: admin.soavtor.app`. Против этого Caddy включает `strict_sni_host` на сервере, где есть политика с `client_auth`: он отклоняет запросы, у которых `Host` не совпадает с SNI. Глобальные опции в импортируемом файле задать нельзя, поэтому мы опираемся на это поведение Caddy и проверяем его после каждого деплоя (Decision 7). Блок `reverse_proxy` Caddy без `trusted_proxies` перезаписывает `X-Forwarded-Host` и `X-Forwarded-For` своими значениями. Значит, хост, который видит Authentik, всегда соответствует проверенному SNI.

Рассматривали метку-заголовок, которую ставит сайт админки и срезают остальные сайты. Отказались: её нужно срезать на каждом сайте, нынешнем и будущем, и любой забытый сайт открывает обход.

### 3. Правило входа суперпользователя — шаг отказа в потоке продукта

В `authorled-authentication` между identification (10) и password (20) появляется привязка order 15. Её шаг — `authentik_stages_deny.denystage` `authorled-authentication-admin-only` с сообщением «Администратор входит только через адрес админки.». Политика привязки — expression policy `authorled-superuser-outside-admin` с `evaluate_on_plan: false` и `re_evaluate_policies: true`, как у шага пароля, потому что `pending_user` появляется только после identification. Политика возвращает `True`, то есть «отказать», когда `pending_user.is_superuser` и хост запроса без учёта регистра не равен `AUTH_ADMIN_DOMAIN`. Значение подставляется в выражение при применении blueprint (`!Format` с `!Env AUTH_ADMIN_DOMAIN`).

Хост берётся из запроса потока (`request.http_request.get_host()`), а не из найденного бренда. Бренд ищется по концу имени, поэтому сравнение с ним было бы нестрогим. Сервер Authentik сам подставляет хост из `X-Forwarded-Host`, если запрос пришёл с доверенного адреса, ещё до политики (проверено на локальном стенде; чтение сырого `Host` из `META` даёт то же). Значит, внутри доверенного адреса подделка заголовка остаётся возможной, и закрывает её только Caddy, который перезаписывает `X-Forwarded-Host` (Decision 2). Поэтому доверенный адрес сужен до одного Caddy (Decision 9).

Отказ стоит до пароля и кода, поэтому по нему нельзя перебрать пароль `akadmin` и нельзя слать коды на его почту с публичного адреса. То, что отказ показывает, что почта принадлежит администратору, приемлемо: шаг почты уже сообщает, есть ли такой аккаунт (`pretend_user_exists: false`).

### 4. Бренд адреса админки и закрытые чужие потоки

Blueprint объявляет бренд `!Env AUTH_ADMIN_DOMAIN` с `default: false` и `flow_authentication: authorled-authentication` (поле репозитория, `present`). Тогда `/if/admin/` без сессии на адресе админки ведёт в поток продукта, а не в поток по умолчанию. На локальном стенде `AUTH_ADMIN_DOMAIN` равен `AUTH_BRAND_DOMAIN`, и запись указывает на тот же бренд с тем же потоком, конфликта нет.

Потоки по умолчанию в Authentik остаются (их создают встроенные blueprints Authentik). На публичных хостах их закрывает Caddy, белым списком slug: `authorled-authentication`, `authorled-enrollment`, `authorled-invalidation`, `default-provider-authorization-implicit-consent`. Белый список действует для `/if/flow/<slug>/` и `/api/v3/flows/executor/<slug>/` на `auth.soavtor.app` и для executor на `app.soavtor.app`, остальные slug получают `404`. Белый список выбран вместо чёрного, потому что новые потоки Authentik по умолчанию появятся с обновлениями, а белый список их не пропустит.

Рассматривали удаление потоков по умолчанию через `state: absent`. Отказались: встроенные blueprints Authentik создают их заново, и на них ссылаются объекты по умолчанию.

### 5. `AUTH_ADMIN_DOMAIN` — обязательная настройка без значения по умолчанию

Переменная передаётся в сервер и worker Authentik в `auth/compose.yaml` так же, как `AUTH_BRAND_DOMAIN`, через `${AUTH_ADMIN_DOMAIN:?…}`. В `example.env` стоит `AUTH_ADMIN_DOMAIN=localhost:9000`, на проде — `admin.soavtor.app`. Хост в `deploy/Caddyfile` прописан явно, как остальные домены. Если env и Caddyfile разойдутся, это поймает проверка после деплоя: поток на `admin.soavtor.app` откажет администратору.

### 6. Выпуск сертификатов — `scripts/admin_cert.sh` на компьютере владельца

Bash и `openssl`, каталог `~/.config/authorled/admin-ca/` с правами 700, команды:

- `init` создаёт удостоверяющий центр «Authorled admin CA» (EC P-256, 10 лет, `basicConstraints CA:TRUE, pathlen:0`, `keyUsage keyCertSign`) и сразу выпускает клиентский сертификат. Если удостоверяющий центр уже есть, отказывается, пока не передан `--replace-ca`.
- `client` выпускает новый клиентский сертификат существующим удостоверяющим центром: EC P-256, 2 года, `extendedKeyUsage clientAuth`.

Пароль `.p12` скрипт спрашивает у владельца (`read -s`) и нигде не сохраняет. Шифрование `.p12` совместимо со Связкой ключей macOS: явные `-keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1`. Они работают и в OpenSSL 3–4, и в LibreSSL без провайдера `legacy`. В конце скрипт печатает путь к `ca.pem` для сервера, срок клиентского сертификата и команду импорта. Ключи никуда не копирует.

### 7. Отказы при деплое и проверка после него

- `deploy/deploy.sh`, `check_inputs`: `[[ -f /etc/authorled/admin-client-ca.pem ]] || fail …` стоит до бэкапа и `compose up`, поэтому релиз без файла ничего не трогает. Дополнительно релиз проваливается на `caddy validate`: `trust_pool file` читает файл при разборе конфигурации.
- Новый `deploy/check_admin.sh <admin host> <auth origin> <app origin>` запускается в workflow после `check_site.sh` и проверяет:
  1. `openssl s_client -connect admin.soavtor.app:443 -servername admin.soavtor.app` без сертификата: сертификат сервера проверяется (`Verify return code: 0`), в «Acceptable client certificate CA names» есть «Authorled admin CA», а `curl` без сертификата завершается ошибкой TLS без HTTP-кода. Первая часть не даёт проверке «пройти» из-за отсутствия DNS или сертификата сайта.
  2. `curl https://auth.soavtor.app/ -H 'Host: admin.soavtor.app'` получает отказ Caddy (`421` или `403`), а не ответ Authentik.
  3. `https://auth.soavtor.app/if/admin/` отвечает `404`.
  4. `…/api/v3/flows/executor/default-authentication-flow/` на `auth.soavtor.app` и `app.soavtor.app` отвечает `404`.
  5. `https://app.soavtor.app/api/v3/flows/executor/authorled-authentication/` отвечает `200`.
- Вход `akadmin` с сертификатом и его отказ на публичном адресе проверяются вручную с Mac владельца. Пароль и код в CI недоступны и не нужны.

### 8. Локальная проверка правила входа

На локальном стенде mTLS нет. Шаг отказа проверяется так: Authentik запускается с `AUTH_ADMIN_DOMAIN=admin.localhost:9000`, `akadmin` входит на `http://localhost:9000` и получает отказ, затем входит на `http://admin.localhost:9000` (`*.localhost` ведёт на loopback) и попадает в админку. Автор входит через dev-сервер фронтенда как раньше. Подмена изнутри сети проверяется так: Authentik временно доверяет только шлюзу локальной сети (`<шлюз>/32`), запрос из другого контейнера той же сети с `X-Forwarded-Host` адреса админки получает отказ. После проверки значения возвращаются к `localhost:9000` и прежним настройкам.

### 9. Доверенный прокси — только шлюз Docker

При `172.16.0.0/12` Authentik принимает `X-Forwarded-Host` от любого контейнера сети, в том числе от API, где `claude-engineer` выполняет shell. Такой контейнер может обратиться к `authentik-server:9000` напрямую с хостом админки и обойти правило Decision 3 (пароль и код остаются нужны). На проде `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS` равен одному адресу, шлюзу сети `authorled_agentos` с маской `/32`: с него приходит только docker-proxy, то есть Caddy.

`deploy/deploy.sh` в `check_inputs` читает шлюз сети (`docker network inspect authorled_agentos`) и значение из `.env`. Если сети нет или значение не равно ровно `<шлюз>/32`, релиз останавливается с ошибкой, в которой названы оба значения, до бэкапа и `compose up`.

Закреплять адреса сети в compose не стали: смена IPAM требует пересоздать сеть, то есть остановить все контейнеры на релизе.

## Risks / Trade-offs

- [Caddy перестанет включать `strict_sni_host` сам] → проверка 2 после деплоя упадёт. Тогда нужна строка в `/etc/caddy/Caddyfile` перед `import` (глобальные `servers { strict_sni_host on }`), с подтверждения владельца.
- [Authentik видит за прокси не тот хост, что ожидалось] → проверка на локальном стенде (Decision 8) и ручная проверка на проде с Mac. Если `get_host()` даёт не хост админки, правило отказывает и на адресе админки, то есть закрывает, а не открывает. Владелец входит через `ak` на сервере, и правило правится.
- [Сессия `akadmin` с адреса админки действует на `auth.soavtor.app` (общая cookie)] → API админки доступен из браузера владельца и без сертификата. Это принято в интенте. Сессия живёт только на Mac владельца.
- [У `akadmin` есть app password или API-токен] → через `client_credentials` или `Authorization: Bearer` можно обойти вход. В миграции владелец проверяет в админке, что токенов у `akadmin` нет. Отдельной защиты change не добавляет.
- [Потеря Mac или ключей] → `admin_cert.sh init --replace-ca` на другом компьютере, замена `/etc/authorled/admin-client-ca.pem` по SSH, `systemctl reload caddy`. Если потерян ещё и доступ к почте кодов — `ak` на сервере.
- [Истёк клиентский сертификат (2 года)] → срок печатает скрипт и записан в README. Перевыпуск — `admin_cert.sh client`, без изменений на сервере.
- [Сеть пересоздали, шлюз сменился] → релиз остановится и назовёт новый шлюз. Владелец меняет значение в `/etc/authorled/authorled.env` с подтверждения и запускает релиз снова.
- [Новый сервер без сети `authorled_agentos`] → первый релиз остановится. Сеть создаёт ручной первый запуск по README, затем значение в env и релиз.
- [Подмена `X-Forwarded-Host` с доверенного адреса] → закрывает только Caddy, который перезаписывает заголовок. С шлюза приходит только docker-proxy портов хоста, а они открыты лишь на `127.0.0.1`.
- [Белый список потоков закроет поток, который понадобится продукту] → новый поток продукта добавляется в белый список в том же change, что и в blueprints. Проверка 5 ловит закрытый поток входа.

## Migration Plan

Каждый шаг на сервере и в DNS выполняется с подтверждения владельца в чате.

1. Владелец на Mac: `scripts/admin_cert.sh init`, импорт `.p12` в Связку ключей (вход).
2. Сервер: `ca.pem` → `/etc/authorled/admin-client-ca.pem` (root, 0644), `AUTH_ADMIN_DOMAIN=admin.soavtor.app` и `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS=172.18.0.1/32` (шлюз `authorled_agentos`, сверить перед заменой) в `/etc/authorled/authorled.env`.
3. DNS: A-запись `admin.soavtor.app` → IP сервера `authorled` (Reg.ru, зона `soavtor.app`), проверка через `dns.google`.
4. Владелец проверяет в админке, что у `akadmin` нет токенов и app passwords.
5. Релиз из `main`. Деплой проверяет файл, применяет blueprints, перезагружает Caddy, `check_admin.sh` проходит.
6. Владелец с Mac: вход на `https://admin.soavtor.app/if/admin/` в Safari и Chrome. Попытка входа `akadmin` через `app.soavtor.app` получает отказ. Сессии `akadmin`, открытые до релиза, завершаются в админке.
7. Откат: прошлый релиз (`openspec/specs/runtime`, «Откат на прошлый релиз»). Его Caddyfile не знает `admin.soavtor.app`, админка снова на `auth.soavtor.app`. Лишняя переменная и файл ему не мешают.
