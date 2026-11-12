# Tasks

## 1. Ядро: разбор STARC с пропущенным

- [x] 1.1 `agno/core/importers/starc.py`: `Skipped(kind, name)`, `StarcProject.skipped`; в `_project` сценарии делятся по наличию документа текста в `documents` (design, решения 1–2), ноль с текстом — «В файле нет сценария.», больше одного — «несколько сценариев»; `_cast` пропускает записи без профиля и отдаёт их в `skipped` в порядке структуры; отказ «ровно один текст» для сценария с повреждённой структурой остаётся. Обновить docstring модуля. Проверка: 1.3.
- [x] 1.2 `agno/core/imports.py`: `Manuscript.skipped` (пусто для других форматов), `import_into` возвращает `Imported(text, skipped)`, `create_project_from_file` — пропущенное четвёртым элементом; поправить вызовы. Проверка: 1.3 и `./scripts/dev.sh test`.
- [x] 1.3 `agno/tests/test_starc.py`: случаи «второй сценарий без текста → пропущен, импорт «Выбор 1»», «локация без профиля → пропущена, остальные перенесены», «два сценария с текстом → несколько сценариев» (вторая запись с документом текста в `documents`), «ни у одного сценария нет текста → нет сценария», «сценарий без текста в корзине → не в `skipped`», полный образец → `skipped == []`; поправить в `test_refused_files` случаи, которые теперь пропуск, а не отказ (`DELETE ... type = 10104`, второй сценарий только в структуре). Проверка: `./scripts/dev.sh test` зелёный.

## 2. API: поле `skipped`

- [x] 2.1 `agno/app/api/schemas.py`: `SkippedOut`, `ImportedTextOut(TextOut)`, `CreatedFromFile(CreatedProject)`; `agno/app/api/stories.py`: `POST /drafts/{id}/import` отвечает `ImportedTextOut`, `POST /projects` из файла — `CreatedFromFile`, JSON-создание — прежний `CreatedProject`. Проверка: 2.2.
- [x] 2.2 `agno/tests/test_import_routes.py`: история из облачного образца и импорт его в драфт отдают `skipped` со сценарием и локацией, история из Fountain и из полного STARC — `skipped == []`. Проверка: `./scripts/dev.sh test` зелёный.

## 3. Фронтенд: предупреждение

- [x] 3.1 `web/src/data/apiProvider.ts` и `web/src/data/files.ts`: строгое чтение `skipped` для `import` и `createFromFile`; `importInto` → `{ text, skipped }`, `createFromFile` → `{ id, draftId, skipped }`. Проверка: `npm run build --prefix web` без ошибок типов.
- [x] 3.2 `web/src/screens/project/docs/ImportSkipped.tsx`: блок предупреждения по design (решение 5): группы по видам, причина, «Закрыть», `role="status"`, только семантические токены, высота до половины окна с прокруткой. Проверка: `./web/scripts/check_web_tokens.sh`.
- [x] 3.3 `TextDoc.tsx`: показ после импорта в редакторе; чтение `importSkipped` из состояния адреса при первом показе и замена записи истории без состояния. `storyActions.ts` и `ShelfScreen.tsx`: `createStory` возвращает `skipped`, переход на `/p/:id/d/:draftId/text` с `state`. Проверка: 3.4.
- [x] 3.4 Проверка в браузере на локальном стенде: история из `~/Downloads/Выбор. Драфт 3. Облако [1899].starc` открывается на тексте «Выбор 1» с предупреждением (9 сценариев, 1 локация); «Закрыть» убирает его; перезагрузка без предупреждения; импорт того же файла в редакторе — то же предупреждение; импорт DOCX — без него. Снимок экрана и итог — в `tmp/VERIFY.md`.

## 4. Проверки

- [x] 4.1 `./scripts/validate.sh` (через `env -u BASH_ENV`) и `git diff --check` проходят.
- [x] 4.2 Спеки: `openspec validate starc-cloud-partial` проходит.

## Workflow follow-up

- Verify, archive, merge `origin/main`, проверки, PR и merge — по AGENTS.md, «OpenSpec is mandatory», шаг 4.
