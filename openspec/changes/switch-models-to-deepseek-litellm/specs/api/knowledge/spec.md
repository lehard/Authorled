# Spec Delta

## MODIFIED Requirements

### Requirement: Shared knowledge
Система MUST создавать знание `shared-knowledge` через `create_knowledge(name="shared-knowledge", table_name="shared_knowledge")`: `PgVector` с таблицей `shared_knowledge`, `SearchType.hybrid`, эмбеддер на прокси с псевдонимом `gigachat-embeddings` и размерностью 1024, и отдельный content-адаптер `PostgresDb` с ID `agentos-db-shared_knowledge_contents` и таблицей `shared_knowledge_contents`. ID content-адаптера MUST отличаться от ID БД OS `agentos-db`. Загружаемые документы MUST разбиваться на куски, не превышающие лимит входа модели эмбеддингов (512 токенов).

#### Scenario: Knowledge в конфигурации
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /config`
- THEN `knowledge.knowledge_instances` MUST содержать `shared-knowledge` с `db_id` `agentos-db-shared_knowledge_contents`

#### Scenario: Длинный документ
- GIVEN в `shared-knowledge` загружается PDF длиной больше 512 токенов
- WHEN документ обрабатывается
- THEN статус контента MUST стать `completed`, и каждый кусок MUST получить эмбеддинг размерности 1024
