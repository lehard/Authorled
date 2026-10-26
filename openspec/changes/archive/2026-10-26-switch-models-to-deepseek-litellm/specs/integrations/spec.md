# Spec Delta

## ADDED Requirements

### Requirement: DeepSeek
Система MUST использовать DeepSeek для всех чат-моделей через LiteLLM-прокси: псевдоним `deepseek-fast` для агентов по умолчанию и судьи evals, `deepseek-thinking` для OS Manager, Company Manager и `claude-engineer`. Ключ `DEEPSEEK_API_KEY` MUST задаваться только прокси.

#### Scenario: Модели в реестре
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /registry`
- THEN ответ MUST содержать модели `deepseek-fast` и `deepseek-thinking`

### Requirement: GigaChat
Система MUST получать эмбеддинги знаний у GigaChat `Embeddings-2` (1024 измерения) через псевдоним прокси `gigachat-embeddings`. Учётные данные `GIGACHAT_CREDENTIALS` и `GIGACHAT_SCOPE` MUST задаваться только прокси.

#### Scenario: Эмбеддинг знаний
- GIVEN в `shared-knowledge` загружается контент
- WHEN строится векторный индекс
- THEN эмбеддинги MUST запрашиваться у прокси псевдонимом `gigachat-embeddings` и иметь 1024 измерения

## REMOVED Requirements

### Requirement: Anthropic
**Reason**: модели переведены на DeepSeek через LiteLLM (ADR-003); прямые вызовы провайдеров запрещены контекстом.
**Migration**: удалить `ANTHROPIC_API_KEY` и `CLAUDE_CODE_OAUTH_TOKEN` из `.env`; задать `LITELLM_URL`, `LITELLM_API_KEY` у API и `DEEPSEEK_API_KEY` у прокси.

### Requirement: OpenAI
**Reason**: эмбеддинги переведены на GigaChat (зарубежные эмбеддинги запрещены), `codex-engineer` снят с регистрации.
**Migration**: удалить `OPENAI_API_KEY` из `.env`; пересоздать векторную таблицу `shared_knowledge` и загрузить документы заново.
