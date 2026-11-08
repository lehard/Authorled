# Spec Delta

## MODIFIED Requirements

### Requirement: Единственный путь к моделям
Система MUST обращаться к чат-моделям и эмбеддингам только через LiteLLM-прокси по псевдонимам чат-моделей `deepseek-fast`, `deepseek-thinking`, псевдонимам экзамена маршрутизации `claude-sonnet` и `claude-opus` (спека `orchestrator`) и псевдонимам эмбеддингов `gigachat-embeddings`, `giga-embeddings`, `bge-m3-embeddings` и `qwen3-embeddings`. Код приложения и Claude Code MUST NOT обращаться к API провайдеров моделей напрямую и MUST NOT содержать имён моделей провайдеров; соответствие псевдонимов моделям провайдеров MUST задаваться только конфигурацией прокси.

#### Scenario: Смена модели провайдера
- GIVEN псевдоним `deepseek-thinking` указывает на одну модель DeepSeek
- WHEN оператор меняет модель провайдера для псевдонима в конфигурации прокси
- THEN приложение MUST использовать новую модель без изменения своего кода

#### Scenario: Claude Code не обращается к Anthropic
- GIVEN на хосте задан `ANTHROPIC_API_KEY`
- WHEN `claude-engineer` выполняет задачу
- THEN запросы Claude Code MUST уходить на прокси, а не в Anthropic API

#### Scenario: Модель Claude экзамена через прокси
- GIVEN прокси запущен с `ANTHROPIC_EXAM_API_KEY`
- WHEN экзамен отправляет запрос с вызовом инструмента к псевдониму `claude-sonnet`
- THEN прокси MUST вернуть ответ Claude Sonnet 5.5 с вызовом инструмента в формате OpenAI-совместимого API

### Requirement: Обязательная конфигурация API и прокси
API MUST требовать `LITELLM_URL`, `LITELLM_API_KEY` и `EMBEDDINGS_MODEL`; прокси MUST требовать `LITELLM_MASTER_KEY`, `DEEPSEEK_API_KEY`, `GIGACHAT_CREDENTIALS`, `GIGACHAT_SCOPE`, `CLOUDRU_API_KEY` и файл сертификатов Russian Trusted Root CA. При отсутствии любой из них соответствующий сервис MUST завершаться с ошибкой, называющей отсутствующее значение. Значения MUST NOT подставляться по умолчанию. Единственное исключение — `ANTHROPIC_EXAM_API_KEY`, ключ псевдонимов экзамена `claude-sonnet` и `claude-opus`: он необязателен (решение владельца 2026-11-08), без него прокси MUST стартовать, а запрос к этим псевдонимам MUST завершаться ошибкой авторизации.

#### Scenario: Нет адреса прокси
- GIVEN `LITELLM_URL` не задан
- WHEN запускается API
- THEN запуск MUST завершиться ошибкой `Required environment variable LITELLM_URL is not set`

#### Scenario: Нет ключа DeepSeek
- GIVEN `DEEPSEEK_API_KEY` не задан
- WHEN выполняется `docker compose up`
- THEN compose MUST отказаться запускать прокси с сообщением, называющим `DEEPSEEK_API_KEY`

#### Scenario: Нет ключа Cloud.ru
- GIVEN `CLOUDRU_API_KEY` не задан
- WHEN выполняется `docker compose up`
- THEN compose MUST отказаться запускать прокси с сообщением, называющим `CLOUDRU_API_KEY`

#### Scenario: Нет выбора модели эмбеддингов
- GIVEN `EMBEDDINGS_MODEL` не задан
- WHEN запускается API
- THEN запуск MUST завершиться ошибкой `Required environment variable EMBEDDINGS_MODEL is not set`

#### Scenario: Нет ключа Anthropic для экзамена
- GIVEN `ANTHROPIC_EXAM_API_KEY` не задан
- WHEN запускается прокси и экзамен обращается к `claude-sonnet`
- THEN прокси MUST запуститься, запросы к `deepseek-fast` MUST работать, а запрос к `claude-sonnet` MUST вернуть ошибку авторизации, которую экзамен записывает как «ошибку запуска»
