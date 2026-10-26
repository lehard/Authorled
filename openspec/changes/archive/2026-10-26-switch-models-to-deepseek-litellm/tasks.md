# Tasks

Отмеченные `[x]` пункты сделаны и проверены статически (ruff, mypy, `docker compose config`); вживую не проверены — группа 6. Пометка «частично» объясняет, чего не хватает до `[x]`. Незакрытые задачи, ждущие ключей, перенесены в `openspec/TODO.md` (решение владельца 2026-10-26).

## 1. Предусловия

- Перенесено в `openspec/TODO.md` (раздел «Живая проверка DeepSeek/LiteLLM/GigaChat»): 1.1 — ключи владельца.
- [x] 1.2 Собрать `litellm/certs/ca-bundle.pem` скриптом `scripts/build_ca_bundle.sh` (certifi + Russian Trusted Root CA и Sub CA с gu-st.ru) и закоммитить: сертификаты публичные, не секрет (решение 2026-10-26). Проверка: скрипт печатает subject обоих сертификатов с «Russian Trusted» и их SHA-256; `grep -c 'BEGIN CERTIFICATE' litellm/certs/ca-bundle.pem` больше числа в certifi на 2.
  - Собран 2026-10-26: Root CA SHA-256 `D2:6D:2D:02:31:B7:C3:9F:92:CC:73:85:12:BA:54:10:35:19:E4:40:5D:68:B5:BD:70:3E:97:88:CA:8E:CF:31`, Sub CA `BB:BD:E2:10:3E:79:0B:99:9E:C6:2B:D0:3C:F6:25:A5:A2:E7:C3:16:E1:0A:FE:6A:49:0E:ED:EA:D8:B3:FD:9B`; сверить с опубликованными отпечатками до прода.
  - Дефект найден 2026-10-26 при запуске: файл Root CA не заканчивался переводом строки, `cat` склеил `END CERTIFICATE----------BEGIN CERTIFICATE`, и бандл не читался (`ssl.SSLError: PEM lib`, прокси в перезапусках). Склейка в `litellm/certs/ca-bundle.pem` исправлена на месте; `scripts/build_ca_bundle.sh` теперь добавляет перевод строки между файлами и проверяет загрузку бандла через `ssl`. Сборку скриптом заново не запускали (нужна сеть к gu-st.ru).
- [x] 1.3 Сохранённые ссылки на `codex-engineer`: эксплуатации не было, сервис не рабочий (владелец, 2026-10-26) — миграция не нужна; локальная БД пересоздаётся в 6.2.

## 2. Код приложения

- [x] 2.1 `app/settings.py`: псевдонимы `deepseek-fast`, `deepseek-thinking`, `gigachat-embeddings`; `default_model()`/`manager_model()` как `DeepSeek` с `base_url` прокси и `use_thinking`; `embedder()`; обязательные `LITELLM_URL`, `LITELLM_API_KEY` с явной ошибкой.
- [x] 2.2 `db/__init__.py`: `create_knowledge` использует `embedder()` из `app/settings.py`.
- [x] 2.3 `app/registry.py`: в палитре Studio обе модели — `default_model()` и `manager_model()`.
- [x] 2.4 `agents/engineers.py`: `claude-engineer` на `deepseek-thinking` с `ClaudeAgentOptions(env=...)` (адрес и ключ прокси, псевдонимы по умолчанию, выключенный необязательный трафик); `codex-engineer` удалён.
- [x] 2.5 `app/config.yaml`: блок `codex-engineer` удалён, описание `claude-engineer` обновлено.
- [x] 2.6 `db/__init__.py`: передать `Knowledge(readers=...)` с читателями `pdf`, `docx`, `markdown`, `text`, `website` (куски до 1200 символов) и `csv`, `excel` (построчно); ключи сверены с `ReaderFactory` Agno 3.1.10. README требует `reader_id` или `chunker`/`chunk_size` при загрузке файла (design D5). Проверка: загрузка PDF > 512 токенов с `reader_id=pdf` даёт статус `completed` (6.4).
- [x] 2.7 `pyproject.toml`: убрать экстра `codex`; `./scripts/generate_requirements.sh`; пересобрать обе цели Dockerfile. Проверка: `docker build --target agentos` и `--target sandbox` проходят, `grep codex requirements.txt` пуст.
- [x] 2.8 `./scripts/validate.sh` и `git diff --check` проходят (ruff, mypy — в т.ч. импорт `claude_agent_sdk.ClaudeAgentOptions`).

## 3. LiteLLM-прокси

