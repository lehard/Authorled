# Бизнес-интент: проверка сборки сайта не путает canonical со ссылкой документа

Статус: решения согласованы с владельцем 2026-11-10; change `site-check-canonical` спланирован, реализован, проверен и архивирован 2026-11-10 (`openspec/changes/archive/2026-11-10-site-check-canonical/`); CI с адресами продукта проверяется в пулл-реквесте, выкладка — релизом `v0.3.13`. Владелец: lehard. Обновлено: 2026-11-10.
Рамки: мастер-спеки `web/site` (сборка, `canonical`, выкладка на `soavtor.app`) и `runtime` («Деплой по релизу»); архив `2026-11-09-no-training-in-app` (design D6 «Ссылки между документами»); `.github/workflows/validate.yml`, `.github/workflows/deploy.yml`.

## Why

Релиз `v0.3.12` (2026-11-10) не выкатился: шаг «Build the site» в `deploy.yml` упал на `site/scripts/check-build.mjs`:

- `legal/offer/index.html: a link to https://soavtor.app/legal/offer/ was not made local`;
- то же для `legal/privacy/index.html` и `pricing/index.html`.

Сервер не тронут: выкладка остановилась до отправки файлов, на проде `v0.3.11`.

Причина в самой проверке, а не в сайте. По D6 ссылки документа на `https://soavtor.app/…` отрисовка делает относительными, а проверка ищет на странице документа любой `href="https://soavtor.app…"`. Под этот шаблон попадает и `<link rel="canonical" href="https://soavtor.app/legal/offer/" />`: при сборке с `SITE_ORIGIN=https://soavtor.app` canonical каждой страницы документа начинается с адреса продукта. Ссылки в тексте документов сделаны локальными правильно.

В CI ошибка не видна: `validate.yml` собирает сайт с `SITE_ORIGIN=https://site.invalid`, и шаблон ни с чем не совпадает. С адресом продукта сайт собирается только при выкладке, поэтому сломанная проверка дошла до релиза. Проверка появилась после `v0.3.11` (коммит `09170ef`, change `no-training-in-app`).

## What Changes

1. **Проверка ссылок документа смотрит только на ссылки текста.** В `check-build.mjs` правило «ссылка на `soavtor.app` не сделана локальной» ищет только атрибуты `href` у тегов `<a>`, а не любые `href` страницы. `canonical`, `og:url` и прочие служебные адреса страницы проверяются своими правилами, как сейчас.
2. **CI собирает сайт с адресами продукта.** `validate.yml` передаёт в `validate.sh` `SITE_ORIGIN=https://soavtor.app` и `SITE_APP_URL=https://app.soavtor.app`, те же, что `deploy.yml`. Тогда проверка сборки в пулл-реквесте видит то же, что при выкладке.
3. **Выкладка.** После слияния — релиз `v0.3.13` из `main` (по просьбе владельца). Релиз `v0.3.12` остаётся в списке как неудавшийся.

## Scope

- `site/scripts/check-build.mjs`: правило ссылок документа.
- `.github/workflows/validate.yml`: адреса сайта для сборки в CI.
- Мастер-спека `web/site`, если в ней описан адрес сборки в CI или правило ссылок документа.
- Проверка: сборка сайта и `check-build.mjs` локально с `SITE_ORIGIN=https://soavtor.app` и с нейтральным адресом; `validate.sh`; запись в `tmp/VERIFY.md`.

## Non-goals

- Тексты документов `docs/legal/*.md` и сами страницы сайта не меняются.
- Отрисовка ссылок (`LegalDocument.tsx`, D6) не меняется: она работает правильно.
- Откат или удаление релиза `v0.3.12`.
- Новые проверки сайта сверх исправления этой.

## Constraints (из контекст-пака)

- Без fallback: проверка по-прежнему падает на ссылке текста документа, которая осталась абсолютной на `soavtor.app`; исправление сужает шаблон, а не глушит проверку.
- `SITE_ORIGIN` и `SITE_APP_URL` остаются обязательными без значений по умолчанию (спека `web/site`).
- Выкладка только релизом из `main`; ручной выкладки нет.

## Acceptance criteria

- `npm run build --prefix site` с `SITE_ORIGIN=https://soavtor.app` и `SITE_APP_URL=https://app.soavtor.app` проходит `check-build.mjs`.
- Если в собранной странице документа оставить ссылку текста `<a href="https://soavtor.app/pricing/">`, проверка падает с именем файла и адресом.
- CI в пулл-реквесте собирает сайт с адресами продукта и проходит.
- Релиз `v0.3.13` выкатывается: шаги «Build the site», «Deploy on the server», проверки адресов, сайта и админки зелёные.

## Risks

- Если CI собирает с адресом продукта, ошибка, которая видна только с нейтральным адресом, перестанет ловиться. Сейчас таких правил нет: адрес сборки влияет только на `canonical`, Open Graph и `sitemap.xml`.

## Open Questions

- Нет.

## References

- Неудачный запуск выкладки: GitHub Actions run `42770547627` (релиз `v0.3.12`, 2026-11-10).
- `openspec/changes/archive/2026-11-09-no-training-in-app/design.md`, D6.
- `openspec/specs/web/site/spec.md`, «Локальный запуск и выкладка».
