# Tasks

## 1. Конфигурация прокси и окружение

- [x] 1.1 В `litellm/config.yaml` оставить `gigachat-embeddings` без изменений и добавить `giga-embeddings` (`openai/giga-embeddings-instruct-480m`), `bge-m3-embeddings` (`openai/bge-m3`), `qwen3-embeddings` (`openai/qwen3-embedding-0.6b`) с `api_base: os.environ/SBER500_API_BASE`, `api_key: os.environ/SBER500_API_KEY` и `drop_params: true` только у них; обновить комментарии. Проверка: `python3 -c "import yaml; yaml.safe_load(open('litellm/config.yaml'))"` без ошибки.
- [x] 1.2 В `compose.yaml` добавить прокси `SBER500_API_BASE` и `SBER500_API_KEY` как `${VAR:?... must be set in .env}`, а API передать `EMBEDDINGS_MODEL` тем же способом; GigaChat и TLS-настройки не менять. Проверка: `docker compose config` проходит при всех значениях и падает с сообщением, называющим переменную, если убрать любую из трёх.
- [x] 1.3 В `example.env` добавить блок Sber500 (`SBER500_API_BASE`, `SBER500_API_KEY=***`) и `EMBEDDINGS_MODEL` с перечнем допустимых значений и пометкой, что после смены нужно пересоздать `shared_knowledge`; в `compose.prod.yaml` обновить комментарий про заглушки `***`. Проверка: `grep -n "SBER500\|EMBEDDINGS_MODEL" example.env compose.prod.yaml`.
- [x] 1.4 В локальном `.env` переименовать `CLOUDRU_API_KEY` в `SBER500_API_KEY`, добавить `SBER500_API_BASE=https://shared1.multitool.works:4000/v1` и `EMBEDDINGS_MODEL=giga-embeddings`, не печатая значений. Проверка: `grep -c` по именам даёт 1 для каждого, `CLOUDRU_API_KEY` отсутствует.

## 2. Код приложения

- [x] 2.1 В `app/settings.py` читать `EMBEDDINGS_MODEL` из окружения без значения по умолчанию, проверять по белому списку (`gigachat-embeddings`, `giga-embeddings`, `bge-m3-embeddings`, `qwen3-embeddings`) и падать ошибкой, называющей переменную и допустимые значения; размерность остаётся константой 1024; обновить docstring `embedder()`. Проверка: `EMBEDDINGS_MODEL` не задана → `Required environment variable EMBEDDINGS_MODEL is not set`; значение `giga-embeddings-instruct-3b` → ошибка со списком; `./scripts/validate.sh` проходит.
- [x] 2.2 Добавить явную проверку размерности ответа (ошибка с ожидаемой и полученной размерностью), способом, подходящим закреплённой версии Agno, без больших адаптеров. Проверка: юнит-проверка с подставным вектором неверной длины даёт ошибку; верной длины — проходит.
- [x] 2.3 В `db/__init__.py` обновить комментарий про `CHUNK_SIZE` (лимит 512 токенов относится к `gigachat-embeddings`); размер не менять. Проверка: `validate.sh`.

## 3. Проверка на живом стеке

- [x] 3.1 `docker compose up -d --build`. Проверка: `agentos-litellm` в статусе `healthy`, API стартует, в логах нет ошибок TLS.
- [x] 3.2 Для каждого из `giga-embeddings`, `bge-m3-embeddings`, `qwen3-embeddings` вызвать `POST /v1/embeddings` на прокси с `dimensions=1024` (как отправляет `OpenAIEmbedder`). Ожидаемо: ответ 1024 числа. При `UnsupportedParamsError` остановиться и вынести решение владельцу.
- [x] 3.3 Проверить `deepseek-fast` через прокси и `gigachat-embeddings` (ожидаемо `402`: ошибка провайдера доходит без подстановок), TLS-пакет остаётся на месте. Проверка: ответы получены; `402` не маскируется.
- [x] 3.4 Негативные проверки: убрать `SBER500_API_KEY`, затем `EMBEDDINGS_MODEL`; задать неверный ключ шлюза. Проверка: явные ошибки с именами переменных, без перехода на другой псевдоним.
- [x] 3.5 Пересоздать только таблицу `shared_knowledge`, загрузить тестовый PDF длиннее 512 токенов с `reader_id=pdf`, найти фрагмент поиском; затем переключить `EMBEDDINGS_MODEL`, пересоздать таблицу и повторить. Проверка: статус `completed`, размерность 1024, поиск возвращает фрагмент после обоих переключений. Записать результат в `tmp/VERIFY.md` (hosted-проверка).

## 4. Документация, ADR, спецификации

- [x] 4.1 Обновить `README.md` (требования, переменные, таблица псевдонимов, правило переключения и пересоздания `shared_knowledge`), `AGENTS.md`, `.agents/skills/setup-platform/SKILL.md`, `.agents/skills/deploy-platform/SKILL.md`, критерий в `evals/cases.py`. Проверка: `grep -rn "EMBEDDINGS_MODEL\|SBER500" README.md AGENTS.md .agents evals` находит новые места, старые утверждения про единственную модель отсутствуют.
- [x] 4.2 ADR-003: добавить «Amendment 2026-10-29» (шлюз Sber500, `EMBEDDINGS_MODEL`, ограничение переключения); обновить `03-architecture.md`, `05-security-and-compliance.md`, `openspec/TODO.md`, вводную строку «Модели» в `openspec/specs/overview/spec.md` и диаграмму в `openspec/specs/architecture/spec.md`. Проверка: `grep -rn -i "gigachat" openspec --include=*.md --exclude-dir=changes --exclude-dir=archive --exclude-dir=_raw` не находит утверждения, что GigaChat единственный.
- [x] 4.3 `openspec validate switch-embeddings-to-sber500 --strict`, `./scripts/validate.sh`, `git diff --check`. Проверка: все три без ошибок.
