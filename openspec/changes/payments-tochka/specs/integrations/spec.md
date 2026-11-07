## ADDED Requirements

### Requirement: Интернет-эквайринг Точки
Система MUST обращаться к API Точки только по адресу из обязательной `TOCHKA_API_URL`: `https://enter.tochka.com/uapi/` (боевой) или `https://enter.tochka.com/sandbox/v2/` (тестовый). Ключ MUST передаваться заголовком `Authorization: Bearer` из `TOCHKA_JWT`. Сертификат сервера MUST проверяться набором с Russian Trusted Root CA и Sub CA; отключение проверки MUST NOT использоваться.

#### Scenario: Чужой адрес
- GIVEN `TOCHKA_API_URL` равен `https://example.com/uapi/`
- WHEN запускается API
- THEN старт MUST завершиться ошибкой, называющей `TOCHKA_API_URL`

#### Scenario: Проверка сертификата
- GIVEN API обращается к Точке
- WHEN сервер предъявляет цепочку Russian Trusted Sub CA
- THEN соединение MUST проверяться набором `agno/litellm/certs/ca-bundle.pem`

### Requirement: Обязательные настройки Точки
API MUST NOT стартовать без `TOCHKA_API_URL`, `TOCHKA_JWT`, `TOCHKA_CUSTOMER_CODE` (9 символов), `TOCHKA_MERCHANT_ID` (15 цифр), `TOCHKA_TAX_SYSTEM`, `TOCHKA_VAT_TYPE`, `TOCHKA_PAYMENT_METHOD` (значения из перечней Точки), `TOCHKA_REDIRECT_URL` и `TOCHKA_FAIL_REDIRECT_URL`. Ошибка MUST называть переменную и MUST NOT содержать значение `TOCHKA_JWT`. Значений по умолчанию MUST NOT быть.

#### Scenario: Нет ключа
- GIVEN `TOCHKA_JWT` не задан
- WHEN запускается API
- THEN старт MUST завершиться ошибкой, называющей `TOCHKA_JWT`

#### Scenario: Неверная система налогообложения
- GIVEN `TOCHKA_TAX_SYSTEM` равен `usn`
- WHEN запускается API
- THEN старт MUST завершиться ошибкой, называющей `TOCHKA_TAX_SYSTEM` и допустимые значения

### Requirement: Подпись уведомлений Точки
Уведомление Точки MUST считаться подлинным, только если его тело — JWT с алгоритмом RS256, подпись которого проверяется открытым ключом Точки из репозитория (JWK с `https://enter.tochka.com/doc/openapi/static/keys/public`). Другие алгоритмы, включая `none` и `HS256`, MUST отклоняться.

#### Scenario: Пример из документации
- GIVEN тело уведомления из примера документации Точки
- WHEN проверяется его подпись
- THEN проверка MUST пройти, и MUST читаться `operationId` уведомления

#### Scenario: Алгоритм none
- GIVEN тело — JWT с `alg: none`
- WHEN проверяется его подпись
- THEN проверка MUST отклонить уведомление

### Requirement: Ответы API Точки проверяются
Ответ Точки MUST разбираться по её схеме. Отсутствие обязательного поля, статус вне перечня Точки или ответ с ошибкой MUST завершаться явной ошибкой с названием поля, статуса или кодом ответа Точки. Тело ответа и ключ MUST NOT попадать в текст ошибки целиком.

#### Scenario: Ошибка Точки
- GIVEN Точка отвечает `403` с `{"code": "403", "message": "Forbidden by consent", ...}`
- WHEN ядро создаёт подписку
- THEN MUST возникать ошибка с кодом `403` и сообщением Точки, а оформление MUST NOT сохраняться

#### Scenario: Сеть недоступна
- GIVEN соединение с Точкой не устанавливается
- WHEN ядро обращается к Точке
- THEN MUST возникать ошибка недоступности Точки, отличная от ошибки ответа
