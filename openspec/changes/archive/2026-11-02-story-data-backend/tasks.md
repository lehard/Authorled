# Tasks

## 1. Предусловия

- [x] 1.1 Убедиться, что change `agent-prompts-as-skills` заархивирован (`openspec list --json` его не показывает, требование «Соавтор» в `openspec/specs/api/agents/spec.md` содержит абзац про `SKILL.md`). Если нет — стоп: дельта `specs/api/agents` построена на его версии требования
- [x] 1.2 Посчитать пути и операции `GET /openapi.json` на запущенном API до изменений. Если там не 142/199 — исправить числа в дельте `specs/overview/spec.md` (ожидаемый прирост +21 путь, +30 операций) до правки кода; результат — в `tmp/VERIFY.md`

## 2. Инфраструктура: ClamAV

- [x] 2.1 Сервис `clamav` в compose бэкенда (`agno/compose.yaml`): образ `clamav/clamav` с закреплённой версией (debian-вариант), том баз, healthcheck `clamdcheck`, порт `127.0.0.1:3310` только в разработке; `agentos-api` — `depends_on: service_healthy`, `CLAMAV_HOST=clamav`, `CLAMAV_PORT=3310`. В `compose.prod.yaml` порт не публикуется. Проверка: `docker compose config` и `docker compose -f compose.yaml -f compose.prod.yaml config` показывают сервис, зависимость и порты по спеке `runtime`
- [x] 2.2 `example.env`: `CLAMAV_HOST`, `CLAMAV_PORT` в обязательном блоке с комментарием; `scripts/dev.sh`: `api` и `test` поднимают `clamav` и ждут `healthy`, передают адрес `127.0.0.1:3310` процессу на хосте. Проверка: `./scripts/dev.sh api` стартует, `nc -z 127.0.0.1 3310` успешен
- [x] 2.3 README: раздел про ClamAV (память, первая загрузка баз, переменные). Проверка: команды раздела выполняются как написано

## 3. Ядро: таблицы и миграции

- [x] 3.1 `agno/core/tables.py`: `projects`, `documents`, `screenplay_texts`, `comment_threads`, `comment_messages`, `suggestions`, `files`, `file_contents` по спеке `core/database` и решению 9 design (каскады, `RESTRICT` на `users`, CHECK на виды, роли, статусы, размер, `session_id` у `chat`, частичный уникальный индекс `script`)
- [x] 3.2 Миграции `0003_projects_documents`, `0004_screenplay_texts_review`, `0005_files`, написанные вручную под `tables.py`; downgrade — `NotImplementedError`. Проверка: `./scripts/dev.sh test` (сравнение описания с базой) и `./scripts/validate.sh` (одна голова)
- [x] 3.3 Тесты ограничений базы в `agno/tests/test_story_tables.py`: состав колонок `projects`, неизвестный формат, второй сценарий, роль у мира, решение без `decided_at`, файл чата без беседы, каскад от истории (ничего не остаётся), `RESTRICT` пользователя с историей. Проверка: `./scripts/dev.sh test`

## 4. Ядро: истории, документы, доступ

- [x] 4.1 `agno/core/errors.py`: `NotFound`, `Conflict`, `Invalid` (с полем), `PreconditionRequired`, `Locked`, `ScannerUnavailable`
- [x] 4.2 `agno/core/fields.py`: модели полей по видам (`extra="forbid"`; профиль из `web/src/data/profiles.ts`, `age`, `gender`, `overview`, поля сценария, `locked`), слияние `PATCH` и проверка результата; `Invalid` называет поле. Тест: поле чужого вида, неверный тип, частичное слияние
- [x] 4.3 `agno/core/projects.py`: список с `trash`, создание с документом `script` и пустым текстом (один заголовок сцены с `uid`), изменение, корзина, восстановление, удаление навсегда только из корзины, `owner_of(project_id)`; `ProjectAccess.can_access(principal, project_id)` по `auth_subject`. Тесты: полка и корзина, пустое название, `409` при удалении не из корзины, доступ своего, чужого и несуществующего
- [x] 4.4 `agno/core/documents.py`: дерево без текста, создание одного и пакета (всё или ничего, вид `script` — `Invalid`), чтение, `PATCH` с ревизией (`UPDATE … WHERE revision`), перестановка `position` без пропусков, корзина истории, удаление навсегда, очистка корзины; правка в истории из корзины — `Conflict`. Тесты по сценариям `api/stories` для документов
- [x] 4.5 Регистрация источника доступа в `agno/app/main.py` (`set_project_access_source(ProjectAccess())`). Проверка: тест, что `can_access_project` после импорта `app.main` не бросает `ProjectAccessNotConfigured`; `./scripts/check_auth_boundary.sh` проходит