- [x] 3.1 `litellm/config.yaml`: псевдонимы `deepseek-fast` (`deepseek/deepseek-flash`, `thinking: disabled`), `deepseek-thinking` (`deepseek/deepseek-v4-pro`), `gigachat-embeddings` (`gigachat/Embeddings-2`, `drop_params: true` только у него); ключи через `os.environ/...`; `master_key` из `LITELLM_MASTER_KEY`. Проверка: `docker compose config` без ошибок.
- [x] 3.2 `compose.yaml`: сервис `litellm` из `ghcr.io/berriai/litellm:v1.104.2`, порт только `127.0.0.1:4000`, монтирование конфига и сертификатов, `SSL_CERT_FILE` на бандл, обязательные переменные через `${VAR:?...}`, healthcheck; у API `LITELLM_URL=http://litellm:4000`, `LITELLM_API_KEY`, `depends_on: service_healthy`. Проверка: без `DEEPSEEK_API_KEY` `docker compose up` падает с сообщением, называющим переменную.
- [x] 3.3 `compose.prod.yaml`: те же обязательные переменные, без публикации порта прокси наружу. Проверка: `docker compose -f compose.yaml -f compose.prod.yaml config`.
- [x] 3.4 Без файла сертификата прокси не стартует (сценарий «Сертификат не найден»). Проверка: временно переименовать файл и запустить.

## 4. Документация и evals

- [x] 4.1 `README.md` (строки 58, 139–147, 188–190, 279–285): ключи — только `DEEPSEEK_API_KEY`, GigaChat и ключи прокси; убрать Codex Engineer и `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`; таблица переменных.
- [x] 4.2 `example.env`: блок Required — `LITELLM_MASTER_KEY`, `LITELLM_API_KEY`, `DEEPSEEK_API_KEY`, `GIGACHAT_CREDENTIALS`, `GIGACHAT_SCOPE`; комментарий у каждого — кто использует; удалить `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, Codex.
  - У прокси нет своей БД ключей, поэтому `LITELLM_API_KEY` равен `LITELLM_MASTER_KEY`; так и написано в `example.env` и README.
- [x] 4.3 `AGENTS.md` (строки 46, 56 и раздел «Engineers and sandboxes»), `docs/sandboxes.md:9`, `.agents/skills/setup-platform/SKILL.md:39`, `.agents/skills/deploy-platform/SKILL.md`, `.agents/skills/eval-and-improve/SKILL.md:39`: один инженер на DeepSeek через прокси; переменные sandbox (`ANTHROPIC_BASE_URL` на адрес прокси, доступный из sandbox).
- [x] 4.4 `evals/cases.py`: критерий `manager_explains_application` — `.env` и `DEEPSEEK_API_KEY`/ключи прокси вместо `OPENAI_API_KEY`. Проверка: `python -m evals --list`.
- [x] 4.5 `compose.prod.yaml` (комментарий про `sk-***` плейсхолдеры) — актуальные имена ключей.

## 5. Контекст-пак

- [x] 5.1 `openspec/context/ADR/ADR-003-deepseek-litellm-gigachat.md` по шаблону ADR-000: решение, альтернативы (Claude напрямую, LiteLLM SDK, EmbeddingsGigaR, Codex), принятый риск OAuth без TLS-проверки в LiteLLM, отступление от шаблона по инженерам. Закрывает TODO «ADR на переход моделей по умолчанию на Claude».
- [x] 5.2 `03-architecture.md`: убрать пометку «Расхождение с кодом» и TODO про эмбеддинги, сослаться на ADR-003; `05-security-and-compliance.md`: внешние LLM — DeepSeek, эмбеддинги — GigaChat, снять TODO провайдера; `07-anti-patterns.md`: убрать строки «На чём спотыкаются» про `OPENAI_API_KEY` и хардкод моделей инженеров.
- [x] 5.3 `openspec/specs/overview/spec.md` (описание моделей в преамбуле) и `openspec/specs/glossary/spec.md` (ClaudeAgent/CodexAgent, Engineer) — привести вне дельт при архиве. Проверка: `openspec validate --all`.

## 6. Живая проверка (тратит вызовы моделей)

- [x] 6.1 `docker compose up -d --build`: прокси healthy, API стартует. `GET /info` → `agent_count: 2`; `GET /registry` → модели `deepseek-fast`, `deepseek-thinking`; `GET /config` → `available_models` без Anthropic/OpenAI; `GET /agents/codex-engineer` → 404.
  - Проверено 2026-10-26 с фиктивными ключами (вызовов моделей не было): `agent_count: 2`, реестр — `deepseek-fast`, `deepseek-thinking`; `available_models` — только `deepseek-thinking`; codex → 404; `/knowledge/config` — читатели `pdf`, `docx`, `csv`, `excel`, `markdown`, `text`, `website`; прокси `/v1/models` отдаёт три псевдонима; `mcp_check.sh` проходит. Вопрос, нужен ли `deepseek-fast` в `available_models`, — в `openspec/TODO.md`.
- Перенесено в `openspec/TODO.md` (раздел «Живая проверка DeepSeek/LiteLLM/GigaChat»): 6.2–6.7 — пересоздание БД, режим размышлений с инструментами, загрузка PDF, `claude-engineer`, smoke-евалы, запись результатов. Ждут ключей (решение владельца 2026-10-26).
