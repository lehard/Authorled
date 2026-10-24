# Tasks

Отмеченные `[x]` пункты — черновик, уже написанный в рабочем дереве (не закоммичен, вживую не проверен). Проверка — в группе 6.

## 1. Предусловия

- [ ] 1.1 Получить у владельца `DEEPSEEK_API_KEY`, `GIGACHAT_CREDENTIALS` и scope (`GIGACHAT_API_PERS` или `GIGACHAT_API_B2B`); внести в `.env`, не печатая и не коммитя. Проверка: `grep -c` по именам ключей в `.env` (без вывода значений).
- [ ] 1.2 Положить бандл Russian Trusted Root CA (+ промежуточный Sub CA) в `litellm/certs/` и добавить каталог в `.gitignore` только если владелец решит не коммитить публичные сертификаты. Проверка: `openssl x509 -noout -subject` по файлу.
- [ ] 1.3 Проверить сохранённое состояние локальной и прод-БД на ссылки на `codex-engineer` (расписания, задачи и Routines Company, компоненты Studio); список вынести владельцу и мигрировать по его решению. Проверка: SQL/HTTP-выборки пустые после миграции, результат в `tmp/VERIFY.md`.

## 2. Код приложения

- [x] 2.1 `app/settings.py`: псевдонимы `deepseek-fast`, `deepseek-thinking`, `gigachat-embeddings`; `default_model()`/`manager_model()` как `DeepSeek` с `base_url` прокси и `use_thinking`; `embedder()`; обязательные `LITELLM_URL`, `LITELLM_API_KEY` с явной ошибкой.
- [x] 2.2 `db/__init__.py`: `create_knowledge` использует `embedder()` из `app/settings.py`.
- [x] 2.3 `app/registry.py`: в палитре Studio обе модели — `default_model()` и `manager_model()`.
- [x] 2.4 `agents/engineers.py`: `claude-engineer` на `deepseek-thinking` с `ClaudeAgentOptions(env=...)` (адрес и ключ прокси, псевдонимы по умолчанию, выключенный необязательный трафик); `codex-engineer` удалён.
- [x] 2.5 `app/config.yaml`: блок `codex-engineer` удалён, описание `claude-engineer` обновлено.
- [ ] 2.6 `db/__init__.py`: передать `Knowledge(readers=...)` с читателями для установленных форматов (pdf, docx, csv, excel, text/markdown, website) и разбиением ~1200 символов; ключи читателей сверить с `ReaderFactory` Agno 3.1.10. Проверка: загрузка PDF > 512 токенов даёт статус `completed` (6.4).
- [ ] 2.7 `pyproject.toml`: убрать экстра `codex`; `./scripts/generate_requirements.sh`; пересобрать обе цели Dockerfile. Проверка: `docker build --target agentos` и `--target sandbox` проходят, `grep codex requirements.txt` пуст.
- [ ] 2.8 `./scripts/validate.sh` и `git diff --check` проходят (ruff, mypy — в т.ч. импорт `claude_agent_sdk.ClaudeAgentOptions`).

## 3. LiteLLM-прокси

- [ ] 3.1 `litellm/config.yaml`: псевдонимы `deepseek-fast` (`deepseek/deepseek-flash`, `thinking: disabled`), `deepseek-thinking` (`deepseek/deepseek-v4-pro`), `gigachat-embeddings` (`gigachat/Embeddings-2`, `drop_params: true` только у него); ключи через `os.environ/...`; `master_key` из `LITELLM_MASTER_KEY`. Проверка: `docker compose config` без ошибок.
- [ ] 3.2 `compose.yaml`: сервис `litellm` из `ghcr.io/berriai/litellm:v1.104.2`, порт только `127.0.0.1:4000`, монтирование конфига и сертификатов, `SSL_CERT_FILE` на бандл, обязательные переменные через `${VAR:?...}`, healthcheck; у API `LITELLM_URL=http://litellm:4000`, `LITELLM_API_KEY`, `depends_on: service_healthy`. Проверка: без `DEEPSEEK_API_KEY` `docker compose up` падает с сообщением, называющим переменную.
- [ ] 3.3 `compose.prod.yaml`: те же обязательные переменные, без публикации порта прокси наружу. Проверка: `docker compose -f compose.yaml -f compose.prod.yaml config`.
- [ ] 3.4 Без файла сертификата прокси не стартует (сценарий «Сертификат не найден»). Проверка: временно переименовать файл и запустить.

