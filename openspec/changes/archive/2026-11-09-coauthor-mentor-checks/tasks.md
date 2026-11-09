# Tasks

## 1. Ядро: таблица и операции оценки

- [x] 1.1 Описать `coauthor_feedback` в `agno/core/tables.py` и написать миграцию `0012_coauthor_feedback` (`alembic revision --rev-id 0012_coauthor_feedback` из `agno/`, руками по таблице): `user_id` → `users` RESTRICT, непустые `run_id` и `session_id`, `value` — `useful`, `not_useful` или `NULL`, уникальность `(user_id, run_id)`. Тесты в `test_migrations.py` и тестах таблиц: состав колонок, вторая оценка того же запуска, неизвестное значение, удаление пользователя с оценками — по сценариям дельты `core/database`; `./scripts/dev.sh test`
- [x] 1.2 `agno/core/feedback.py`: `set_feedback`, `clear_feedback`, `session_feedback` по design, решение 7 (запуск ищется в `usage_records` по `run_id`, `user_id` и `agent_id = 'coauthor'`, `session_id` из журнала; снятие — `value = NULL`). Тесты `agno/tests/test_feedback.py` на реальной базе: поставить, сменить, снять, снять несуществующую, чужой запуск и неизвестный запуск — `NotFound`, снятые не попадают в список беседы
- [x] 1.3 `feedback_report(connection, since, limit)` в `agno/core/feedback.py`: счёт `useful` и `not_useful` за окно, последние `not_useful` с почтой, беседой, запуском и временем, снятые не считаются. Тест по сценарию «Оценки соавтора» дельты `core/subscriptions` (3 + 1 + снятая → 3, 1, 25 %)

## 2. Маршруты и отчёт администратора

- [x] 2.1 `agno/app/api/feedback.py`: `PUT` и `DELETE /api/v1/coauthor-feedback/{run_id}`, `GET /api/v1/coauthor-feedback?session_id=` (тег Coauthor feedback, модели Pydantic, `Problem` с `application/problem+json`), доступ через `caller_id` и `require_project` по префиксу `session_id`. Подключить в `attach_api` до MCP. Тесты `agno/tests/test_feedback_routes.py` по всем сценариям дельты `api/coauthor-feedback`: `200` и смена, `422` на значение, лишнее поле и неверный `session_id`, `204` дважды, `404` на чужой и неизвестный запуск и историю без доступа, список после снятия
- [x] 2.2 Команда `coauthor-feedback` в `agno/admin/__main__.py` (таблица через `_print_table`, «Оценок нет.» и код `0`) и в `scripts/usage.sh` (разбор аргументов, строка usage). Проверить `./scripts/usage.sh local coauthor-feedback` на локальном стеке: без оценок и с одной оценкой, текста ответа в выводе нет
- [x] 2.3 `./scripts/validate.sh` (через `env -u BASH_ENV` после `source agno/.venv/bin/activate`) и `git diff --check` проходят; голова миграций одна

## 3. Соавтор: промпт, подсказки, эвалы

- [x] 3.1 Прочитать актуальный `agno/skills/coauthor/SKILL.md` (его меняет и `coauthor-tool-contracts`) и добавить раздел «Проверки наставника» по требованиям «Ответ на проверку наставника» и «Проверка без материала» дельты `api/agents`. Тест навыка соавтора проходит
- [x] 3.2 Формулировки восьми проверок записать в `quick_prompts` соавтора в `agno/app/config.yaml`, слово в слово как в `checks.ts` из задачи 4.1. Проверить, что API стартует (`docker compose up -d --build --wait agentos-api`)
- [x] 3.3 Убрать восемь `Case` с тегом `coauthor-checks` из `agno/evals/cases.py`. В `agno/evals/coauthor/` по design, решение 9: часть `checks` набора `demo` (`cases/demo-checks.toml`, `--part checks`) без правила покрытия доменов и разделов; необязательное поле случая `open = { scene = N }` со сверкой номера по `web/src/data/demo.json`; `chat_context` с открытым текстом сценария и выделенной сценой как в `docContext.ts`; строка ожидания судьи для `open`. Тесты в `agno/tests/test_coauthor_eval.py`: разбор поля, неизвестная сцена, контекст с выделением, строка ожидания. `./scripts/dev.sh test` проходит
- [x] 3.4 Восемь случаев в `agno/evals/coauthor/cases/demo-checks.toml` (design, решение 9). Запустить `python -m evals.coauthor run --set demo --part checks --all`, прочитать ответы и причины судьи, итог записать в `tmp/VERIFY.md`