## 5. Ядро: текст сценария и драфты

- [x] 5.1 `agno/core/texts.py`: проверка формата документа редактора (типы абзацев, `pageBreak`, метки и атрибуты, атрибуты заголовка сцены, непустой уникальный `uid`), `Invalid` с причиной; чтение и замена с ревизией; запрет правки драфта с `locked`
- [x] 5.2 Тест сверки констант типов с `web/src/editor/elements.ts` (разбор `ElementName`) и прогон текстов из `web/src/data/fixtures.ts` с добавленными `uid` через проверку ядра. Проверка: `./scripts/dev.sh test`
- [x] 5.3 Драфты: создание из текущего текста или драфта, копия без меток `comment` и `suggestion`. Тесты: драфт без пометок, запрещённый драфт — `Locked`, основа из другой истории — `NotFound`

## 6. Ядро: рецензирование

- [x] 6.1 `agno/core/review.py`: ветки (создание, повтор `id` — `Conflict`, драфт — `Conflict`), список с признаком своих сообщений, ответы, правка и удаление только своих (иначе `PermissionError` → `403`), удаление первого сообщения удаляет ветку, «решено» и возврат
- [x] 6.2 Предложения: создание с проверкой сцены и цитаты (только для инструмента соавтора), список с фильтром статуса, решение один раз (`Conflict` повторно). Тесты по сценариям `api/review` и «Предложение правки соавтором» из `api/agents`; текст и его ревизия не меняются

## 7. Ядро: файлы и ClamAV

- [x] 7.1 `agno/core/clamav.py`: клиент `INSTREAM` (куски, таймаут), чтение `CLAMAV_HOST`/`CLAMAV_PORT` с ошибкой по имени переменной; проверка переменных при старте API в `app/main.py`. Тесты на запущенном `clamav`: чистый файл, EICAR, недоступный порт — `ScannerUnavailable`; старт без `CLAMAV_HOST` — ошибка с именем
- [x] 7.2 `agno/core/files.py`: типы по расширению и сигнатуре для `chat` и `import`, пустой файл, проверка ClamAV, извлечение текста (DOCX, PDF, TXT, MD, Fountain, FDX — через импортёры группы 9), сохранение `files` + `file_contents` одной транзакцией, чтение, удаление. Тесты: PNG, PDF для импорта, PDF без текста, не UTF-8 TXT, EICAR не сохраняется, байты совпадают при чтении

## 8. Маршруты /api/v1

- [x] 8.1 `agno/app/api/body.py`: общий разбор JSON-тела и `If-Match` (`428`, число), перевод ошибок ядра в `Problem` (`NotFound`→404, `Conflict`/`Locked`→409, `Invalid`→422, `PreconditionRequired`→428, `ScannerUnavailable`→503, `PermissionError`→403); `me.py` переходит на общий разбор без изменения поведения. Проверка: `agno/tests/test_me_routes.py` проходит без правок
- [x] 8.2 `agno/app/api/projects.py` и `documents.py`: маршруты историй, дерева, документов, корзин, текста, драфтов; ресурс → `project_id` → `can_access_project` → одинаковый `404`; аккаунта нет — `404` с отсылкой к `/api/v1/me`; `ETag` у `GET`. Тесты маршрутов на `ai_test` с подменённым `current_principal` (как `test_me_routes.py`): все сценарии `api/stories`
- [x] 8.3 `agno/app/api/review.py`: маршруты комментариев и предложений (без маршрута создания предложения). Тесты: сценарии `api/review`, чужая ветка — `404`
- [x] 8.4 `agno/app/api/files.py`: multipart через `request.form()` с лимитом 20 МБ + 1 байт (`413`), `purpose`, `session_id` с префиксом истории; метаданные, содержимое с `Content-Disposition`, удаление. Тесты: сценарии `api/files`, включая `503` при остановленном `clamav`
- [x] 8.5 Подключить роутеры в `attach_api` перед корневым MCP. Проверка: `GET /openapi.json` даёт числа из `specs/overview` (с учётом п. 1.2), все свои пути начинаются с `/api/v1/`; тест «Маршруты Agno не перекрыты» проходит

