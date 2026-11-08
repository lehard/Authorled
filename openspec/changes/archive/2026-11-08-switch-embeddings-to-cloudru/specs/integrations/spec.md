## ADDED Requirements

### Requirement: Эмбеддинги через Cloud.ru Foundation Models
Система MUST предоставлять эмбеддинги Cloud.ru Foundation Models (OpenAI-совместимый API) через псевдонимы прокси `giga-embeddings` (`ai-sage/Giga-Embeddings-instruct-480M`), `bge-m3-embeddings` (`BAAI/bge-m3`) и `qwen3-embeddings` (`Qwen/Qwen3-Embedding-0.6B`); все три MUST иметь 1024 измерения. Ключ `CLOUDRU_API_KEY` MUST задаваться только прокси. Соединение MUST проверять TLS-сертификат; отключение проверки MUST NOT использоваться.

#### Scenario: Эмбеддинг знаний через Cloud.ru
- GIVEN `EMBEDDINGS_MODEL=giga-embeddings`
- WHEN в `shared-knowledge` строится векторный индекс
- THEN эмбеддинги MUST запрашиваться у прокси псевдонимом `giga-embeddings` и иметь 1024 измерения

#### Scenario: Каждый псевдоним Cloud.ru отдаёт 1024 измерения
- GIVEN прокси запущен с рабочим `CLOUDRU_API_KEY`
- WHEN к прокси приходит запрос эмбеддинга с псевдонимом `giga-embeddings`, `bge-m3-embeddings` или `qwen3-embeddings`
- THEN ответ MUST содержать вектор из 1024 чисел

#### Scenario: Cloud.ru отказывает
- GIVEN выбран псевдоним Cloud.ru, а Cloud.ru отвечает ошибкой (нет денег на балансе, ключ отклонён или отозван)
- WHEN в `shared-knowledge` загружается контент
- THEN загрузка MUST завершиться ошибкой со статусом контента `failed`, без перехода на другой псевдоним или провайдер эмбеддингов

## REMOVED Requirements

### Requirement: Эмбеддинги через шлюз Sber500
**Reason**: Ключ общего шлюза Sber500 исчерпал бюджет (`429 budget_exceeded`, 2026-11-08), доступ проекту не принадлежит и не восстанавливается.
**Migration**: Те же псевдонимы (`giga-embeddings`, `bge-m3-embeddings`, `qwen3-embeddings`) указывают на Cloud.ru Foundation Models; в `.env` вместо `SBER500_API_BASE` и `SBER500_API_KEY` задать `CLOUDRU_API_KEY`. `EMBEDDINGS_MODEL` не меняется; `shared_knowledge` пуста, повторная загрузка не нужна.
