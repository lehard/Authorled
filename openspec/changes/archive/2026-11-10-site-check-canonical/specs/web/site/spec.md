# Spec Delta

## MODIFIED Requirements

### Requirement: Проверки сайта
`./scripts/validate.sh` MUST проверять формат, линт, типы и сборку сайта. Если зависимости сайта не установлены (`site/node_modules`), проверка MUST завершаться ошибкой с командой установки, а не пропускаться. CI MUST ставить зависимости сайта и задавать настройки сборки адресами продукта, теми же, что при выкладке: `SITE_ORIGIN=https://soavtor.app` и `SITE_APP_URL=https://app.soavtor.app`.

#### Scenario: Нет зависимостей сайта
- GIVEN `site/node_modules` отсутствует
- WHEN выполняется `./scripts/validate.sh`
- THEN проверка MUST завершиться ошибкой и назвать `npm ci --prefix site`

#### Scenario: Сборка в CI с адресами продукта
- GIVEN открыт пулл-реквест в `main`
- WHEN CI выполняет `./scripts/validate.sh`
- THEN сайт MUST собираться с `SITE_ORIGIN=https://soavtor.app` и `SITE_APP_URL=https://app.soavtor.app`
- AND проверка сборки сайта MUST видеть те же страницы, что сборка при выкладке

### Requirement: Документы сервиса
Сайт MUST публиковать документы сервиса по их адресам из текста документов: оферту на `/legal/offer/`, политику обработки персональных данных сервиса на `/legal/privacy/`, тарифы на `/pricing/`. Текст каждой страницы MUST собираться из своего файла `docs/legal/` (`offer.md`, `privacy.md`, `pricing.md`) без ручной копии: заголовки, нумерованные пункты, таблицы и ссылки — оформленным текстом. Ссылки между документами MUST вести на эти страницы.

#### Scenario: Оферта в готовом HTML
- GIVEN собранный сайт с `SITE_ORIGIN=https://example.test`
- WHEN `legal/offer/index.html` читается без выполнения скриптов
- THEN в нём MUST быть заголовок оферты и текст п. 7.3 из `docs/legal/offer.md`
- AND `canonical` MUST быть `https://example.test/legal/offer/`

#### Scenario: Таблица политики
- GIVEN собранный сайт
- WHEN читается `legal/privacy/index.html`
- THEN таблицы из `docs/legal/privacy.md` MUST быть элементами `<table>`, а не строками с символами `|`

#### Scenario: Правка документа без кода
- GIVEN владелец изменил текст пункта в `docs/legal/offer.md`
- WHEN сайт собран заново
- THEN страница `/legal/offer/` MUST показывать новый текст без правок в `site/src`

#### Scenario: Ссылка на тарифы из оферты
- GIVEN собранная страница `/legal/offer/`
- WHEN перечисляются ссылки на тарифы и политику в тексте оферты
- THEN они MUST вести на `/pricing/` и `/legal/privacy/` домена сайта, и эти страницы MUST быть в сборке

#### Scenario: Сборка документов с адресом продукта
- GIVEN сайт собирается с `SITE_ORIGIN=https://soavtor.app` и `SITE_APP_URL=https://app.soavtor.app`
- WHEN проверка сборки читает страницы документов
- THEN `canonical` и `og:url` вида `https://soavtor.app/legal/offer/` MUST NOT считаться ссылкой документа, не сделанной локальной
- AND проверка сборки MUST пройти

#### Scenario: Ссылка текста документа осталась абсолютной
- GIVEN в собранной странице документа `legal/offer/index.html` есть ссылка `<a href="https://soavtor.app/pricing/">`
- WHEN выполняется проверка сборки сайта
- THEN проверка MUST завершиться ошибкой, называющей `legal/offer/index.html` и адрес `https://soavtor.app/pricing/`
