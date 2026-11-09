## ADDED Requirements

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

### Requirement: Якорь раздела об ИИ в оферте
Раздел оферты «Материалы Пользователя и ИИ» MUST иметь постоянный якорь `materials`: адрес `/legal/offer/#materials` MUST открывать страницу на этом разделе.

#### Scenario: Переход из чата сервиса
- GIVEN собранная страница `/legal/offer/`
- WHEN браузер открывает `/legal/offer/#materials`
- THEN в начале видимой области MUST быть заголовок «7. Материалы Пользователя и ИИ»

### Requirement: Документы без заглушек
Сборка сайта MUST завершаться ошибкой с именем файла, если в опубликованном документе осталась заглушка в квадратных скобках (например, «[указать]», «[support@...]», «[объём]») или пометка «ЧЕРНОВИК». Дата редакции в начале каждого документа MUST быть настоящей датой.

#### Scenario: Заглушка в оферте
- GIVEN в `docs/legal/offer.md` осталось «[support@...]»
- WHEN запускается сборка сайта
- THEN сборка MUST завершиться ошибкой, называющей `docs/legal/offer.md` и заглушку

#### Scenario: Черновик
- GIVEN в `docs/legal/privacy.md` есть строка «ЧЕРНОВИК»
- WHEN запускается сборка сайта
- THEN сборка MUST завершиться ошибкой, называющей `docs/legal/privacy.md`

### Requirement: Документы в подвале
Подвал каждой страницы сайта MUST содержать ссылки «Тарифы», «Публичная оферта» и «Политика обработки персональных данных», ведущие на `/pricing/`, `/legal/offer/` и `/legal/privacy/`.

#### Scenario: Подвал главной
- GIVEN собранная главная
- WHEN перечисляются ссылки подвала
- THEN среди них MUST быть `/pricing/`, `/legal/offer/` и `/legal/privacy/`

#### Scenario: Подвал страницы документа
- GIVEN собранная страница `/legal/privacy/`
- WHEN перечисляются ссылки подвала
- THEN среди них MUST быть `/pricing/` и `/legal/offer/`

## MODIFIED Requirements

### Requirement: Модуль сайта
Сайт продукта MUST быть отдельным модулем `site/` со своими зависимостями (точные версии в `package.json`, закоммиченный `package-lock.json`, Node.js той же версии, что `web/`). Сайт MUST собираться в статические файлы без своего сервера и своей базы. Сайт MUST NOT подключать код экранов сервиса (`web/src/screens`, `web/src/data`, `web/src/auth`) и MUST NOT хранить данные посетителя в браузере.

#### Scenario: Сборка в статические файлы
- GIVEN зависимости сайта установлены и настройки сборки заданы
- WHEN выполняется сборка сайта
- THEN в каталоге сборки MUST появиться готовые файлы `index.html`, `privacy/index.html`, `legal/offer/index.html`, `legal/privacy/index.html`, `pricing/index.html`, `404.html`, `sitemap.xml`, `robots.txt` и ресурсы страниц
- AND для их отдачи MUST хватать любого статического сервера

### Requirement: Страницы в готовом HTML
Каждая страница сайта MUST собираться заранее в HTML с полным текстом страницы, своими `<title>`, `description`, `canonical` и Open Graph (`og:title`, `og:description`, `og:url`, `og:image`). `sitemap.xml` MUST перечислять главную, политику заявки в бету, оферту, политику сервиса и тарифы; `robots.txt` MUST ссылаться на `sitemap.xml`. Страница 404 MUST быть закрыта от индексации (`noindex`). Язык страниц MUST быть русским (`lang="ru"`).

#### Scenario: Текст виден без JavaScript
- GIVEN собранный сайт
- WHEN `index.html` читается без выполнения скриптов
- THEN в нём MUST быть заголовок главной, тексты блоков и кнопки «Войти» и «Хочу в бету»

#### Scenario: Метаданные страницы
- GIVEN собранный сайт с `SITE_ORIGIN=https://example.test`
- WHEN читается `privacy/index.html`
- THEN `canonical` и `og:url` MUST быть `https://example.test/privacy/`
- AND `title` MUST отличаться от `title` главной

#### Scenario: Документы в карте сайта
- GIVEN собранный сайт с `SITE_ORIGIN=https://example.test`
- WHEN читается `sitemap.xml`
- THEN в нём MUST быть `https://example.test/legal/offer/`, `https://example.test/legal/privacy/` и `https://example.test/pricing/`

### Requirement: Политика обработки персональных данных
Страница `/privacy/` MUST описывать: какие данные собирает форма (почта, имя, кто вы), зачем (рассмотреть заявку и пригласить в бету), где хранятся (сервер продукта), сколько хранятся и как отозвать согласие (написать на почту для связи). Её заголовок и `title` MUST называть её политикой для заявки в бету, чтобы она не путалась с политикой сервиса на `/legal/privacy/`. Ссылка на `/privacy/` MUST быть у согласия в форме. Оператор и почта для связи в тексте MUST браться из согласованного владельцем текста; заглушек вида «[ИНН]» в собранной странице MUST NOT быть.

#### Scenario: Ссылки на политику
- GIVEN собранная главная
- WHEN перечисляются ссылки на `/privacy/`
- THEN ссылка MUST быть у согласия формы
- AND подвал MUST вести на `/legal/privacy/`, а не на `/privacy/`

#### Scenario: Две политики различимы
- GIVEN собранный сайт
- WHEN сравниваются `title` страниц `/privacy/` и `/legal/privacy/`
- THEN они MUST различаться, и `title` страницы `/privacy/` MUST содержать слово «заявк»
