## MODIFIED Requirements

### Requirement: GigaChat
Система MUST предоставлять GigaChat `Embeddings-2` (1024 измерения) как вариант эмбеддингов через псевдоним прокси `gigachat-embeddings`; он используется, когда выбран в `EMBEDDINGS_MODEL`. Учётные данные `GIGACHAT_CREDENTIALS` и `GIGACHAT_SCOPE` MUST задаваться только прокси.

#### Scenario: Эмбеддинг знаний
- GIVEN `EMBEDDINGS_MODEL=gigachat-embeddings`
- WHEN в `shared-knowledge` строится векторный индекс
- THEN эмбеддинги MUST запрашиваться у прокси псевдонимом `gigachat-embeddings` и иметь 1024 измерения

## ADDED Requirements

### Requirement: Эмбеддинги через шлюз Sber500
Система MUST предоставлять эмбеддинги шлюза Sber500 (OpenAI-совместимый API) через псевдонимы прокси `giga-embeddings` (`giga-embeddings-instruct-480m`), `bge-m3-embeddings` (`bge-m3`) и `qwen3-embeddings` (`qwen3-embedding-0.6b`); все три MUST иметь 1024 измерения. Адрес шлюза `SBER500_API_BASE` и ключ `SBER500_API_KEY` MUST задаваться только прокси. Соединение со шлюзом MUST проверять TLS-сертификат; отключение проверки MUST NOT использоваться.

#### Scenario: Эмбеддинг знаний через шлюз
- GIVEN `EMBEDDINGS_MODEL=giga-embeddings`
- WHEN в `shared-knowledge` строится векторный индекс
- THEN эмбеддинги MUST запрашиваться у прокси псевдонимом `giga-embeddings` и иметь 1024 измерения

#### Scenario: Недоступный шлюз
- GIVEN выбран псевдоним шлюза Sber500, а шлюз отвечает ошибкой или отклоняет ключ
- WHEN в `shared-knowledge` загружается контент
- THEN загрузка MUST завершиться ошибкой со статусом контента `failed`, без перехода на другой псевдоним эмбеддингов

### Requirement: Выбор модели эмбеддингов
Система MUST использовать для эмбеддингов ровно один псевдоним, заданный обязательной переменной `EMBEDDINGS_MODEL`, без значения по умолчанию. Допустимы только псевдонимы с 1024 измерениями: `gigachat-embeddings`, `giga-embeddings`, `bge-m3-embeddings`, `qwen3-embeddings`. API MUST завершаться ошибкой, называющей `EMBEDDINGS_MODEL`, если переменная не задана или содержит иное значение. Если размерность полученного вектора не равна 1024, система MUST завершить запрос ошибкой. При ошибке выбранного псевдонима система MUST NOT переходить на другой. Векторы разных моделей MUST NOT смешиваться в одной таблице знаний: смена значения требует пересоздания `shared_knowledge` и повторной загрузки документов.

#### Scenario: Переключение модели
- GIVEN `EMBEDDINGS_MODEL=giga-embeddings`, а таблица `shared_knowledge` пересоздана
- WHEN оператор меняет значение на `bge-m3-embeddings` и перезапускает API
- THEN новые эмбеддинги MUST запрашиваться псевдонимом `bge-m3-embeddings` без изменения кода

#### Scenario: Неизвестное значение
- GIVEN `EMBEDDINGS_MODEL=giga-embeddings-instruct-3b`
- WHEN запускается API
- THEN запуск MUST завершиться ошибкой, называющей `EMBEDDINGS_MODEL` и перечисляющей допустимые значения

#### Scenario: Неверная размерность
- GIVEN выбранная модель вернула вектор не из 1024 чисел
- WHEN строится эмбеддинг
- THEN запрос MUST завершиться ошибкой с указанием ожидаемой и полученной размерности
