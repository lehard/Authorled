# Design: DeepSeek через LiteLLM-прокси, GigaChat-эмбеддинги

## Context

Мотивация — `proposal.md`. Текущее состояние (до черновика): `app/settings.py` возвращает `Claude(...)` напрямую, `db/__init__.py` создаёт `OpenAIEmbedder(id="text-embedding-3-small")`, `agents/engineers.py` хардкодит `claude-opus-5-5` и `gpt-6.1-sol`. Ограничения: пин Agno `3.1.10`, не писать compatibility-адаптеры и не обходить отказы фреймворка; одна инстанция API; без fallback; секреты только в env.

Факты, проверенные по исходникам (Agno 3.1.10, LiteLLM v1.104.2, документация DeepSeek на 2026-10-24):
- В Agno есть `agno.models.deepseek.DeepSeek` (OpenAI-совместимый, настраиваемые `base_url`/`api_key`, флаг `use_thinking`), `agno.models.litellm.LiteLLM` / `LiteLLMOpenAI`; LiteLLM-эмбеддера в Agno нет.
- DeepSeek: модели `deepseek-flash` и `deepseek-v4-pro`; размышления включаются `thinking: {type: enabled|disabled}` (по умолчанию включены). Если в запросе есть инструменты, а прошлые `reasoning_content` не вернули, DeepSeek отвечает `400`. Эмбеддингов в официальном API нет.
- Из обёрток Agno только `DeepSeek` кладёт `reasoning_content` обратно в сообщения ассистента; `OpenAILike`/`LiteLLMOpenAI` этого не делают.
- LiteLLM v1.104.2: провайдер `gigachat/` с эмбеддингами `Embeddings`, `Embeddings-2` (512 токенов, 1024 изм.), `EmbeddingsGigaR` (4096 токенов, 2560 изм.); учётные данные `GIGACHAT_CREDENTIALS`, scope `GIGACHAT_SCOPE`. OAuth-запрос токена в `litellm/llms/gigachat/authenticator.py` выполняется с жёстко зашитым `ssl_verify=False`. Эмбеддинг-провайдер не принимает OpenAI-параметров (`dimensions` и т.п.).
- `OpenAIEmbedder` при заданном `base_url` всегда отправляет `dimensions`.
- `ClaudeAgent` принимает `options=ClaudeAgentOptions(env=...)`; в sandbox Agno по умолчанию пробрасывает с хоста только `ANTHROPIC_API_KEY`/`CLAUDE_CODE_OAUTH_TOKEN` (`agno/sandbox/_harness.py`).
- Читатели знаний по умолчанию режут текст на куски по 5000 символов; `Knowledge(readers=...)` позволяет задать свои экземпляры читателей с выбранной стратегией разбиения.
- pgvector строит HNSW по `vector` только до 2000 измерений.

## Goals / Non-Goals

**Goals:**
- Ни одного прямого вызова провайдера моделей из приложения и Claude Code; все модели — псевдонимы прокси, заданные в одном месте.
- Режим размышлений DeepSeek работает с инструментами (OS Manager, Company Manager).
- Эмбеддинги не уходят за рубеж и помещаются в лимит входа модели.
- Явный отказ при любой отсутствующей переменной (API и прокси).

**Non-Goals:**
- Маршрутизация, бюджеты, кэш и логирование в LiteLLM сверх минимума для работы.
- Свой эмбеддер, свои readers сверх параметров разбиения, патчи LiteLLM.

## Decisions

### D1. LiteLLM как отдельный прокси, а не SDK внутри API
Прокси в compose (`litellm` service, `litellm/config.yaml`), приложение ходит к нему по HTTP.
- *Почему*: один шлюз для трёх клиентов — агенты Agno (OpenAI-формат), Claude Code (Anthropic Messages `/v1/messages`) и эмбеддинги (`/v1/embeddings`); OAuth и сертификаты GigaChat живут в прокси; в приложении не нужен свой класс эмбеддера.
- *Альтернатива*: Agno `LiteLLM` (SDK в процессе) — нет пути для Claude Code и нет эмбеддера, пришлось бы писать свой класс. Отвергнуто владельцем.

