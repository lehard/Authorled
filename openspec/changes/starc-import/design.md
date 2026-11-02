# Design: импорт проектов STARC

## Context

Мотивация — `proposal.md`, требования — `specs/`. После `story-data-backend` разборщики живут в `agno/core/importers/` и выдают абзацы (`Paragraph`) для общего сборщика `screenplay.py`; загрузка (`core/files.py`) знает форматы по таблице `FORMATS`/`ALLOWED`, импорт (`core/imports.py`) — по `parse_manuscript`. Формат `.starc` описан в `openspec/context/_raw/research/Разбор STARC для интеграции/Отчёт.md` («Файл .starc»): одна база SQLite, таблица `documents` (`uuid`, `type`, `content`), дерево проекта — XML документа типа 1 (Structure), сценарий 10100 с текстом 10104, персонаж 30001, локация 40001; текст — XML с группами `scene`/`beat` и абзацами по типу, значение в `<v><![CDATA[…]]></v>`. Официальной спецификации нет; XML персонажей и локаций не сверен.

## Goals / Non-Goals

**Goals:** читать `.starc` без изменения файла и без кода STARC (ADR-005: только наблюдаемый формат); отказывать целиком при любом расхождении.

**Non-Goals:** драфты, комментарии, правки рецензирования, история изменений (`documents_changes`), запись `.starc`.

## Decisions

1. **Чтение копии только на чтение.** Байты пишутся во временный файл, `sqlite3.connect("file:…?mode=ro&immutable=1", uri=True)`; после разбора файл удаляется. Альтернатива — `sqlite3.deserialize` в памяти: удобнее, но зависит от сборки SQLite; временный файл проще и одинаков везде.
2. **Структура.** Документ типа 1 разбирается `xml.etree`; ровно один `item` сценария (10100) с дочерним текстом (10104), иначе `Invalid`. Персонажи и локации — `item` 30001 и 40001: имя из атрибута `name`; роль — из XML профиля, если её тег подтвердится на образце, иначе «эпизодическая» и это записывается в `tmp/VERIFY.md`.
3. **Текст.** Таблица тегов STARC → типы редактора (`scene_heading`→`sceneHeading`, `scene_characters`→`sceneCharacters`, `action`, `character`, `parenthetical`, `dialogue`, `lyrics`, `shot`, `transition`, `unformatted_text`→`unformatted`, `inline_note`→`inlineNote`, `beat_heading`→`beat`, группы `sequence`/`act`); точный список сверяется с образцом. Параметры группы `scene` (`title`, `story_day`, `color`, `tags`) → `alt`, `day`, `color`, `tags` заголовка; цвет STARC переводится в ближайшую из четырёх меток редактора по таблице, иначе пусто. Неизвестный тег — `Invalid` с его именем.
4. **Подключение.** `.starc` добавляется в `FORMATS` (`application/x-starc`, сигнатура `SQLite format 3\0`) и в `ALLOWED` для `chat` и `import`; извлечение текста и `parse_manuscript` вызывают `parse_starc`.

## Risks / Trade-offs

- [Формат STARC меняется между версиями] → тесты на образце 0.8.x и на испорченных копиях; файл новой версии с другой структурой отклоняется целиком.
- [Теги профилей не сверены] → берём только имя и роль; поля профиля из STARC не переносим в этом change.
