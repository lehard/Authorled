# Spec Delta

## ADDED Requirements

### Requirement: Тип манифеста страниц
Обратный прокси MUST отдавать `/manifest.webmanifest` на домене сервиса и на домене продукта с заголовком `Content-Type: application/manifest+json`, со сжатием `gzip` и без него. После запуска деплой MUST проверять это на обоих доменах. Если код ответа не `200`, тип другой или заголовка нет, запуск MUST завершиться ошибкой, которая называет адрес и полученное значение. Автоматический откат MUST NOT выполняться.

#### Scenario: Манифест приложения
- GIVEN выложен релиз
- WHEN запрашивается `https://app.soavtor.app/manifest.webmanifest`
- THEN ответ MUST быть `200` с `content-type: application/manifest+json`

#### Scenario: Сжатый манифест сайта
- GIVEN выложен релиз
- WHEN запрашивается `https://soavtor.app/manifest.webmanifest` с `Accept-Encoding: gzip`
- THEN ответ MUST быть `200` с `content-type: application/manifest+json`

#### Scenario: Тип потерян
- GIVEN `https://soavtor.app/manifest.webmanifest` отвечает без `content-type` или с `text/plain`
- WHEN проходит проверка после деплоя
- THEN запуск MUST завершиться ошибкой с адресом и полученным типом
- AND прошлая версия MUST NOT возвращаться сама
