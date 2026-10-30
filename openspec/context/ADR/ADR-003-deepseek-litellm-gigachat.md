---
owner: lehard
updated: 2026-10-26
---
# ADR-003: DeepSeek и GigaChat через LiteLLM-прокси
## Status: Accepted
## Context
Контекст требует вызывать модели только через LiteLLM и запрещает зарубежные эмбеддинги (п.16 анти-паттернов). Шаблон вызывал Anthropic напрямую, брал эмбеддинги OpenAI `text-embedding-3-small`, а инженеры хардкодили `claude-opus-5-5` и `gpt-6.1-sol`. Владелец решил (2026-10-24): система работает на DeepSeek (обычная и думающая модели), эмбеддинги — GigaChat, ключи Anthropic и OpenAI не нужны. Change `switch-models-to-deepseek-litellm`.
## Decision
- LiteLLM работает отдельным прокси (сервис `litellm` в compose, `agno/litellm/config.yaml`). Это единственный путь к моделям и для агентов Agno (OpenAI-формат), и для Claude Code (`/v1/messages`), и для эмбеддингов (`/v1/embeddings`).
- Приложение знает только псевдонимы прокси:
  - `deepseek-fast` — `deepseek-flash` без размышлений, агенты по умолчанию;
  - `deepseek-thinking` — `deepseek-v4-pro` с размышлениями, OS Manager, Company Manager и Claude Code;
  - `gigachat-embeddings` — GigaChat `Embeddings-2`, 1024 измерения.
- Класс модели — `agno.models.deepseek.DeepSeek` с `base_url` прокси. Только он возвращает `reasoning_content` вместе с вызовами инструментов; без этого DeepSeek в режиме размышлений отвечает `400`.
- Эмбеддер — `OpenAIEmbedder` на прокси. `drop_params` включён только у псевдонима эмбеддингов, потому что провайдер GigaChat не принимает `dimensions`.
- Отступление от шаблона по инженерам:
  - `claude-engineer` остаётся, но Claude Code обращается к Anthropic-endpoint прокси и работает на DeepSeek; ключ Anthropic ему не передаётся;
  - `codex-engineer` снят, потому что без OpenAI ему не на чем работать.
- TLS к GigaChat проверяется по бандлу с «Russian Trusted Root CA», смонтированному в прокси. Без бандла прокси не стартует.
- **Принятый риск.** LiteLLM v1.104.2 получает OAuth-токен GigaChat с жёстко зашитым `ssl_verify=False`, то есть учётные данные GigaChat уязвимы к MITM на пути до сервера авторизации. Риск принят владельцем. Митигация:
  - прокси в изолированной сети;
  - исходящий трафик только к нужным хостам;
  - issue в LiteLLM;
  - пересмотр при обновлении образа.
## Consequences
- Обязательные переменные:
  - у API — `LITELLM_URL` и `LITELLM_API_KEY`;
  - у прокси — `LITELLM_MASTER_KEY`, `DEEPSEEK_API_KEY`, `GIGACHAT_CREDENTIALS` и `GIGACHAT_SCOPE`.

  Без любой из них запуск падает.
- Прокси — новая точка отказа без отката: при его недоступности все модели недоступны.
- Размерность векторов меняется с 1536 на 1024. `shared_knowledge` пересоздаётся, документы загружаются заново.
- У `Embeddings-2` лимит — 512 токенов на вход, поэтому документы нужно резать мельче 5000 символов (по умолчанию в Agno).
- Имена моделей провайдеров меняются только в `agno/litellm/config.yaml`.
- Передача ПДн в DeepSeek — тот же открытый вопрос ИБ, что и для прежних зарубежных LLM.
## Alternatives considered
- **Claude и OpenAI напрямую (как в шаблоне)** — нарушает п.16; ключи Anthropic и OpenAI владелец не использует.
- **LiteLLM как SDK внутри API (`agno.models.litellm`)** — не даёт пути для Claude Code; эмбеддера LiteLLM в Agno нет, пришлось бы писать свой класс.
- **`LiteLLMOpenAI` вместо `DeepSeek`** — не возвращает `reasoning_content`, и думающая модель с инструментами получает `400`.
- **GigaChat `EmbeddingsGigaR`** — больше контекст, но 2560 измерений не помещаются в HNSW pgvector (до 2000).
- **Codex на другой модели или снятие обоих инженеров** — владелец оставил одного инженера на Claude Code.
- **`ssl_verify: false` для всего провайдера GigaChat** — ослабляет TLS сильнее необходимого.
## Review date
2027-04

## Amendment 2026-10-29: выбор модели эмбеддингов и шлюз Sber500
Change `switch-embeddings-to-sber500`. Решения выше остаются в силе; дополнения:
- GigaChat API по ключу физлица отвечает `402 Payment Required` на эмбеддинги, поэтому рядом с `gigachat-embeddings` настроен шлюз Sber500 (OpenAI-совместимый LiteLLM, `SBER500_API_BASE`, `SBER500_API_KEY`) с псевдонимами `giga-embeddings` (`giga-embeddings-instruct-480m`), `bge-m3-embeddings` (`bge-m3`), `qwen3-embeddings` (`qwen3-embedding-0.6b`). Все по 1024 измерения; `giga-embeddings-instruct-3b` (2048) не подходит под лимит HNSW.
- Активный псевдоним задаёт обязательная переменная `EMBEDDINGS_MODEL` без значения по умолчанию. Неизвестное значение останавливает API; ошибка выбранного псевдонима не приводит к переходу на другой. Размерность ответа проверяется явно.
- Смена модели требует пересоздать `shared_knowledge` и загрузить документы заново: векторы разных моделей несовместимы.
- Ключи всех настроенных провайдеров остаются обязательными в compose.
- Принятые риски шлюза: общий хост без SLA и подтверждения размещения; ключ выдан стартапу менторами Sber500. Владелец согласился 2026-10-29.
