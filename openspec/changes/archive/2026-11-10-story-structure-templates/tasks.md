# Tasks

## 1. Каркасы в ядре

- [x] 1.1 Создать `agno/core/story_templates.py`: чтение `story_templates.toml` с кэшем на процесс и проверкой по D1 (обязательные и лишние поля, непустые строки, уникальный `id`, хотя бы один акт и одна точка). Ошибка — `StoryTemplatesError` с файлом, `id` и местом. Функции: список каркасов и `screenplay(template_id)` по D2; неизвестный `id` даёт `Invalid` со значением. Проверка: тесты в `agno/tests/test_story_templates.py` на временных файлах (акт без точек, лишнее поле, повтор `id`, пустая подсказка) называют каркас и место; `screenplay("three-acts")` проходит `texts`-проверку, число заголовков равно числу точек, `uid` разные.
- [x] 1.2 Написать `agno/core/story_templates.toml` с четырьмя каркасами из D9: `three-acts`, `hero-journey`, `fifteen-points`, `tv-episode`. Описания и подсказки — свои, по-русски, подсказка — вопрос или задание к сцене. Вычитать скиллом `chukovsky` (режим «Инфостиль»). Проверка: тест загружает файл репозитория и находит все четыре `id`; `grep -i "save the cat" agno/core/story_templates.toml` ничего не находит; владелец утверждает тексты в чате.

## 2. Маршруты историй

- [x] 2.1 В `agno/app/api/stories.py`: проверка файла каркасов при импорте модуля (D1); `template` в JSON `POST /api/v1/projects` — необязательная строка, `null` и не строка дают `422`; текст из `story_templates.screenplay` передаётся в `create_project(text=...)`; OpenAPI тела создания называет `template`. Проверка: тесты в `agno/tests/test_story_routes.py` — история с `three-acts` (акт, группа, пустой заголовок, бит в начале текста; число сцен), без `template` — один пустой заголовок, `save-the-dog` → `422` с этим значением и без новой истории, multipart с `template` → `422`, называющий поле.
- [x] 2.2 Маршрут `GET /api/v1/story-templates` (D5) с моделями `StoryTemplateOut`, `TemplateActOut`, `TemplatePointOut`, в порядке файла. Проверка: тесты — `200` с `three-acts` и его актами для вошедшего автора, `401` без токена; `./scripts/check_auth_boundary.sh` проходит без изменений `PUBLIC_ROUTES`.

## 3. Соавтор

- [x] 3.1 Инструмент `list_story_templates` в `agno/agents/coauthor_tools.py` (D8): читающий, без подтверждения, текстом каркасы с `id`, актами, точками и подсказками из `story_templates`; добавить в статический список инструментов соавтора. Проверка: тест в `agno/tests/test_coauthor_tools.py` — ответ содержит те же названия точек и подсказки, что маршрут списка; инструмент не входит в число подтверждаемых.
- [x] 3.2 `agno/skills/coauthor/SKILL.md`: правило раскладки по каркасу (D8: прочитать каркасы и сценарий, одна заметка «Раскладка: <каркас>», по каждой точке сцены с номером и заголовком или «нет сцены», сценарий не трогать, неизвестный каркас — назвать имеющиеся) и строка о выборе каркаса в «О сервисе «Соавтор»». Проверка: соавтор загружается на `./scripts/dev.sh api` (навык читается при старте); строки видны в `git diff`; поведение проверяет 3.3.
- [x] 3.3 `agno/evals/coauthor/actions.toml`: две просьбы раскладки («разложи мою историю по трём актам» в `tihaya-voda` и «по путешествию героя» в `posledniy-parom`) с `expect = "create_story_note"` и одна про несуществующий каркас с `expect = "none"`. Проверка: `test_release_set_loads` в `agno/tests/test_coauthor_actions.py` проходит; прогон трёх просьб `actions-run` на локальном стенде — без отказов и без изменений сверх заметки, результат в `tmp/VERIFY.md` как model-проверка.

## 4. Фронтенд

- [x] 4.1 `web/src/data/`: тип `StoryTemplate` (акты, точки) в модели; ресурс `story-templates` в `apiProvider.ts` (`GET /story-templates` с проверкой формы ответа, как у других ресурсов); `create("projects")` передаёт `template`, только если он задан; в `fixturesProvider.ts` список каркасов отвечает ошибкой «Недоступно с данными примера…» (D6, текст рядом с существующим для импорта). Проверка: `npm run build --prefix web` и проверки типов в `./scripts/validate.sh` проходят.
- [x] 4.2 `web/src/screens/shelf/NewStoryDialog.tsx` (D7): название, файл, выбор каркаса (Select shadcn/ui) с описанием выбранного; «Без каркаса» по умолчанию; при файле выбор недоступен и сброшен; пока грузится — недоступен; ошибка списка — причина у выбора, создание без каркаса работает. `ShelfScreen.tsx` открывает его вместо `NameDialog` для новой истории; `storyActions.createStory(title, file, template)`. Только семантические токены. Проверка: `./web/scripts/check_web_tokens.sh` проходит; в браузере на локальном стенде (`api`) история «Маяк» с «Три акта» открывается на тексте, навигатор показывает акты и группы; при выбранном файле выбор недоступен; в `fixtures` у выбора пометка, история без каркаса создаётся. Скриншоты — в отчёт.

## 5. Документы и сверка

- [x] 5.1 `business-intents/story-structure-templates.md`: статус «OpenSpec change `story-structure-templates` создан и реализуется», решение о `fixtures` (D6) вместо критерия «работает так же»; `openspec/context/_raw/research/Конкуренты/authorled.csv` и `Сводка.md`: ST-07 — «в коде», с путём к файлу каркасов. Проверка: `git diff` этих файлов.
- [x] 5.2 Общая проверка: `./scripts/validate.sh`, `git diff --check`, `./scripts/dev.sh test` (по договорённости с другими сессиями о базе `ai_test`) проходят; итоги и ограничения записаны в `tmp/VERIFY.md` раздельно (static, deterministic, model, browser).

## Workflow follow-up

- Verify (`openspec-verify-change`), archive со сводкой спек, merge `origin/main`, проверки и PR в `main` по AGENTS.md, «OpenSpec is mandatory», шаг 4.
- Релиз — только по просьбе владельца.
