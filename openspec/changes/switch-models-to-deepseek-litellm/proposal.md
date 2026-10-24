# Proposal: переход моделей на DeepSeek через LiteLLM, эмбеддингов — на GigaChat

## Why

Контекст-пак требует вызывать модели только через LiteLLM и запрещает зарубежные эмбеддинги (`03-architecture.md`, `05-security-and-compliance.md`, анти-паттерн 16). Код вызывает Anthropic напрямую, эмбеддинги берёт у OpenAI `text-embedding-3-small`, а инженеры хардкодят `claude-opus-5-5` и `gpt-6.1-sol`. Владелец решил (2026-10-24): система работает на DeepSeek (обычная и думающая модели), эмбеддинги — GigaChat, ключи Anthropic и OpenAI не нужны.

## What Changes

- Все вызовы чат-моделей идут через LiteLLM-прокси (новый сервис в compose). Приложение обращается к прокси по псевдонимам: `deepseek-fast` (DeepSeek без размышлений) — модель агентов по умолчанию; `deepseek-thinking` (DeepSeek в режиме размышлений) — модель OS Manager и Company Manager.
- Эмбеддинги знаний — GigaChat `Embeddings-2` (1024 измерения) через тот же прокси, псевдоним `gigachat-embeddings`. **BREAKING**: размерность меняется с 1536 на 1024, существующий векторный индекс `shared_knowledge` нужно пересобрать.
- `claude-engineer` остаётся, но Claude Code обращается к Anthropic-совместимому endpoint прокси и работает на DeepSeek. Приложение не передаёт ему ключ Anthropic.
- **BREAKING**: `codex-engineer` снимается с регистрации (без OpenAI ему не на чем работать). Сохранённые расписания и ссылки Studio на него нужно проверить до удаления.
- **BREAKING**: обязательные переменные — `LITELLM_URL` и `LITELLM_API_KEY` у API; `DEEPSEEK_API_KEY`, `GIGACHAT_CREDENTIALS` и ключ доступа к прокси — у прокси. `OPENAI_API_KEY` и `ANTHROPIC_API_KEY` больше не требуются. Если чего-то нет, запуск падает с явной ошибкой.
- Палитра Studio предлагает обе модели DeepSeek; `GET /config` и `GET /registry` согласованы (закрывает расхождение `available_models`).
- ADR-003 фиксирует выбор DeepSeek + LiteLLM-прокси + GigaChat и отступление от шаблона по инженерам. Он закрывает TODO «ADR на переход моделей по умолчанию на Claude».

## Scope

- `app/settings.py`, `db/__init__.py`, `app/registry.py`, `agents/engineers.py`, `app/config.yaml`.
- Новый `litellm/config.yaml` и сервис прокси в `compose.yaml` и `compose.prod.yaml`.
- Документация ключей и запуска: `README.md`, `AGENTS.md`, `example.env`, `docs/sandboxes.md`, `.agents/skills/setup-platform`, `.agents/skills/deploy-platform`; критерий `manager_explains_application` в `evals/cases.py`.
- Контекст-пак: `03-architecture.md`, `05-security-and-compliance.md`, `07-anti-patterns.md`, новый ADR-003.
- Мастер-спеки через дельты этого change.
- Живая проверка с ключами DeepSeek и GigaChat; запись в `tmp/VERIFY.md`.

## Non-goals

- Удаление Slack (владелец отложил).
- Свои маршруты, продуктовое ядро, Authentik, Valkey, ClamAV — отдельные changes.
- Удаление fallback-ов и выключение телеметрии: уже сделано в рабочем дереве, спеки к этому подводит отдельный change `remove-config-fallbacks`.
- Включение sandbox (Docker/AgentCore). Здесь только фиксируется, какие переменные понадобятся sandbox для инженера на прокси.
- Обновление пина Agno.
- Настройка разбиения документов под лимит GigaChat сверх необходимого для работы загрузки знаний: способ выбирается в design, без своих reader-ов, если Agno позволяет иначе.

## Capabilities

### New Capabilities
- `llm-gateway`: LiteLLM-прокси как единственный путь к чат-моделям и эмбеддингам: псевдонимы моделей, обязательные переменные, отказ без них, TLS к GigaChat.

### Modified Capabilities
- `integrations`: вместо Anthropic и OpenAI — DeepSeek и GigaChat через прокси.
- `architecture`: требование «Модели» — фабрики возвращают DeepSeek через прокси; инженеры без захардкоженных моделей.
- `overview`: состав компонентов без `codex-engineer`; описание моделей.
- `api/agents`: зарегистрированные агенты и конфигурация инженеров.
- `api/teams`: модель OS Manager.
- `api/core`: `GET /info` (число агентов), `GET /config` (`manifest`, `available_models`), `GET /registry` (агенты и модели).
- `api/knowledge`: эмбеддер `shared-knowledge` и размерность.

## Impact

- **Код**: 5 файлов приложения (черновик уже в рабочем дереве, см. tasks), новый конфиг прокси, compose.
- **Зависимости**: новый образ `ghcr.io/berriai/litellm:v1.104.2` (в нём есть провайдер GigaChat). Python-зависимости приложения не меняются: `agno.models.deepseek` и `OpenAIEmbedder` входят в текущий пин; экстра `codex` в `pyproject.toml` можно убрать.
- **Данные**: пересборка `shared_knowledge` (другая размерность), проверка сохранённых ссылок на `codex-engineer`.
- **Внешние сервисы**: DeepSeek API (зарубежный LLM — разрешён контекстом), GigaChat API (РФ). Передача ПДн в DeepSeek — тот же открытый вопрос ИБ, что и для прежних LLM.
- **Эксплуатация**: прокси — новая точка отказа, у него свой healthcheck и ключ; одна инстанция API сохраняется.
