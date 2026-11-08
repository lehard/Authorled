# Бизнес-интент: переезд сервиса на домен soavtor.app

Статус: решения согласованы с владельцем 2026-11-08 (схема адресов — из `product-site`: сайт в корне, сервис и вход на поддоменах; письма с `noreply@soavtor.app`); DNS-записи внесены и домен проверен в Resend 2026-11-08 (см. «Что уже сделано»); change `domain-soavtor-app` реализован и выпущен в v0.3.1 2026-11-08 (вход, письма и переадресации проверены на сервере); открыты 5.4 (MCP, перенесено в бэклог) и 5.5 (удаление старого бренда Authentik); не архивирован. Владелец: lehard. Обновлено: 2026-11-08.
Рамки: мастер-спека `runtime` («Обратный прокси»), `auth` (вход фронтенда, издатель токенов); интент `product-site` (этот интент — его Non-goal «переезд, когда будет домен»); `deploy/Caddyfile`, `auth/blueprints/20-oidc.yaml`, `auth/blueprints/30-authentication-flow.yaml`, `.github/workflows/deploy.yml`.

## Why

Владелец купил свой домен `soavtor.app` (Reg.ru, 2026-11-08). Сервис сейчас живёт на чужом для продукта поддомене `coauthor.glavai.ru`. По схеме из `product-site` в корне домена будет сайт продукта, сервис — на `app.`, вход — на `auth.`. Переезжать нужно сейчас, пока пользователей нет: потом каждый переезд выбивает всех из аккаунтов и ломает ссылки.

## What Changes

1. **Адреса.**
   - `app.soavtor.app` — сервис: всё, что сейчас отдаёт `coauthor.glavai.ru` (фронтенд, `/os/` на API, пути входа Authentik с заголовком `Host: auth.soavtor.app`).
   - `auth.soavtor.app` — Authentik, как сейчас `auth.coauthor.glavai.ru`.
   - `soavtor.app` — сайт продукта (`product-site`). Пока сайт не выложен, корень временно (302) переводит на `https://app.soavtor.app/`; сайт заменит эту переадресацию.
   - `www.soavtor.app` — постоянно (301) на `https://soavtor.app` с тем же путём.
2. **Старые адреса.** `coauthor.glavai.ru` постоянно (301) переводит на `https://app.soavtor.app` с тем же путём и параметрами, чтобы старые ссылки и закладки работали. Держим не меньше полугода. Блок `auth.coauthor.glavai.ru` из прокси убирается: адрес входа переадресацией не заменить, у токенов другой издатель.
3. **Вход.** Издатель токенов `https://auth.soavtor.app/application/o/authorled/`, адреса возврата `https://app.soavtor.app/auth/callback` и `https://app.soavtor.app/login`, cookie Authentik на `.soavtor.app`. Blueprint создаёт бренд для домена `auth.soavtor.app` (бренд ищется по домену). Старый бренд `auth.coauthor.glavai.ru` после проверки удаляется вручную в админке Authentik.
4. **Письма** уходят с `CoAuthor <noreply@soavtor.app>` через Resend. Домен `coauthor.glavai.ru` в Resend удаляется после проверки письма с нового адреса.
   Имя отправителя меняется на «Соавтор» следующим релизом, в change `rename-soavtor` (`business-intents/rename-soavtor.md`).
5. **Настройки, которые меняются** (значения не секретные):
   - сервер, `/etc/authorled/authorled.env`: `AGENTOS_URL`, `AUTH_BRAND_DOMAIN`, `AUTH_ISSUER`, `AUTH_FRONTEND_REDIRECT_URI`, `AUTH_FRONTEND_LOGOUT_URI`, `AUTHENTIK_COOKIE_DOMAIN`, `AUTHENTIK_EMAIL__FROM`;
   - GitHub, окружение `production`: `PUBLIC_URL`, `AUTH_ISSUER`, `AUTH_FRONTEND_REDIRECT_URI`, `AUTH_FRONTEND_LOGOUT_URI`.
6. **Порядок переезда** — за один релиз:
   1. DNS и проверка домена в Resend (сделано, ждёт распространения DNS);
   2. change с новым `deploy/Caddyfile` влит в `main`;
   3. перед релизом: переменные GitHub и env на сервере (каждое изменение на сервере — с подтверждением владельца);
   4. релиз: `deploy.sh` пересоздаёт контейнеры с новыми настройками и перезагружает Caddy, Caddy сам получает сертификаты;
   5. проверка: вход с кодом из письма, соавтор, переадресации, MCP.
