# Проверки brand-icons (2026-11-12)

## Статические

- `./scripts/validate.sh` и `git diff --check`: прошли. CI пулл-реквеста #87 зелёный.
- `openspec validate brand-icons --strict`: valid.

## Детерминированные

- `scripts/check_brand.sh`: если изменить `web/public/favicon.svg`, выходит с кодом 1 и называет путь. Если удалить `site/public/apple-touch-icon.png`, выходит с кодом 1 и называет путь. После восстановления — код 0.
- Сборка сайта без `site/public/favicon.ico` падает: «missing favicon.ico».
- Сборки `web/dist/` и `site/dist/` содержат значки и манифест. Все страницы, включая `404.html`, ссылаются на четыре значка.

## В браузере

- Заставка до скрипта и `/login` в темах `light` и `dark`: знак 28 px с `alt=""` перед «Соавтор».
- Шапка полки на стенде worktree (`dev.sh api` на `ai_dev_brand_logo`, вход пользователем `writer`), темы `dark` и `light`: знак перед «Соавтор» в цвете текста темы.
- Шапка сайта: знак перед «Соавтор».

## На сервере (релиз v0.3.21, выкладка 43171013779 прошла)

- `app.soavtor.app` и `soavtor.app`: `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `manifest.webmanifest`, `brand-mark.svg` и `icon-512.png` отдаются с ответом 200 и совпадают с `docs/brand/` байт в байт. У сайта манифест — `site.webmanifest`.
- Главная приложения и `soavtor.app/pricing/` ссылаются на четыре значка и показывают `/brand-mark.svg`.
- Замечание: Caddy отдаёт `manifest.webmanifest` с типом `text/plain` на `app.soavtor.app` и без типа на `soavtor.app`. По спецификации ожидается `application/manifest+json`. Chrome читает манифест и с таким типом. Исправление — правка `deploy/Caddyfile`, отдельным change.
- Не проверено: значок вкладки и значок на домашнем экране на реальных устройствах.