### D2. Класс модели — `DeepSeek` с `base_url` прокси, а не `LiteLLMOpenAI`
`default_model()` → `DeepSeek(id="deepseek-fast", use_thinking=False)`, `manager_model()` → `DeepSeek(id="deepseek-thinking", use_thinking=True)`, оба с `base_url=f"{LITELLM_URL}/v1"` и `api_key=LITELLM_API_KEY`.
- *Почему*: только `DeepSeek` возвращает `reasoning_content` вместе с вызовами инструментов; с `LiteLLMOpenAI` думающая модель с инструментами получит `400`.
- *Альтернатива*: `LiteLLMOpenAI` — проще по смыслу («LiteLLM»), но ломает размышления с инструментами. Своя обёртка — запрещена (адаптер).
- *Условие*: прокси должен передавать `thinking` из `extra_body` и `reasoning_content` во входных сообщениях провайдеру `deepseek/`. Проверяется вживую (task 6.3); если не передаёт — задать `thinking` в `litellm_params` псевдонима и вернуться к вопросу о `reasoning_content` с владельцем, без тихих обходов.

### D3. Псевдонимы прокси
| Псевдоним | Модель провайдера | Режим |
|---|---|---|
| `deepseek-fast` | `deepseek/deepseek-flash` | без размышлений |
| `deepseek-thinking` | `deepseek/deepseek-v4-pro` | с размышлениями |
| `gigachat-embeddings` | `gigachat/Embeddings-2` | 1024 изм. |
Имена моделей провайдера меняются только в `litellm/config.yaml`; приложение знает только псевдонимы (`app/settings.py`).
- *Альтернатива*: обе роли на `deepseek-flash` с разным `thinking` — дешевле; принято `deepseek-v4-pro` для менеджеров, так как они планируют и делегируют. Пересматривается по стоимости после живой проверки без изменения кода приложения.

### D4. Эмбеддинги — `OpenAIEmbedder` на прокси, `Embeddings-2`
`OpenAIEmbedder(id="gigachat-embeddings", dimensions=1024, base_url=..., api_key=...)`. Поскольку эмбеддер всегда шлёт `dimensions`, а провайдер GigaChat его не принимает, у псевдонима в прокси включается `drop_params: true` — только у этого псевдонима, не глобально. Это не маскирует ошибку: размерность ответа фиксирована моделью и совпадает с объявленной 1024; несовпадение размерности приведёт к ошибке записи в pgvector.
- *Альтернатива*: `EmbeddingsGigaR` — больше контекст, но 2560 измерений не помещаются в HNSW; отвергнуто владельцем.

### D5. Разбиение под лимит 512 токенов
`create_knowledge` передаёт `Knowledge(readers=...)` с ключами `ReaderFactory`: `pdf`, `docx`, `markdown`, `text`, `website` — куски до 1200 символов (≈300–400 токенов русского текста, с запасом), стратегии разбиения — родные для читателя; `csv`, `excel` — построчное разбиение Agno без изменений.
- *Ограничение Agno 3.1.10 (проверено по исходникам)*: `Knowledge.readers` используется для URL (`website_reader`, `pdf_reader` и т.д.) и для загрузок с `reader_id`. Загрузка файла без `reader_id` (`POST /knowledge/content`, путь `path`) выбирает читатель через `ReaderFactory.get_reader_for_extension` с куском 5000 символов. Решение владельца (2026-10-26): не обходить фреймворк; документация требует передавать `reader_id` (или `chunker`/`chunk_size`) при загрузке файлов.
- *Альтернатива*: оставить 5000 символов — куски превысят лимит, загрузка будет падать или обрезаться. Своя стратегия разбиения или подмена `ReaderFactory` — лишняя абстракция и обход фреймворка. `EmbeddingsGigaR` — см. D4.

### D6. Claude Code на DeepSeek через Anthropic-endpoint прокси
`ClaudeAgent(model="deepseek-thinking", options=ClaudeAgentOptions(env={ANTHROPIC_BASE_URL: LITELLM_URL, ANTHROPIC_API_KEY: LITELLM_API_KEY, ANTHROPIC_DEFAULT_{OPUS,SONNET}_MODEL: deepseek-thinking, ANTHROPIC_DEFAULT_HAIKU_MODEL: deepseek-fast, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1"}))`. Значения `env` перекрывают унаследованные `ANTHROPIC_*`, поэтому Claude Code не обращается к Anthropic даже при заданном на хосте ключе.
- *Альтернатива*: Anthropic-совместимый endpoint самого DeepSeek — минует LiteLLM (нарушает п.16). Снять инженера — отвергнуто владельцем.
- *Sandbox*: при включении sandbox `ANTHROPIC_BASE_URL` должен указывать на адрес прокси, доступный из sandbox; это фиксируется в `docs/sandboxes.md`, сам sandbox здесь не включается.