7. **Документы и тексты.** Адреса в `docs/legal/` и в интенте `referral-program` заменяются на новые (сделано вместе с этим интентом). В документации и спеках репозитория старого домена нет.

## Что уже сделано (2026-11-08)

- Владелец перевёл домен на DNS Reg.ru (`ns1.reg.ru`, `ns2.reg.ru`), реестр это подтверждает; публичные DNS ещё помнят старые серверы хостинга Reg.ru.
- В зоне `soavtor.app`: `@`, `www`, `app` и `auth` — A `66.151.34.151` (сервер Authorled); для Resend — `resend._domainkey` TXT (DKIM), `rsend` CNAME `rsend-apne1.forge.rmta.net.`, `send` CNAME `send.forge.rmta.net.`, `_dmarc` TXT `v=DMARC1; p=none;`. До релиза Caddy эти адреса по HTTPS не отвечают: сертификатов для них ещё нет.
- Домен добавлен владельцем в Resend и проверен.

## Scope

- `deploy/Caddyfile`: блоки `app.soavtor.app`, `auth.soavtor.app`, `soavtor.app`, `www.soavtor.app`, `coauthor.glavai.ru` (только переадресация); удалить `auth.coauthor.glavai.ru`.
- Мастер-спека `runtime`, «Обратный прокси»: переадресации со старого домена, `www` и временная с корня.
- Настройки сервера и GitHub (п. 5) — не в репозитории, меняются при выпуске.
- `example.env`: пример `AUTHENTIK_COOKIE_DOMAIN` и комментарии, если в них нужен пример схемы.
- Проверка на сервере, запись в `tmp/VERIFY.md`.

## Non-goals

- Сам сайт в корне домена — `product-site`; Яндекс Метрика — там же.
- Перенос сервера и почты в РФ — отдельно, до открытого запуска (`payments-tochka`, `05-security-and-compliance.md`).
- Удаление DNS-записей `coauthor` в зоне `glavai.ru`: они нужны переадресации; убрать вместе с ней.
- Перенос данных: база, файлы и аккаунты остаются как есть.

## Constraints (из контекст-пака)

- Без fallback: каждая настройка адреса обязательна, старые значения не подставляются; не задана — сервис не стартует, сборка фронтенда падает.
- Код выкатывается только релизом из `main`; изменения на сервере — только с подтверждением владельца.
- Секреты в env-файле не трогаются и не выводятся.
- `.app` в списке HSTS preload: домен работает только по HTTPS, это и так требование спеки.

## Acceptance criteria

- `https://app.soavtor.app/login` открывает вход; код приходит с `noreply@soavtor.app`, письмо проходит DKIM и SPF; после входа открывается полка.
- Токены выдаёт `https://auth.soavtor.app/application/o/authorled/`, API их принимает; токен старого издателя API отклоняет, фронтенд отправляет на вход.
- `https://app.soavtor.app/os/health` отвечает; соавтор отвечает в чате; MCP подключается по новому адресу.
- `https://coauthor.glavai.ru/<путь>?<параметры>` отвечает 301 на `https://app.soavtor.app/<путь>?<параметры>`.
- `https://www.soavtor.app/x` — 301 на `https://soavtor.app/x`; `https://soavtor.app/` — 302 на `https://app.soavtor.app/`.
- У всех адресов действующие сертификаты.
- Релиз проходит проверку `PUBLIC_URL` в `deploy.yml` на новом адресе.

## Risks

- **Все выйдут из аккаунтов один раз**: у токенов меняется издатель. Пользователей пока нет, поэтому сейчас.
- **MCP-клиенты** со старым адресом нужно переподключить.
- **Распространение DNS** занимает до суток; релиз — только когда `app`, `auth`, `@`, `www` видны в публичном DNS и Resend показывает домен проверенным.
- **Настройки меняются вне репозитория.** Если env на сервере и переменные GitHub разойдутся, вход сломается (адрес возврата не совпадёт). Меняются вместе, прямо перед релизом.

## Open Questions

- Нет. Решения владельца 2026-11-08: схема адресов из `product-site`; письма с `noreply@soavtor.app`. Рекомендации, принятые по умолчанию: корень до сайта — временная переадресация на сервис; старый домен — 301 не меньше полугода.

## References

- `business-intents/product-site.md` — схема адресов и сайт.
- `deploy/Caddyfile`, `.github/workflows/deploy.yml`, `auth/blueprints/20-oidc.yaml`, `auth/blueprints/30-authentication-flow.yaml`.
- [Resend: домены](https://resend.com/docs/dashboard/domains/introduction).