## 4. Документация и evals

- [ ] 4.1 `README.md` (строки 58, 139–147, 188–190, 279–285): ключи — только `DEEPSEEK_API_KEY`, GigaChat и ключи прокси; убрать Codex Engineer и `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`; таблица переменных.
- [ ] 4.2 `example.env`: блок Required — `LITELLM_MASTER_KEY`, `LITELLM_API_KEY`, `DEEPSEEK_API_KEY`, `GIGACHAT_CREDENTIALS`, `GIGACHAT_SCOPE`; комментарий у каждого — кто использует; удалить `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, Codex.
- [ ] 4.3 `AGENTS.md` (строки 46, 56 и раздел «Engineers and sandboxes»), `docs/sandboxes.md:9`, `.agents/skills/setup-platform/SKILL.md:39`, `.agents/skills/deploy-platform/SKILL.md`, `.agents/skills/eval-and-improve/SKILL.md:39`: один инженер на DeepSeek через прокси; переменные sandbox (`ANTHROPIC_BASE_URL` на адрес прокси, доступный из sandbox).
- [ ] 4.4 `evals/cases.py`: критерий `manager_explains_application` — `.env` и `DEEPSEEK_API_KEY`/ключи прокси вместо `OPENAI_API_KEY`. Проверка: `python -m evals --list`.
- [ ] 4.5 `compose.prod.yaml` (комментарий про `sk-***` плейсхолдеры) — актуальные имена ключей.

## 5. Контекст-пак

- [ ] 5.1 `openspec/context/ADR/ADR-003-deepseek-litellm-gigachat.md` по шаблону ADR-000: решение, альтернативы (Claude напрямую, LiteLLM SDK, EmbeddingsGigaR, Codex), принятый риск OAuth без TLS-проверки в LiteLLM, отступление от шаблона по инженерам. Закрывает TODO «ADR на переход моделей по умолчанию на Claude».
- [ ] 5.2 `03-architecture.md`: убрать пометку «Расхождение с кодом» и TODO про эмбеддинги, сослаться на ADR-003; `05-security-and-compliance.md`: внешние LLM — DeepSeek, эмбеддинги — GigaChat, снять TODO провайдера; `07-anti-patterns.md`: убрать строки «На чём спотыкаются» про `OPENAI_API_KEY` и хардкод моделей инженеров.
- [ ] 5.3 `openspec/specs/overview/spec.md` (описание моделей в преамбуле) и `openspec/specs/glossary/spec.md` (ClaudeAgent/CodexAgent, Engineer) — привести вне дельт при архиве. Проверка: `openspec validate --all`.

## 6. Живая проверка (тратит вызовы моделей)

- [ ] 6.1 `docker compose up -d --build`: прокси healthy, API стартует. `GET /info` → `agent_count: 2`; `GET /registry` → модели `deepseek-fast`, `deepseek-thinking`; `GET /config` → `available_models` без Anthropic/OpenAI; `GET /agents/codex-engineer` → 404.
- [ ] 6.2 Пересоздать таблицу `shared_knowledge` (размерность 1024) и заново загрузить операторские документы.
- [ ] 6.3 OS Manager: запрос с несколькими вызовами инструментов в режиме размышлений проходит без `400`. При `400` — стоп, решение владельца (design D2).
- [ ] 6.4 Загрузка PDF длиннее 512 токенов → `completed`, эмбеддинги 1024; поиск по знаниям возвращает фрагмент.
- [ ] 6.5 `claude-engineer`: задача на чтение и задача на правку файла в репозитории; в логах прокси запросы идут на `deepseek-thinking`, к Anthropic обращений нет.
- [ ] 6.6 `./scripts/mcp_check.sh` и `python -m evals --tag smoke`; ответы и причины судьи прочитать.
- [ ] 6.7 Записать результаты в `tmp/VERIFY.md` раздельно: static, deterministic, model, container; что не проверено (sandbox, прод).