### D7. `codex-engineer` снимается
Убирается из `agents/engineers.py` и `app/config.yaml`; экстра `codex` из `pyproject.toml` и перегенерация `requirements.txt`. Эксплуатации не было (владелец, 2026-10-26), поэтому сохранённые ссылки не мигрируются: локальная БД пересоздаётся.

### D8. TLS к GigaChat
Запросы эмбеддингов идут с проверкой сертификата по цепочке «Russian Trusted Root CA», смонтированной в контейнер прокси (`SSL_CERT_FILE` на объединённый бандл). Без файла сертификата прокси не стартует (явная ошибка). Бандл (certifi + Russian Trusted Root CA и Sub CA) собирает `scripts/build_ca_bundle.sh` и он коммитится: сертификаты публичные. OAuth-запрос токена в LiteLLM v1.104.2 всё равно идёт без проверки — см. риски.
- *Альтернатива*: `ssl_verify: false` для всего провайдера — как в документации LiteLLM; отвергнуто как ослабление TLS.

### D9. Обязательные переменные
API: `LITELLM_URL`, `LITELLM_API_KEY` (через `app/settings.py`, отказ при отсутствии). Прокси: `LITELLM_MASTER_KEY`, `DEEPSEEK_API_KEY`, `GIGACHAT_CREDENTIALS`, `GIGACHAT_SCOPE` — в compose через `${VAR:?...}`. В dev API получает `LITELLM_URL=http://litellm:4000`.

### D10. ADR-003
Решение фиксируется в `openspec/context/ADR/ADR-003-deepseek-litellm-gigachat.md`; `03-architecture.md`, `05-security-and-compliance.md`, `07-anti-patterns.md` приводятся к нему (снимаются пометки «расхождение с кодом» и TODO про провайдера эмбеддингов).

## Risks / Trade-offs

- [LiteLLM v1.104.2 получает OAuth-токен GigaChat без проверки TLS] → учётные данные GigaChat уязвимы к MITM на пути до `ngw.devices.sberbank.ru`. Митигация: прокси в изолированной сети, исходящий трафик только к нужным хостам; issue в LiteLLM; пересмотр при обновлении образа. Риск принимает владелец — вынести в ADR-003 как принятый.
- [Прокси не передаёт `thinking` или `reasoning_content` DeepSeek] → `400` у OS Manager на вызовах инструментов. Митигация: живая проверка (6.3) до слияния; при провале — стоп и решение владельца.
- [Claude Code с DeepSeek через перевод форматов в LiteLLM] → возможны несовместимости (размышления, вызовы инструментов, кэш промптов). Митигация: живой прогон инженера на чтение и на правку файла (6.5).
- [Смена размерности эмбеддингов] → старый индекс несовместим. Митигация: пересоздать таблицу `shared_knowledge`, загрузить документы заново; до пересборки поиск по знаниям недоступен.
- [Удаление `codex-engineer` при сохранённых ссылках] → сломанные расписания/задачи. Митигация: проверка БД до удаления (D7).
- [Новая точка отказа — прокси] → при недоступности прокси все модели недоступны, отката нет (без fallback). Митигация: healthcheck и `depends_on: service_healthy`.
- [DeepSeek — зарубежный LLM] → контекст разрешает, но ПДн во внешние LLM — открытый вопрос ИБ. Без изменений относительно прежних провайдеров.
- [Длина куска 1200 символов] → больше кусков и запросов к GigaChat, ниже связность контекста. Приемлемо для операторских документов.
- [Загрузка файла без `reader_id`] → куски до 5000 символов превышают лимит `Embeddings-2`; GigaChat отклонит или обрежет вход (проверить в 6.4). Митигация: README и скиллы требуют `reader_id`; одно предложение длиннее 1200 символов тоже даёт кусок больше лимита.
- [Публичные корневые сертификаты в репозитории] → бандл устаревает вместе с `certifi`; пересобирается `scripts/build_ca_bundle.sh` (D8).

## Migration Plan

1. Получить ключи DeepSeek и GigaChat, бандл сертификатов; заполнить `.env` (без коммита).
2. Собрать бандл сертификатов `scripts/build_ca_bundle.sh`.
3. Пересоздать локальную БД (`docker compose down -v`), поднять прокси и API; загрузить документы с `reader_id`.
4. Живые проверки (tasks 6.x), запись в `tmp/VERIFY.md`.
5. В проде — тот же порядок; удалить из `.env` `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`.

Откат: вернуть коммит перехода и прежние ключи; индекс знаний пересобрать заново (размерность 1536).

## Open Questions

- Стоимость `deepseek-v4-pro` против `deepseek-flash` с размышлениями для менеджеров — решается по живым данным, меняется только `litellm/config.yaml`.