## 4. Веб: проверки в чате и над выделением

- [x] 4.1 `web/src/screens/project/chat/checks.ts`: восемь проверок `{ id, label, request }` по design, решение 1. Пустая беседа показывает «О чём эта история?» и проверки вместо `SUGGESTIONS`; кнопка «Проверки» (`DropdownMenu`) у поля ввода, выключена, пока соавтор отвечает. Проверить `npm run lint`, `typecheck`, `build --prefix web`, `./web/scripts/check_web_tokens.sh`
- [x] 4.2 `askCoauthor(text)` в `ProjectContext` и `ProjectScreen`: ожидающая просьба с `id`, открытие колонки или шторки чата, отправка в `CoauthorChat` через тот же `send` по design, решение 2. Проверить вживую: «Проверки» → «Голоса» с выделенной репликой — в запросе AG-UI есть выделение, сообщение не уходит дважды
- [x] 4.3 Опция `onCoauthorRequest` редактора и кнопка «Соавтор» в `bubbleMenu.ts` (подпись и иконка, на узком экране только иконка), `DropdownMenu` с проверками у прямоугольника кнопки в «Тексте сценария» и «Поэпизоднике»; пункты выключены, пока соавтор отвечает. Проверить вживую: свёрнутый чат открывается, «Темп» по выделенной сцене уходит с выделением в контексте; в запертом драфте кнопка есть; на 375 px меню и список без горизонтальной прокрутки (скриншоты в `tmp/VERIFY.md`)

## 5. Веб: оценка ответа

- [x] 5.1 `run_id` у сообщений соавтора по design, решение 5: `runId` первого `RUN_STARTED` хода (design, решение 5) → карта `messageId → runId` для последнего ответа запуска; `loadConversation` читает `run_id` из `/sessions/{id}/runs`. Проверить вживую: у живого ответа и у ответа после перезагрузки `run_id` совпадает со строкой `usage_records`
- [x] 5.2 В `runOrThrow` брать `runId` первого `RUN_STARTED` хода, а не последнего (design, решение 5). Проверить вживую: режим «Спрашивать», «Заведи персонажа Пётр» → «Разрешить» → «Полезно» у ответа сохраняется без перезагрузки, `PUT` 200, в `coauthor_feedback` тот же `run_id`, что в `usage_records`. Запись в `tmp/VERIFY.md`
- [x] 5.3 Клиент маршрутов оценки (через `osFetch` или клиент `/api/v1` фронтенда, строгий разбор ответа) и кнопки «Полезно» / «Не то» у последнего сообщения каждого запуска рядом со «Скопировать»: поставить, сменить, снять; откат и сообщение чата при ошибке; оценки беседы загружаются при открытии беседы. Проверить вживую по сценариям требования «Оценка ответа соавтора» (остаётся после перезагрузки, снять, сбой сохранения при остановленном API) и `npm run lint`, `typecheck`, `build`

## 6. Итоговая проверка

- [x] 6.1 Обновить `README.md` и `CLAUDE.md`, где перечислены свои маршруты (`/api/v1/me` и маршруты истории) и команды `usage.sh`: добавить `coauthor-feedback`. Проверить `git diff --check`
- [x] 6.2 Полный `./scripts/validate.sh`, `./scripts/dev.sh test`, `git diff --check` проходят
- [x] 6.3 Живой сквозной прогон на локальном стеке с моделью: «Где вода?» из меню выделения по сцене «Тихой воды» — ответ с цитатами и вопросом, без переписанной сцены, правка (если есть) пришла предложением; поставить «Не то» и увидеть её в `./scripts/usage.sh local coauthor-feedback`. Записать в `tmp/VERIFY.md` раздельно: static, deterministic, model, container; hosted — не проверялось

## Workflow follow-up

- После apply и проверки — `/opsx:verify`, затем `/opsx:archive` (переносит дельты в мастер-спеки).
- Выкладка — релизом GitHub из `main` (README, «Deploy by release»); после неё `./scripts/usage.sh prod coauthor-feedback` должен печатать «Оценок нет.».
