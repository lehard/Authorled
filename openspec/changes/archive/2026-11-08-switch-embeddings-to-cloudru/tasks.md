# Tasks

## 1. Конфигурация прокси, окружение и инструкции по запуску

- [x] 1.1 В `agno/litellm/config.yaml` перевести `giga-embeddings`, `bge-m3-embeddings`, `qwen3-embeddings` на Cloud.ru: `model: openai/ai-sage/Giga-Embeddings-instruct-480M`, `openai/BAAI/bge-m3`, `openai/Qwen/Qwen3-Embedding-0.6B`; `api_base: https://foundation-models.api.cloud.ru/v1`; `api_key: os.environ/CLOUDRU_API_KEY`; `drop_params: true` оставить; комментарий блока переписать (Cloud.ru, 1024 измерения, `dimensions` отклоняется). `gigachat-embeddings` и DeepSeek не трогать. Проверка: `python3 -c "import yaml; yaml.safe_load(open('agno/litellm/config.yaml'))"` без ошибки, `grep -n SBER500 agno/litellm/config.yaml` пусто.
- [x] 1.2 В `agno/compose.yaml` у прокси заменить `SBER500_API_BASE` и `SBER500_API_KEY` на `CLOUDRU_API_KEY: ${CLOUDRU_API_KEY:?CLOUDRU_API_KEY must be set in .env}`. Проверка: `docker compose config -q` проходит с `CLOUDRU_API_KEY` в `.env` и падает с сообщением, называющим `CLOUDRU_API_KEY`, если строку временно закомментировать.
- [x] 1.3 В `example.env` заменить блок Sber500 на `CLOUDRU_API_KEY=***` с комментарием (Cloud.ru Foundation Models, ключ сервисного аккаунта, только для прокси; псевдонимы `giga-embeddings`, `bge-m3-embeddings`, `qwen3-embeddings`); в комментарии `EMBEDDINGS_MODEL` ничего не менять, кроме упоминания провайдера. В `compose.prod.yaml` в комментарии про заглушки `***` заменить `SBER500_API_KEY` на `CLOUDRU_API_KEY`. Проверка: `grep -n "SBER500\|CLOUDRU" example.env compose.prod.yaml` — только `CLOUDRU`.
- [x] 1.4 В локальном `.env` удалить строки `SBER500_API_BASE` и `SBER500_API_KEY` (`CLOUDRU_API_KEY` уже есть), не печатая значений. Проверка: `grep -c '^CLOUDRU_API_KEY=' .env` = 1, `grep -c '^SBER500' .env` = 0.
- [x] 1.5 Обновить инструкции запуска и выкладки: `README.md` (требования, обязательные переменные, таблица псевдонимов, абзац про TLS, таблица env), `AGENTS.md` (Required block), `.agents/skills/setup-platform/SKILL.md`, `.agents/skills/deploy-platform/SKILL.md`, критерий в `agno/evals/cases.py`; `openspec/TODO.md` (предупреждение про ключи compose). Проверка: `grep -rn "SBER500\|Sber500\|shared1.multitool" README.md AGENTS.md .agents agno/evals openspec/TODO.md` пусто.

## 2. Контекст, ADR и мастер-спеки вне дельт

- [x] 2.1 ADR-003: добавить «Amendment 2026-11-08: эмбеддинги через Cloud.ru Foundation Models» (причина — бюджет шлюза исчерпан; те же псевдонимы на Cloud.ru; `CLOUDRU_API_KEY`; адрес в конфигурации прокси; Sber500 удалён; принятые риски — баланс владельца, цена Giga-Embeddings не опубликована) и пометить дополнение 2026-10-29 как заменённое в части шлюза. Проверка: `grep -n "Amendment 2026-11-08" openspec/context/ADR/ADR-003-deepseek-litellm-gigachat.md`.
- [x] 2.2 Обновить `openspec/context/03-architecture.md` (две строки про эмбеддинги) и `openspec/context/05-security-and-compliance.md` (пункт «Эмбеддинги»: Cloud.ru — российский провайдер, риски шлюза Sber500 сняты, `bge-m3` и `qwen3` — зарубежные разработки, запущенные в Cloud.ru; согласование с ИБ не получено); в `openspec/specs/architecture/spec.md` в схеме заменить узел `Sber500` на `Cloud.ru Foundation Models (эмбеддинги)`. Проверка: `grep -rn "Sber500" openspec --include=*.md --exclude-dir=changes --exclude-dir=_raw` находит только историю в ADR-003.

## 3. Проверка на локальном стеке

- [x] 3.1 `docker compose up -d --build`. Проверка: прокси `litellm` в статусе `healthy`, API стартует, в логах прокси нет ошибок TLS и ключей.
- [x] 3.2 Для каждого из `giga-embeddings`, `bge-m3-embeddings`, `qwen3-embeddings` вызвать `POST /v1/embeddings` на прокси с `dimensions=1024` (как отправляет `OpenAIEmbedder`). Ожидаемо: 1024 числа, имя модели со слешем дошло до Cloud.ru без искажения. При ошибке имени модели или `UnsupportedParamsError` остановиться и вынести решение владельцу.
- [x] 3.3 Негативная проверка ключа: временно задать прокси неверный `CLOUDRU_API_KEY`, загрузить документ в `shared-knowledge`. Проверка: статус контента `failed`, в ответе прокси ошибка Cloud.ru, перехода на другой псевдоним нет; затем вернуть рабочий ключ.
- [x] 3.4 С `EMBEDDINGS_MODEL=giga-embeddings` загрузить тестовый документ в `shared-knowledge` с `reader_id` (например, `markdown`) и найти его фрагмент поиском. Проверка: статус `completed`, векторы по 1024, поиск возвращает фрагмент. Удалить тестовый контент.
- [x] 3.5 `openspec validate switch-embeddings-to-cloudru --strict`, `./scripts/validate.sh`, `git diff --check`; записать результаты 3.1–3.4 в `tmp/VERIFY.md` (раздельно static / container). Проверка: всё без ошибок, запись есть.

## 4. Выкладка на сервер

- [x] 4.1 С подтверждения владельца в чате добавить `CLOUDRU_API_KEY` в `/etc/authorled/authorled.env` на `authorled` (ключ не печатать; `SBER500_*` пока оставить для отката). Проверка: `grep -c '^CLOUDRU_API_KEY=' /etc/authorled/authorled.env` = 1 и запрос эмбеддинга к Cloud.ru с сервера этим ключом отдаёт 1024 измерения.
- [x] 4.2 После релиза из `main` (README, «Deploy by release»; релиз запускает владелец) проверить на сервере: прокси `healthy`, эмбеддинг через прокси псевдонимом `giga-embeddings` — 1024 числа, загрузка и поиск в `shared-knowledge` работают, тестовый контент удалён. Записать в `tmp/VERIFY.md` (hosted).
- [x] 4.3 С подтверждения владельца удалить `SBER500_API_BASE` и `SBER500_API_KEY` из `/etc/authorled/authorled.env`. Проверка: `grep -c '^SBER500' /etc/authorled/authorled.env` = 0, `docker compose config -q` на сервере проходит.

## Workflow follow-up

- Владелец ставит бюджет и уведомление о расходе в «Контроле затрат» Cloud.ru.
- Архивировать change после проверки на сервере (`/opsx:archive`); дельты `integrations` и `llm-gateway` переносятся в мастер-спеки.
- Обновить статус в `business-intents/embeddings-cloudru.md`.
