# Spec Delta

## ADDED Requirements

### Requirement: Таблица книг библиотеки
Схема `authorled` MUST содержать таблицу `source_books`, одну строку на книгу канона: `id`, `slug` (имя файла канона без `.md`, уникальный), непустые `title`, `authors` (непустой список) и `language` (только `ru` или `en`), необязательные `original_year`, `edition_year`, `translator`, `translation_year`, `original_title`, непустой `embedding_model`, `loaded_at`. Ссылок на пользователей и истории у неё MUST NOT быть.

#### Scenario: Состав полей source_books
- GIVEN все миграции применены
- WHEN перечисляются колонки `authorled.source_books`
- THEN MUST присутствовать ровно `id`, `slug`, `title`, `authors`, `language`, `original_year`, `edition_year`, `translator`, `translation_year`, `original_title`, `embedding_model`, `loaded_at`

#### Scenario: Вторая книга с тем же slug
- GIVEN в `source_books` есть книга `impro`
- WHEN вставляется ещё одна строка со `slug` `impro`
- THEN база MUST отказать

#### Scenario: Неизвестный язык
- WHEN в `source_books` вставляется строка с `language` `de`
- THEN база MUST отказать

### Requirement: Таблица кусков библиотеки
Схема `authorled` MUST содержать таблицу `source_fragments`: `id`, `book_id` (удаляется вместе с книгой), `position` от 0 (уникальный в книге), `path` (список заголовков), непустой `content`, `embedding` (вектор 1024 измерений) и производный от `content` и языка книги текст для поиска по словам. По `embedding` MUST быть индекс для поиска ближайших по косинусному расстоянию.

#### Scenario: Куски удаляются с книгой
- GIVEN у книги есть куски
- WHEN книга удаляется из `source_books`
- THEN её кусков MUST NOT остаться

#### Scenario: Вектор другой размерности
- WHEN в `source_fragments` вставляется строка с вектором из 768 чисел
- THEN база MUST отказать

#### Scenario: Данные историй не меняются
- GIVEN в базе есть истории, заметки и пользователи
- WHEN применяется миграция библиотеки
- THEN они MUST остаться прежними, а таблицы `source_books` и `source_fragments` MUST быть пустыми
