# Verification: editor-line-break-parenthetical (2026-11-10)

## Static

- `./scripts/validate.sh` (venv `agno/.venv`, `env -u BASH_ENV`): exit 0, и до, и после слияния `origin/main` (PR #72). Первый прогон упал на `mypy` (переменная `note` в `core/importers/fountain.py` получала `Paragraph | None`) и на формате двух файлов `web/`; поправлено.
- `git diff --check`: чисто. Для образца `agno/tests/fixtures/import/all-types.fountain` проверка пробелов отключена в `.gitattributes`: строка из двух пробелов в нём — пустая строка Fountain.

## Deterministic

- `./scripts/dev.sh test` (база `ai_test_editor-line-break-parenthetical`): 939 passed; после слияния `origin/main` — 956 passed. Новые тесты в `agno/tests/test_import.py`: реплика и действие в несколько строк, многострочная и незакрытая пометка, перенос строки из FDX, образец FDX совпадает с образцом Fountain с переносами строк. Пример слов через перенос в `wordCount.cases.json` проверен тестом слов ядра; счётчика слов в редакторе пока нет.
- `npm run check:editor --prefix web`: Shift+Enter по типам (заголовок сцены, переход и персонаж не меняются), `whitespace: "pre"` и `preserveWhitespace: "full"` у всех 14 типов, «(» после персонажа, в конце реплики, в начале ремарки, в персонаже и действии, «)» в конце ремарки, Tab и «(» в середине реплики с одной отменой, Tab в середине действия, вид экспорта Fountain, свежие образцы экспорта.

## Browser (local, источник данных `fixtures`)

- Chrome 152 (встроенный браузер приложения), «Текст сценария» истории «Тихая вода». Первый прогон нашёл ошибку плана: без `whitespace: "pre"` ProseMirror при наборе перечитывает абзац со страницы и превращает перенос строки в пробел; design и задача 2.2 поправлены через `/opsx:update`. После этого Shift+Enter в середине и в конце реплики с набором текста оставляет реплику в несколько строк; «(», «тише», «)» в середине реплики дают реплику, ремарку и остаток реплики без двойных скобок; своя реплика в три строки вставляется с переносами, HTML в стиле Word — с пробелами вместо переносов; разметка окна печати (окно подменено iframe без `window.print`) печатает реплику в три строки.
- Safari 18.6 (safaridriver, настоящие нажатия клавиш WebDriver, редактор смонтирован на странице dev-сервера без входа): Shift+Enter в конце реплики и набор, «(», «громче», «)» в конце реплики, Enter, Tab в середине реплики — та же разметка, что в Chrome; Shift+Enter в заголовке сцены ничего не меняет.

## Hosted (v0.3.16, 2026-11-10)

- Релиз `v0.3.16` из `main` (PR #68–#73), запуск `deploy.yml` 42894870307: `validate` и `deploy` зелёные; `check_site` (главная, политики, оферта, цены, 404, пустая заявка в бету — 422) и `check_admin` прошли; `https://app.soavtor.app/os/health` — 200.
- `ssh authorled-deploy`: код в `/srv/authorled/app` — тег `v0.3.16`; `agentos-api` запущен заново, `agentos-db` и `authentik-server` healthy.
- Разбор Fountain в контейнере `agentos-api` (`core.importers.fountain.parse_fountain`, только чтение): строки «ДАРЬЯН», «Фыва», «ывафы», пометка `[[@parenthetical тихо` / `почти]]`, действие «Пывапыв» / «дальше» дают персонажа, реплику `Фыва\nывафы`, ремарку `тихо\nпочти`, действие `Пывапыв\nдальше`.
- Фронтенд `/srv/authorled/web/v0.3.16` (на него указывает `current`): в сборке есть привязка `Shift-Enter`, `` whitespace:`pre` `` и `` preserveWhitespace:`full` `` схемы абзацев, текст отказа экспорта Fountain для строки из двух пробелов.

## Limits

- В браузере на сервере не проверялось: нужен вход автора на `app.soavtor.app`.
- Настоящий диалог печати и PDF не открывались.
- Как Final Draft сам записывает мягкий перенос, не проверено: нет образца файла Final Draft.
