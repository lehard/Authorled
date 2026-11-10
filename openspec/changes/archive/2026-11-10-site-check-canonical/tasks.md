# Tasks

Сборки сайта идут локально в этом worktree; адреса задаются переменными окружения команды (они важнее значений `.env` для `loadEnv` Vite). Сервер, стенд и `.env` не меняются.

## 1. Правило ссылок документа

- [x] 1.1 В `site/scripts/check-build.mjs` сузить шаблон правила «a link to … was not made local» до `href` тегов `<a>` (design, D1), сообщение и комментарий о D6 оставить; проверить: `SITE_ORIGIN=https://soavtor.app SITE_APP_URL=https://app.soavtor.app npm run build --prefix site` заканчивается «site build check passed», а копия `check-build.mjs` из `origin/main` (`git show origin/main:site/scripts/check-build.mjs` во временный файл в `site/scripts/`, удалить после прогона) по тому же `site/dist` падает с тремя прежними ошибками
- [x] 1.2 Отрицательная проверка: в собранный `site/dist/legal/offer/index.html` дописать `<a href="https://soavtor.app/pricing/">` и запустить `node site/scripts/check-build.mjs`; проверить: код 1 и строка `legal/offer/index.html: a link to https://soavtor.app/pricing/ was not made local`; затем пересобрать сайт, чтобы `dist` снова был чистым
- [x] 1.3 Сборка с нейтральными адресами: `SITE_ORIGIN=https://site.invalid SITE_APP_URL=https://app.invalid npm run build --prefix site`; проверить: «site build check passed»

## 2. Адреса сборки в CI

- [x] 2.1 В `.github/workflows/validate.yml` задать `SITE_ORIGIN: https://soavtor.app` и `SITE_APP_URL: https://app.soavtor.app`, комментарий над ними — «адреса выкладки, как в deploy (openspec/specs/web/site)» (design, D2); проверить: `grep -n "invalid" .github/workflows/validate.yml` ничего не находит, YAML читается (`python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/validate.yml'))"`)

## 3. Общая проверка

- [x] 3.1 `env -u BASH_ENV ./scripts/validate.sh` в активированном `agno/.venv` с адресами продукта в окружении и `git diff --check`; проверить: оба без ошибок
- [x] 3.2 Записать в `tmp/VERIFY.md` раздел этого change: статические проверки, три локальные сборки (продуктовая, отрицательная, нейтральная) и что CI и выкладка проверяются только после пулл-реквеста и релиза

## Workflow follow-up

- Verify, archive (specs synced), merge `origin/main`, проверки и слияние пулл-реквеста — по AGENTS.md («Finish in the same session»); в пулл-реквесте задание `validate` собирает сайт с `SITE_ORIGIN=https://soavtor.app` и проходит (в логе шага «Validate» есть «site build check passed»).
- Релиз `v0.3.13` из `main` по просьбе владельца; шаги «Build the site», «Deploy on the server» и проверки адресов, сайта и админки зелёные. Проверка сервера после релиза — отдельным маленьким пулл-реквестом от свежего `origin/main`.
