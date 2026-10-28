# Spec Delta

## MODIFIED Requirements

### Requirement: Shared knowledge
Система MUST создавать знание `shared-knowledge` через `create_knowledge(name="shared-knowledge", table_name="shared_knowledge")`: `PgVector` с таблицей `shared_knowledge`, `SearchType.hybrid`, эмбеддер на прокси с псевдонимом `gigachat-embeddings` и размерностью 1024, и отдельный content-адаптер `PostgresDb` с ID `agentos-db-shared_knowledge_contents` и таблицей `shared_knowledge_contents`. ID content-адаптера MUST отличаться от ID БД OS `agentos-db`. Знание MUST объявлять читатели `pdf`, `docx`, `markdown`, `text`, `website` с кусками до 1200 символов и `csv`, `excel` с построчным разбиением. URL и загрузки с `reader_id` одного из этих читателей MUST разбиваться ими. Загрузка файла без `reader_id` в Agno 3.1.10 идёт читателем `ReaderFactory` по умолчанию (куски до 5000 символов); документация MUST требовать `reader_id` или `chunker`/`chunk_size` при загрузке.

#### Scenario: Knowledge в конфигурации
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /config`
- THEN `knowledge.knowledge_instances` MUST содержать `shared-knowledge` с `db_id` `agentos-db-shared_knowledge_contents`

#### Scenario: Читатели в конфигурации
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /knowledge/config` для `shared-knowledge`
- THEN список читателей MUST содержать `pdf`, `docx`, `csv`, `excel`, `markdown`, `text`, `website`

#### Scenario: Длинный документ
- GIVEN в `shared-knowledge` загружается PDF длиной больше 512 токенов с `reader_id=pdf`
- WHEN документ обрабатывается
- THEN статус контента MUST стать `completed`, и каждый кусок MUST получить эмбеддинг размерности 1024
