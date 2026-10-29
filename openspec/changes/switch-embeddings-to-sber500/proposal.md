# Proposal

## Why

Эмбеддинги базы знаний идут в GigaChat API Сбера по ключу физлица, и тот отвечает `402 Payment Required`: бесплатный пакет не покрывает эмбеддинги, а платный доступ продаёт Cloud.ru, где модели `Embeddings-2` нет. У владельца есть ключ к шлюзу Sber500 (OpenAI-совместимый LiteLLM, `https://shared1.multitool.works:4000/v1`) с моделями эмбеддингов. Владелец будет переключать модели, поэтому нужен быстрый переключатель, а не замена одной модели другой: всё настроенное остаётся, активная модель выбирается одной переменной.

Живая проверка 2026-10-29: `giga-embeddings-instruct-480m`, `bge-m3` и `qwen3-embedding-0.6b` отдают по 1024 измерения, как и прежняя `Embeddings-2`.

## What Changes

- В `litellm/config.yaml` рядом с `gigachat-embeddings` добавляются псевдонимы шлюза Sber500: `giga-embeddings` (`giga-embeddings-instruct-480m`), `bge-m3-embeddings` (`bge-m3`), `qwen3-embeddings` (`qwen3-embedding-0.6b`).
- Активный псевдоним выбирает новая обязательная переменная `EMBEDDINGS_MODEL` в `.env` (без значения по умолчанию). Неизвестное или пустое значение — явная ошибка запуска API с именем переменной. Автоматического перехода на другой псевдоним при ошибке нет.
- Допустимы только псевдонимы с 1024 измерениями; размерность 1024 остаётся константой, несоответствие размерности ответа — явная ошибка.
- Новые обязательные переменные прокси `SBER500_API_BASE` и `SBER500_API_KEY`. `GIGACHAT_CREDENTIALS`, `GIGACHAT_SCOPE` и пакет Russian Trusted CA остаются без изменений; ключи всех настроенных провайдеров обязательны в compose.
- Строка `CLOUDRU_API_KEY` в локальном `.env` (там лежит ключ шлюза Sber500, а не cloud.ru) переименовывается в `SBER500_API_KEY`.
- **BREAKING (при каждом переключении):** векторы разных моделей несовместимы. После смены `EMBEDDINGS_MODEL` таблицу `shared_knowledge` нужно пересоздать и загрузить документы заново. Сейчас она пуста.
- Обновляются README, `AGENTS.md`, `example.env`, `compose.yaml`, `compose.prod.yaml`, скиллы `setup-platform` и `deploy-platform`, ADR-003 (дополняется), контекст-пак и `openspec/TODO.md`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `integrations`: GigaChat становится одним из выбираемых вариантов; добавляются требования «Эмбеддинги через шлюз Sber500» и «Выбор модели эмбеддингов».
- `llm-gateway`: список псевдонимов эмбеддингов и обязательная конфигурация (`SBER500_*`, `EMBEDDINGS_MODEL`). Требование о TLS к GigaChat не меняется.
- `api/knowledge`: псевдоним эмбеддера берётся из `EMBEDDINGS_MODEL`.
- `glossary`: строка «LiteLLM-прокси».

## Scope

- Конфигурация прокси, выбор модели переменной, проверка размерности, имена переменных, документация, спецификации.
- Размер чанков (1200 символов) и состав читателей не меняются.

## Non-goals

- Чат-модели DeepSeek остаются на `DEEPSEEK_API_KEY`; шлюз Sber500 тоже отдаёт `deepseek-v4-*`, но их не переводим.
- Не удаляем ни GigaChat, ни сертификаты Russian Trusted CA.
- Не поддерживаем модели не с 1024 измерениями (`giga-embeddings-instruct-3b` — 2048, не помещается в HNSW pgvector, лимит 2000).
- Не добавляем автоматический переход на другой псевдоним, горячее переключение без перезапуска и миграцию векторов между моделями.

## Impact

- Код: `app/settings.py` (выбор псевдонима, проверка размерности), `db/__init__.py` (комментарий), `litellm/config.yaml`, `compose.yaml` и `compose.prod.yaml` (новые переменные, `EMBEDDINGS_MODEL` в окружении API), `example.env`.
- Документы: `README.md`, `AGENTS.md`, `.agents/skills/{setup,deploy}-platform/SKILL.md`, `evals/cases.py` (критерий), ADR-003 (дополнение), `03-architecture.md`, `05-security-and-compliance.md`, `openspec/TODO.md`, мастер-спеки `overview` и `architecture`.
- Внешние системы: шлюз Sber500 (общий, ключ выдан стартапу менторами); риски в design.md.