## 9. Импорт

- [x] 9.1 `agno/core/importers/screenplay.py`: сборка документа редактора из списка `(тип, текст, параметры сцены)`, `uid` каждой сцене, проверка группы 5, извлечение персонажей и локаций (без пометок в скобках, без учёта регистра, без дублей с историей). Тест: «Без дублей»
- [x] 9.2 `fountain.py` и `fdx.py` — перенос правил `web/src/editor/importers/` на Python; `plain.py` — DOCX и TXT построчно через разбор Fountain. Образцы в `agno/tests/fixtures/import/`: Fountain и FDX, выгруженные экспортом редактора со всеми 14 типами абзацев, русский TXT, DOCX. Тесты: «Круг через наш Fountain», «Русские заголовки в TXT», битый FDX
- [x] 9.3 Маршруты: `POST /api/v1/projects` в multipart с `title` и `file` (проверка как у загрузки, затем история, файл и документы одной транзакцией; решение 2026-11-02 вместо `file_id`, который при создании взять неоткуда) и `POST /api/v1/projects/{id}/import` с `If-Match` (замена текста и добавление документов одной транзакцией, драфты и записи рецензирования не трогаются, файл чата — `422`). Тесты: сценарии `api/story-import`

## 10. Инструменты соавтора

- [x] 10.1 `agno/app/auth/`: `run_principal(run_context)` — `Principal` из `run_context.authorization.context` (`principal_id`, `claims.groups`); нет авторизации или `principal_id` не совпадает с `user_id` запуска — ошибка. Тест на подготовленном `RunContext`; `./scripts/check_auth_boundary.sh` проходит
- [x] 10.2 `agno/agents/coauthor_tools.py`: функции с `run_context` — список документов, документ, текст или сцена по `uid`, текст файла беседы, создание предложения; история из `session_id` (`<projectId>:<uuid>`, иначе отказ), доступ через `can_access_project`; отказы — строкой с причиной. Подключить в `coauthor.py`. Тесты функций на `ai_test`: чужая история, беседа без истории, цитаты нет, предложение создано
- [x] 10.3 `agno/skills/coauthor/SKILL.md`: когда читать историю инструментами, как давать точную цитату и `uid` сцены, что предложение не меняет текст до решения автора. Проверка: API стартует, `agent_prompt("coauthor")` загружается
- [x] 10.4 Модельная проверка (тратит вызовы модели): беседа с историей, где у Веры заполнен «Главный страх»; вопрос без открытого документа «Чего боится Вера?» и просьба предложить правку реплики. Ответ, вызовы инструментов и созданное предложение записать в `tmp/VERIFY.md`

## 11. Проверка целиком

- [x] 11.1 `./scripts/validate.sh`, `./scripts/dev.sh test`, `git diff --check` проходят
- [x] 11.2 Контейнерная проверка: `docker compose up -d --build` — порядок `clamav` → `agentos-api`; запросами с токеном `writer@authorled.test`: создать историю, персонажа, сохранить текст, конфликт `409`, загрузить TXT (`201`) и EICAR (`422`), импорт Fountain, корзина и удаление навсегда. Результаты по видам (статика, детерминированные, модельные, контейнерные) — в `tmp/VERIFY.md`
- [x] 11.3 Документация: `CLAUDE.md`/`AGENTS.md` («Где что лежит» — новые модули ядра и роутеры, ClamAV в `compose.yaml`), `openspec/context/03-architecture.md` (инструменты соавтора — функции Agno в процессе, вызывающие ядро). Проверка: пути в тексте существуют

## Workflow follow-up

- STARC (образец файла, разбор `.starc`, приём `.starc` в загрузке и импорте) — change `starc-import`.

- После архивации — интент `business-intents/story-data-web.md` через `/opsx:propose`.
- Production не проверяется в этом change; деплой — скилл `deploy-platform`.
