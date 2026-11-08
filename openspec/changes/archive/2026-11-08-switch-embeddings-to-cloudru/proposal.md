# Proposal

## Why

Эмбеддинги базы знаний не работают. Общий шлюз Sber500 с 2026-11-08 и локально, и на сервере отвечает `429 budget_exceeded`: ключ, который выдали стартапу менторы, исчерпал бюджет. GigaChat API по ключу физлица отвечает `402`. Рабочего псевдонима эмбеддингов не осталось.

У владельца теперь свой платный аккаунт Cloud.ru Evolution Foundation Models: сервисный аккаунт `coauthor-embeddings`, ключ, пополненный баланс. Cloud.ru — российский провайдер с OpenAI-совместимым API, и в его каталоге есть те же три модели, что были на шлюзе. Живая проверка 2026-11-08: все три отдают по 1024 измерения. Источник решений — `business-intents/embeddings-cloudru.md`.

## What Changes

- Псевдонимы `giga-embeddings`, `bge-m3-embeddings` и `qwen3-embeddings` в конфигурации прокси указывают на Cloud.ru Foundation Models: модели `ai-sage/Giga-Embeddings-instruct-480M`, `BAAI/bge-m3` и `Qwen/Qwen3-Embedding-0.6B`. Адрес провайдера фиксирован в конфигурации прокси, `drop_params` остаётся.
- Имена псевдонимов, белый список в `app/settings.py`, переменная `EMBEDDINGS_MODEL` и проверка размерности 1024 не меняются. Активная модель остаётся `giga-embeddings`.
- Новая обязательная переменная прокси `CLOUDRU_API_KEY`. Без неё compose отказывается запускать прокси.
- **BREAKING (конфигурация):** переменные `SBER500_API_BASE` и `SBER500_API_KEY` удаляются, требование «Эмбеддинги через шлюз Sber500» снимается. До выкладки в `.env` локально и в `/etc/authorled/authorled.env` на сервере нужно добавить `CLOUDRU_API_KEY`, иначе прокси не стартует.
- Обновляются `example.env`, `agno/compose.yaml`, комментарий в `compose.prod.yaml`, README, `AGENTS.md`, скиллы `setup-platform` и `deploy-platform`, ADR-003 (дополнение), контекст-пак (`03-architecture.md`, `05-security-and-compliance.md`), `openspec/TODO.md`, схема в мастер-спеке `architecture` и критерий в `agno/evals/cases.py`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `integrations`: требование «Эмбеддинги через шлюз Sber500» снимается, его место занимает «Эмбеддинги через Cloud.ru Foundation Models» с теми же тремя псевдонимами. «Выбор модели эмбеддингов» и «GigaChat» не меняются.
- `llm-gateway`: требование «Обязательная конфигурация шлюза» снимается вместе со сценариями про Sber500, его место занимает «Обязательная конфигурация API и прокси» с тем же составом, где вместо `SBER500_API_BASE` и `SBER500_API_KEY` прокси требует `CLOUDRU_API_KEY`. Снятие и добавление вместо правки — потому что OpenSpec не даёт убрать сценарии из изменяемого требования.

## Scope

- Конфигурация прокси (`agno/litellm/config.yaml`), compose локальный и продовый, `example.env`.
- Документация, контекст-пак, ADR-003, мастер-спеки `integrations`, `llm-gateway`, схема в `architecture`.
- Проверка: каждый псевдоним через прокси отдаёт 1024 измерения; загрузка и поиск в `shared-knowledge` локально и на сервере; запись в `tmp/VERIFY.md`.
- Выкладка релизом: ключ в env сервера до релиза (с подтверждения владельца), удаление строк `SBER500_*` после.

## Non-goals

- GigaChat (`gigachat-embeddings`, `GIGACHAT_*`, бандл Russian Trusted CA) не меняется. Он тоже не работает (`402`), но его судьба — отдельное решение.
- Чат-модели остаются на DeepSeek, хотя каталог Cloud.ru их тоже содержит.
- Размер чанка 1200 символов, читатели и таблица знаний не меняются.
- Учёт расхода на эмбеддинги в журнале `usage-limits` не добавляется: базой знаний пользуется только администратор.
- Миграции векторов нет: `shared_knowledge` пуста локально и на сервере (проверено 2026-11-08).
- Кода приложения на Python change не касается.

## Impact

- Конфигурация: `agno/litellm/config.yaml`, `agno/compose.yaml`, `compose.prod.yaml` (комментарий), `example.env`, `agno/evals/cases.py` (текст критерия).
- Окружение: `.env` локально, `/etc/authorled/authorled.env` на сервере — новая `CLOUDRU_API_KEY`, удаление `SBER500_*`.
- Документы: README, `AGENTS.md`, `.agents/skills/{setup,deploy}-platform/SKILL.md`, ADR-003, `03-architecture.md`, `05-security-and-compliance.md`, `openspec/TODO.md`, мастер-спеки `integrations`, `llm-gateway`, `architecture`.
- Внешние системы: Cloud.ru Foundation Models (`https://foundation-models.api.cloud.ru/v1`), оплата с баланса владельца. Шлюз Sber500 больше не используется.
