# Проверки change `coauthor-orchestrator-domains`

Перенесено 2026-11-09 из `tmp/VERIFY.md` (папка `tmp/` не входит в git): записи этого change, как они велись по ходу работы. Отчёты прогонов, на которые они ссылаются (`tmp/routing/`, `tmp/coauthor-eval/`), в git не сохранены; их можно получить заново командами замера на тех же наборах.

## coauthor-orchestrator-domains (2026-11-08)

### 1.1 GigaChat Lite через LiteLLM
- Static: в контейнере прокси `ghcr.io/berriai/litellm:v1.104.2` есть провайдер `litellm/llms/gigachat/chat/transformation.py`: OpenAI `tools` переводит в `functions` GigaChat, ответ `function_call` — обратно в `tool_calls`. Модель Lite у провайдера — `gigachat/GigaChat-2` (в карте моделей LiteLLM также `GigaChat-2-Pro` и `GigaChat-2-Max`, все с `supports_function_calling: true`).
- Ограничение: GigaChat возвращает не больше одного вызова функции за ответ, а при отправке истории LiteLLM оставляет из `tool_calls` сообщения только первый (`tool_calls[0]`). Лидер `team` на GigaChat делегирует домены по одному за ход, вызовов модели на сообщение с несколькими просьбами будет больше, чем на DeepSeek.
- Цена (официально): GigaChat 2 Lite — 65 ₽ за 1 млн токенов, одинаково для физлиц и юрлиц, действует с 2026-02-01; GigaChat считает токены запроса и ответа вместе. Источники: https://developers.sber.ru/docs/ru/gigachat/models/gigachat-2-lite, https://developers.sber.ru/docs/ru/gigachat/tariffs/legal-tariffs, https://developers.sber.ru/docs/ru/gigachat/tariffs/individual-tariffs. Скидки за кэш в прайсе не нашёл.
- Hosted, v0.3.2 (PR #21, deploy run 42487006978 green), https://app.soavtor.app, story «Проверка соавтора», mode «Спрашивать»: card «Создать персонажа «Тест»» → «Разрешить» → the line reads «Отказ: Поле «role» должно быть одним из: main, secondary, episodic.»; nothing was created. The served bundle contains the new line text.

### 4.3 Токены команды против ответов прокси
- У прокси нет базы (`DATABASE_URL` не задан), журнала расхода LiteLLM нет. Вместо журнала разовый скрипт (scratchpad, не в репозитории) перехватил тело каждого ответа `/v1/chat/completions` прокси (`usage`) через `httpx` event hook на модели всех компонентов.
- Model, `team` на `deepseek-fast`, «Заведи персонажа Пётр, брат Веры, и подскажи, где в первом акте поворотный момент»: выбраны `domain-documents`, `domain-structure`. Экзамен: 4 вызова, вход 4662 (кэш 3456), выход 692; прокси: 4 ответа, вход 4662 (кэш 3456), выход 692 — совпадает. `TeamRunOutput.metrics` лидера не включает участников (их запуски в `member_responses`), сумма по `model_runs` не теряет и не удваивает.
- Model, вариант `skills` с историей из двух реплик: реплика соавтора из истории не считается вызовом модели (у неё нет метрик), выбраны те же два домена.

### Набор, компоненты и прогон (группы 2–4)
- Static: навыки `domain-documents`, `domain-structure`, `domain-craft`, `domain-none`, `orchestrator`, `orchestrator-skills` загружаются `agents.prompts.agent_skill` (имя = id, непустые описание и тело, у доменов нет scripts и references); `agent_prompt("coauthor")` возвращает прежнее тело промпта соавтора.
- Static: `./scripts/validate.sh` в `agno/.venv` (`env -u BASH_ENV`): ruff format и check, mypy (119 файлов), одна голова alembic — проходят. Скрипт в целом падает на проверке сборки сайта `site/` («index.html has no text «Скоро»…», «Заявка в бету», «methodology is not marked as missing») — это незаконченная работа другой сессии в `site/`, файлы этого change её не касаются.
- Deterministic: pytest `tests/test_routing_cases.py` и `tests/test_routing_score.py` — 24 passed (без базы и без вызовов модели).
- Container: `GET /info` на запущенном `agentos-api`: `agent_count: 3`, `team_count: 1`, `workflow_count: 0` — как в спеке `overview`; `app/` не импортирует `evals.routing`.
- Набор (черновик агента, разделы писали четыре субагента, вычитан и собран 2026-11-08): 385 случаев. `work.toml` 291 (single 57, none 30, multi 45, boundary 38, continuation 45, switch 23, noise 30, adversarial 23; ожиданий по доменам: documents 97, structure 85, craft 79, none 94). `holdout.toml` 94 (каждый 4-й случай раздела; single 18, none 10, multi 15, boundary 12, continuation 15, switch 7, noise 10, adversarial 7). Загрузка `load_parts()` проходит. Ограничение: черновик целиком, включая отложенную часть, читал агент, который его собирал; промпты оркестратора настраивать не им.
- Прогон: без `--split` — argparse отказывает (код 2); `--model gpt-4` — отказ со списком моделей; `--model gigachat-lite` до записи цены — `UnknownModel: Model 'gigachat-lite' has no price in model_prices.toml`, до первого вызова модели.
- Model: `--split work --variant team --model deepseek-fast --sample 3` — 3/3 верно, 11 вызовов модели (3,7 на случай), вход 14409 (кэш 11392), выход 1361, 0,26 ₽ (0,087 ₽ на случай), медиана 7,8 с, p95 13,3 с; отчёт `tmp/routing/20261108T141138Z-work-team-deepseek-fast.{json,md}`.
- На хосте нужен `LITELLM_URL=http://127.0.0.1:4000` (в `.env` его нет, его задаёт `dev.sh api`); записано в README экзамена и `AGENTS.md`.
- 3.5: владелец 2026-11-08 принял черновик набора как есть; неверные случаи в отчётах смотрим вместе — ошибся набор, а не оркестратор, правим разметку в `work.toml`.

### /opsx:update 2026-11-08: Claude вместо GigaChat
- Владелец: «Сбер мы используем для векторизации, для чата у нас Дипсик»; для сравнения — Claude Sonnet и Opus по ключу Anthropic. GigaChat Lite (выше) отклонён, псевдоним `gigachat-lite` не добавлялся, фабрика `gigachat_lite_model()` удаляется в 1.3.
- 1.1: цены Anthropic (skill `claude-api`, таблица моделей от 2026-10-06): Sonnet 5.5 `claude-sonnet-5-5` — $2 вход, $0,20 кэш, $10 выход за 1 млн токенов; Opus 5.5 `claude-opus-5-5` — $4, $0,20, $20. По курсу 100 ₽: 200 / 20 / 1000 ₽ и 400 / 20 / 2000 ₽. У обеих моделей thinking выключить нельзя (`disabled` → 400), без параметра — адаптивный режим; принудительный `tool_choice` → 400.
- Владелец: ключ `ANTHROPIC_EXAM_API_KEY` необязателен (исключение из «без fallback»), перезапуск прокси разрешён, бюджет прогонов до 300 ₽, черновик набора принят.

### 1.3, 7.1, 7.3 (2026-11-08)
- Static: `app/settings.py` — `CLAUDE_SONNET`, `CLAUDE_OPUS`, `claude_sonnet_model()`, `claude_opus_model()` (OpenAILike через прокси, без `thinking`); `gigachat_lite_model()` удалена; модели экзамена: `deepseek-fast`, `claude-sonnet`, `claude-opus`. `prices().get("claude-sonnet")` = 200/20/1000 ₽, `claude-opus` = 400/20/2000 ₽. ruff, mypy; pytest `test_plans.py`, `test_routing_*` — 42 passed.
- Телеметрия: у `coauthor` `telemetry=False`. У `ClaudeAgent` (инженер, `agno/agents/claude/agent.py`) телеметрии нет — флаг не нужен. Импорт `app.main` с настройками локального стека: без `AGNO_TELEMETRY` — `RuntimeError: AGNO_TELEMETRY must be exactly 'false', got None`; с `true` — `got 'true'`; с `false` — AgentOS собирается, `agent_os.telemetry` False. В compose dev/prod и `dev.sh api` переменная уже `false`; в `example.env` и `.env` добавлена. Контейнер API не пересоздавался.
- `AGENTS.md`: строка про `agno/teams/` теперь говорит, что папки пока нет и она появится с первой зарегистрированной командой.

### 1.2, 7.2: прокси с псевдонимами Claude (2026-11-08)
- Container: `docker compose up -d litellm` (перезапуск разрешён владельцем) — healthy. С ключом (`ANTHROPIC_EXAM_API_KEY` в `.env`, 106 символов; значение не выводилось): `deepseek-fast` и `claude-sonnet` отвечают 200; запрос с инструментом `delegate_task_to_member` к `claude-sonnet` и `claude-opus` возвращает `tool_calls`.
- Container: тот же прокси с пустым ключом (`ANTHROPIC_EXAM_API_KEY= docker compose up -d litellm`) — стартует; `deepseek-fast` 200; `claude-sonnet` — `401 litellm.AuthenticationError: Missing Anthropic API Key`. Затем прокси пересоздан обратно с ключом (длина 106 в контейнере).
- 7.2: `python -m evals.routing ... --sample 1` без `export LITELLM_URL` берёт адрес из `.env` и работает. В контейнере `agentos-api`: `LITELLM_URL=http://litellm:4000`, `AGNO_TELEMETRY=false` (из `environment` compose). Контейнер API не пересоздавался — не останавливал общий API других сессий; приоритет `environment` над `env_file` — поведение compose.

### Ошибка прогона: история в команде (2026-11-08)
- Первые полные прогоны рабочей части на `deepseek-fast` (отчёты `20261108T142045Z-work-team`, `…143155Z-work-team-route`, `…143758Z-work-skills`): полное совпадение 77% / 88% / 93%. Раздел `switch` у обеих команд — 9% (2/23), у `skills` — 83%.
- Причина — прогон, а не оркестратор: Agno 3.1.10 `Team` склеивает список входных сообщений в одно сообщение пользователя (`team/_messages.py`, `_get_user_message`, ветка `isinstance(input_message[0], Message)` → `get_text_from_message`). Прошлая просьба из истории попадала в текущую, лидер передавал её домену снова (`switch-001`: ожидали craft, выбрал documents + craft). У агента список сообщений идёт раздельно.
- Исправление: история случая — прошлые запуски сессии в `InMemoryDb` (в памяти, база не используется), оркестратор читает их `add_history_to_context`, как продукт читает беседу; одинаково для всех вариантов. Загрузка набора проверяет, что история чередует автора и соавтора и заканчивается соавтором. Проверка на `switch-001`, `switch-002`, `continuation-002` для `team` и `team-route` — все верно. Первые три полных прогона недействительны для разделов с историей; прогоны повторяются.

### Claude: выборки и бюджет (2026-11-08)
- Владелец: на Claude бесплатные токены API, до $100 «смело»; поэтому на Claude — все три варианта, а не только лучший (6.2a обновлена).
- Model, `--sample 3`: `claude-sonnet` — `team` 3/3, 5,0 вызова и 2,59 ₽ на случай; `skills` 3/3, 2,0 вызова, 1,69 ₽. `claude-opus` — `team` 3/3, 5,0 вызова, 5,38 ₽; `skills` 3/3, 2,0 вызова, 3,35 ₽. Ошибок запуска нет: адаптивное рассуждение Claude через OpenAI-совместимый `/v1` прокси не ломает цепочку вызовов инструментов. Оценка полных прогонов всех вариантов на двух моделях — около 5000 ₽ (~$50 по курсу 100 ₽).

### 6.1–6.2: рабочая часть на `deepseek-fast` после исправления истории (2026-11-08)
- 6.1, выборки `--sample 20`: все три варианта 20/20; 0,087 / 0,055 / 0,076 ₽ на случай (`team` / `team-route` / `skills`).
- Model, полная рабочая часть (291), отчёты `20261108T145402Z-work-team`, `…150356Z-work-team-route`, `…150933Z-work-skills` (`-deepseek-fast.{json,md}`):

| Вариант | Полное совпадение | Домен не выбран | Вызовов на случай | Медиана / p95, с | ₽ на случай |
|---|---|---|---|---|---|
| `team` | 81% (236) | 14 | 3,7 | 7,1 / 15,8 | 0,115 |
| `team-route` | 95% (276) | 1 | 2,2 | 4,3 / 6,4 | 0,063 |
| `skills` | 94% (273) | 4 | 2,0 | 3,2 / 5,6 | 0,047 |

- По разделам (`team` / `route` / `skills`): single 77/100/96, none 80/97/100, multi 91/82/96, boundary 79/100/97, continuation 84/98/87, switch 83/100/87, noise 80/100/97, adversarial 70/78/87 (%).
- Ошибки глазами:
  - `team` (coordinate) добавляет `domain-documents` к вопросам о сюжете и ремесле (лидер просит домен документов «прочитать материалы» для другого домена) и сам отвечает на приветствия и «ок» без домена (14 случаев «домен не выбран»).
  - `skills` тоже иногда грузит навык документов вместе со структурой (single-026, single-039, noise-015) и сам отвечает на болтовню в продолжениях (continuation-055/057/058).
  - Общие ошибки всех вариантов — спорная разметка: adversarial-029, adversarial-030 (к настоящей просьбе приписана инъекция; разметка ждёт ещё `domain-none`, все варианты её просто игнорируют), none-038 («.....»). Вынесено владельцу.

## coauthor-orchestrator-domains: 6.2a, рабочая часть на Claude (2026-11-08)

- Сбой первого прогона `team` на `claude-sonnet`: модель вызвала `delegate_task_to_member` без `member_id`, Agno отказал в вызове (`tool_call_error`), модель повторила с аргументом; экзамен считал отказанный вызов выбором домена и падал (`ValueError … has no member_id`). Исправление: `chosen_domains` пропускает вызовы с `tool_call_error`, прогон пишет «<id>: N refused tool call(s)»; вызов без аргумента, который Agno выполнил, по-прежнему роняет прогон. Отказанных вызовов в полных прогонах: 1 (`adversarial-019`, `team-route` на `claude-opus`).
- Model, полная рабочая часть (291), отчёты `tmp/routing/<ts>-work-<вариант>-<модель>.{json,md}`; для `deepseek-fast` — последние прогоны (`145402Z` team, `151502Z` team-route, `152039Z` skills):

| Модель | Вариант | Полное совпадение | Домен не выбран | Вызовов на случай | Медиана / p95, с | ₽ на случай | ₽ за прогон |
|---|---|---|---|---|---|---|---|
| deepseek-fast | team | 81% (236) | 14 | 3,7 | 7,1 / 15,8 | 0,115 | 33 |
| deepseek-fast | team-route | 97% (281) | 0 | 2,2 | 4,2 / 6,4 | 0,064 | 19 |
| deepseek-fast | skills | 94% (273) | 5 | 2,0 | 2,8 / 3,5 | 0,041 | 12 |
| claude-sonnet | team | 98% (286) | 1 | 5,0 | 14,2 / 20,3 | 2,945 | 857 |
| claude-sonnet | team-route | 99% (287) | 1 | 2,2 | 5,9 / 9,4 | 1,025 | 298 |
| claude-sonnet | skills | 99% (288) | 1 | 2,0 | 3,3 / 5,6 | 1,823 | 531 |
| claude-opus | team | 95% (277) | 1 | 5,1 | 18,3 / 27,6 | 6,265 | 1823 |
| claude-opus | team-route | 82% (239) | 1 | 2,0 | 6,7 / 12,6 | 2,183 | 635 |
| claude-opus | skills | 100% (291) | 0 | 2,0 | 3,7 / 5,5 | 3,579 | 1041 |

- `team-route` на `claude-opus` — 7% в разделе multi: Opus соблюдает режим `route` Agno («hand the request to exactly one member», `team/_messages.py`) и передаёт ровно один домен. DeepSeek и Sonnet в том же режиме вызывают несколько членов за ход — их высокий балл на multi держится на нарушении режима.
- `team` (coordinate) на Claude повторяет ошибку DeepSeek: лидер добавляет `domain-documents` к вопросам структуры («прочитать материалы»): Sonnet 4 случая, Opus 12.
- Приписанные инъекции (`adversarial-021…030`, ожидают ещё `domain-none`): `skills` на Opus — все верно, на Sonnet — верно кроме `adversarial-030` в `team-route`; разметка достижима, слабее только DeepSeek.
- «Домен не выбран» на Claude — 1 случай на прогон: явные инъекции (`adversarial-017` base64, `adversarial-018` «служба поддержки») лидер отклоняет сам, без `domain-none`.
- Расход на Claude по отчётам: 5225 ₽ (~$52 по курсу 100 ₽), плюс часть упавшего прогона `team` на Sonnet (не больше 857 ₽). В пределах $100.

## coauthor-orchestrator-domains: группа 8, широкий состав (2026-11-08)

### 8.1, 8.2, 8.4: навыки, инструменты, составы, подсчёт
- Static: 11 навыков `agno/skills/wide-*` (описание — граница, тело — заглушка со списком своих инструментов); `domain-none` общий для обоих составов. В `wide-structure` после разметки добавлен паспорт сценария (логлайн, синопсис, жанр, тема) — его не покрывал ни один домен.
- Static: `evals/routing/tools.py` — 29 заглушек (2–4 на домен), каждая возвращает «Готово (заглушка инструмента …)». `check_skills("wide")` проверяет: уникальные имена, 2–4 на домен, у `domain-none` нет, навык домена называет все свои инструменты.
- В `orchestrator-skills` строка «другие инструменты навыков не вызывай» заменена на «`get_skill_reference` и `get_skill_script` не вызывай»: прежняя формулировка запрещала бы инструменты доменов широкого состава. Смысл для `base` прежний.
- Static: ruff, mypy (8 файлов) чисто. Deterministic: pytest `test_routing_cases.py`, `test_routing_score.py` — 34 passed (домен чужого состава, неизвестный состав, загрузка обоих составов, итоги по инструментам, повтор имени инструмента, проверка обоих составов).
- Прогон: без `--domains` — argparse, код 2, список `{base,wide}`. `--domains base --variant team --model deepseek-fast --sample 3` — 3/3, 0,094 ₽ на случай (до изменения 0,087). `app/` не импортирует `evals.routing`.
- Model, проверка механики `--domains wide --sample 4` на `deepseek-fast`: `skills` 3/4, 7 вызовов заглушек, 0,203 ₽ на случай (в `base` 0,041); `team` 3/4, 4 вызова, 0,151 ₽.

### 8.3: набор широкого состава (черновик агентов)
- `wide-work.toml` — 413 случаев: 291 сообщение рабочей части `base` с теми же id и разметкой на 12 доменов (два агента) и 122 новых случая `wide-*` (single 33, boundary 54, multi 16, noise 8, continuation 8, switch 3).
- `wide-holdout.toml` — 134 случая: 94 отложенных `base` с новой разметкой и 40 новых; собирал отдельный агент, основной сессии отдал только счётчики.
- Трудные случаи разметки (рабочая часть), вынесены владельцу: где реплика, а где поиск по тексту (single-002, single-025, multi-017, boundary-014); порядок сцен против сюжета (single-033, single-050, continuation-029, continuation-037); выдумать мотив персонажа — сюжет или персонаж (single-042).

### 8.5: выборки `--sample 20` широкого состава (первые 20 случаев — все `single`)
| Модель | Вариант | Точно | Вызовов на случай | Медиана, с | ₽ на случай | Чужой инстр. | Без действия | Без выбора домена |
|---|---|---|---|---|---|---|---|---|
| deepseek-fast | skills | 17/20 | 3,1 | 5,0 | 0,101 | 4 | 0 | 2 |
| deepseek-fast | team-route | 19/20 | 3,4 | 5,8 | 0,076 | 1 | 0 | 0 |
| deepseek-fast | team | 19/20 | 4,5 | 7,3 | 0,097 | 1 | 0 | 0 |
| claude-sonnet | skills | 19/20 | 2,9 | 5,0 | 4,955 | 1 | 2 | 0 |
| claude-sonnet | team-route | 19/20 | 3,0 | 7,6 | 1,657 | 1 | 0 | 0 |
| claude-sonnet | team | 19/20 | 4,0 | 10,0 | 2,494 | 1 | 0 | 0 |

- `single-002` «Где в сценарии Аня говорит про отца?» (разметка `wide-text`) все шесть прогонов отнесли к другому домену, пять — к `wide-dialogue`: спорная разметка, вынесена владельцу.
- `skills` на DeepSeek добавляет лишний домен (`wide-world` к сценам и сюжету) и зовёт инструменты домена без его навыка.
- Цена: в `base` `skills` был самым дешёвым (0,041 ₽ на DeepSeek, 1,82 ₽ на Sonnet); в `wide` — самый дорогой на Sonnet (4,96 ₽): 29 описаний инструментов в каждом вызове, кэша у Claude через прокси нет (`cache_read` 0), у DeepSeek кэш автоматический.
- Оценка полных прогонов рабочей части (413 случаев, с поправкой ×1,3 на multi и историю): DeepSeek три варианта — около 150 ₽ (бюджет 300 ₽); Sonnet три варианта — около 4900 ₽ (~$49). На Claude уже потрачено около $54–63 (с выборками), остаток от $100 — $37–46: оценка выходит за остаток, по решению 9 нужен ответ владельца.
- Владелец 2026-11-08: черновик широкого набора принят как есть, неверные случаи смотрим по отчётам; `single-002` перенесён в `wide-dialogue`. Лимит на Claude поднят до $120 на весь change.

### 8.5: полная рабочая часть широкого состава (413 случаев)
| Модель | Вариант | Точно (в base) | Без домена | Вызовов | Медиана / p95, с | ₽ на случай | Чужой: чтение / изменение | Без действия | Без навыка |
|---|---|---|---|---|---|---|---|---|---|
| deepseek-fast | skills | 92% (94%) | 8 | 2,9 | 4,4 / 7,3 | 0,108 | 56 / 3 | 6 | 37 |
| deepseek-fast | team-route | 94% (97%) | 0 | 3,4 | 5,5 / 8,9 | 0,083 | 10 / 3 | 2 | 0 |
| deepseek-fast | team | 89% (81%) | 5 | 4,7 | 7,8 / 15,6 | 0,131 | 38 / 5 | 0 | 0 |
| claude-sonnet | skills | 97% (99%) | 1 | 2,8 | 5,0 / — | 5,088 | 7 / 1 | 10 | 0 |
| claude-sonnet | team-route | 98% (99%) | 0 | 3,2 | 8,0 / 12,9 | 1,752 | 6 / 2 | 4 | 0 |
| claude-sonnet | team | 98% (98%) | 1 | 4,8 | 12,2 / 26,7 | 3,261 | 6 / 2 | 1 | 0 |

- Отчёты: `tmp/routing/20261108T173018Z-wide-work-skills-deepseek-fast`, `…173824Z-…team-route-deepseek-fast`, `…174824Z-…team-deepseek-fast`, `…173018Z-…team-route-claude-sonnet`, `…174500Z-…team-claude-sonnet`, `…180924Z-…skills-claude-sonnet`.
- «Чтение» — инструменты, которые только читают (find_*, list_*, read_*, search_*, analyze_act, review_scene); «изменение» — остальные. 56 из 59 чужих вызовов у `skills` на DeepSeek — чтение (list_scenes 25, find_character 18).
- На тех же 291 сообщениях (DeepSeek): `skills` 263 верных против 273 в base, `team-route` 270 против 281, `team` 258 против 236. Новые 122 случая: 117 / 120 / 111 верных.
- Расход: DeepSeek на группу 8 около 145 ₽ (с выборками); Claude по всем отчётам change — 9579 ₽ (~$96), плюс часть упавшего прогона (не больше 857 ₽) — в пределах $120.
- Ограничение: один прогон на вариант, заглушки; разметка широкого набора — черновик агентов.

### 6.3, 8.6: отложенные части на `deepseek-fast` (2026-11-08)
- `base`, holdout (94): `skills` 98% (92/94), 0,086 ₽ на случай; `team-route` 96% (90/94), 0,065 ₽; `team` 84% (79/94), 0,126 ₽. Отличие от рабочей части: `skills` +4 п.п. (94% → 98%), `team-route` −1 (97% → 96%), `team` +3 (81% → 84%) — в пределах разброса порядка ±2–4 п.п. на 94 случаях. Отчёты `tmp/routing/20261108T184142Z-base-holdout-skills-…`, `…184255Z-…team-route-…`, `…184441Z-…team-…`.
- `wide`, holdout (134): прогоны недействительны. С середины `skills` DeepSeek стал отвечать `Insufficient Balance` (`insufficient_balance_error`): у `skills` оценено 96 из 134 (84%, 38 ошибок запуска), у `team-route` 4 из 134, у `team` — ни одного (экзамен упал на подсчёте цены без единого запуска с расходом). Балансовый API DeepSeek: `is_available: false`, баланс 0,00 USD.
- Ключ DeepSeek в локальном `.env` и на сервере (`/etc/authorled/authorled.env`) один и тот же (совпадают первые 12 знаков SHA-256; значения не выводились): нулевой баланс останавливает и соавтора на `app.soavtor.app`. В журнале прокси сервера за 2 часа отказов нет — запросов не было. Сообщено владельцу.
