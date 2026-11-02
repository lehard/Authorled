# Spec Delta

## ADDED Requirements

### Requirement: Антивирус ClamAV
Compose-файлы MUST объявлять сервис `clamav` (образ ClamAV с закреплённой версией, демон `clamd` по TCP; в разработке порт публикуется только на `127.0.0.1` для API на хосте, в production не публикуется; том для антивирусных баз, healthcheck готовности). `agentos-api` MUST стартовать после статуса `healthy` у `clamav` и MUST получать его адрес из обязательных `CLAMAV_HOST` и `CLAMAV_PORT`; без них старт API MUST завершаться ошибкой, называющей переменную. В production действует то же.

#### Scenario: Порядок запуска
- GIVEN `.env` заполнен
- WHEN выполняется `docker compose up -d --build`
- THEN `agentos-api` MUST стартовать только после статуса `healthy` у `clamav`

#### Scenario: Нет адреса антивируса
- GIVEN `CLAMAV_HOST` не задан
- WHEN запускается API
- THEN старт MUST завершиться ошибкой, называющей `CLAMAV_HOST`

#### Scenario: Порт не опубликован
- GIVEN запущена конфигурация production
- WHEN проверяются опубликованные порты `clamav`
- THEN порт `clamd` MUST NOT быть опубликован на хосте

#### Scenario: API на хосте
- GIVEN `./scripts/dev.sh api` запускает API на хосте
- WHEN API принимает загрузку файла
- THEN `clamav` MUST быть запущен скриптом и доступен по `CLAMAV_HOST` и `CLAMAV_PORT`
