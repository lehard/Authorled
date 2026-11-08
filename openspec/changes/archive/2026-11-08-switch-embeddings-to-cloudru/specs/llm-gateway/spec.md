## ADDED Requirements

### Requirement: Обязательная конфигурация API и прокси
API MUST требовать `LITELLM_URL`, `LITELLM_API_KEY` и `EMBEDDINGS_MODEL`; прокси MUST требовать `LITELLM_MASTER_KEY`, `DEEPSEEK_API_KEY`, `GIGACHAT_CREDENTIALS`, `GIGACHAT_SCOPE`, `CLOUDRU_API_KEY` и файл сертификатов Russian Trusted Root CA. При отсутствии любой из них соответствующий сервис MUST завершаться с ошибкой, называющей отсутствующее значение. Значения MUST NOT подставляться по умолчанию.

#### Scenario: Нет адреса прокси
- GIVEN `LITELLM_URL` не задан
- WHEN запускается API
- THEN запуск MUST завершиться ошибкой `Required environment variable LITELLM_URL is not set`

#### Scenario: Нет ключа DeepSeek
- GIVEN `DEEPSEEK_API_KEY` не задан
- WHEN выполняется `docker compose up`
- THEN compose MUST отказаться запускать прокси с сообщением, называющим `DEEPSEEK_API_KEY`

#### Scenario: Нет ключа Cloud.ru
- GIVEN `CLOUDRU_API_KEY` не задан
- WHEN выполняется `docker compose up`
- THEN compose MUST отказаться запускать прокси с сообщением, называющим `CLOUDRU_API_KEY`

#### Scenario: Нет выбора модели эмбеддингов
- GIVEN `EMBEDDINGS_MODEL` не задан
- WHEN запускается API
- THEN запуск MUST завершиться ошибкой `Required environment variable EMBEDDINGS_MODEL is not set`

## REMOVED Requirements

### Requirement: Обязательная конфигурация шлюза
**Reason**: Шлюз Sber500 удалён: его переменные `SBER500_API_BASE` и `SBER500_API_KEY` и сценарии про них больше не действуют.
**Migration**: Заменяется требованием «Обязательная конфигурация API и прокси» с тем же составом, где вместо `SBER500_API_BASE` и `SBER500_API_KEY` прокси требует `CLOUDRU_API_KEY`; в `.env` задать `CLOUDRU_API_KEY` и удалить `SBER500_*`.
