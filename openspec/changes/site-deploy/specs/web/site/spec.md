## RENAMED Requirements

- FROM: `### Requirement: Локальный запуск до домена`
- TO: `### Requirement: Локальный запуск и выкладка`

## MODIFIED Requirements

### Requirement: Локальный запуск и выкладка
Локально сайт MUST запускаться командами `npm run dev --prefix site` (сервер разработки) и `npm run preview --prefix site` (собранные файлы); оба слушают только loopback на своём порту, отличном от порта `web/`. На сервер сайт MUST выкладываться только деплоем по релизу (спека `runtime`, «Деплой по релизу») на домен продукта `soavtor.app` со сборкой `SITE_ORIGIN=https://soavtor.app` и `SITE_APP_URL=https://app.soavtor.app`; ручной выкладки и временных адресов MUST NOT быть.

#### Scenario: Локальный просмотр
- GIVEN стек compose запущен и `.env` содержит `SITE_ORIGIN`, `SITE_APP_URL`, `AGENTOS_URL`
- WHEN выполняется `npm run dev --prefix site`
- THEN сайт MUST открываться на `127.0.0.1` и отправлять заявку в локальный API

#### Scenario: Сайт на домене продукта
- GIVEN опубликован релиз с этим изменением
- WHEN браузер открывает `https://soavtor.app/privacy/`
- THEN MUST открыться страница политики, у которой `canonical` равен `https://soavtor.app/privacy/`
- AND кнопка «Войти» на главной MUST вести на `https://app.soavtor.app`
