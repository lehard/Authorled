# TODO: недокументированное и расхождения

Мастер-спецификация пересоздана 2026-10-24. Источники: код репозитория, `GET /openapi.json` и runtime-ответы локального инстанса (`agno 3.1.10`, `RUNTIME_ENV=dev`), отдельный запуск с `RUNTIME_ENV=prd` и одноразовым ключом JWT, `tools/list` MCP. Контекст-пак `openspec/context/` прочитан; он описывает целевое состояние.

Решения владельца по пунктам — 2026-10-24. Каждый открытый пункт закрывается отдельным OpenSpec change (`openspec/changes/`); прямых правок мастер-спеки в обход changes не делаем.

## Changes
| Change | Статус | Закрывает |
|---|---|---|
| `switch-models-to-deepseek-litellm` | архивирован 2026-10-26; живая проверка перенесена сюда (раздел ниже), ждёт ключей | модели, эмбеддинги, ключи в документации, `available_models`, ADR по моделям |
| `remove-config-fallbacks` | не создан; код уже в рабочем дереве | fallback-и, телеметрия: спеки и документация |
| `core-*` (серия) | не создан | продуктовое ядро, Alembic, pytest, свои маршруты |
| `auth-module` | архивирован 2026-10-26; остаток — в разделе «Расхождения с контекст-паком» | авторизация: модуль `auth` с полным Authentik, JWT, изоляция |
| `prepare-auth-module-extraction` | архивирован 2026-10-28; prod не проверялся | подготовка модуля `auth` к выносу: compose-фрагмент, контракт токена, роль `agentos` без доступа к `authentik` |

> Внимание: compose требует ключи LiteLLM, DeepSeek, GigaChat и файл `litellm/certs/ca-bundle.pem`; без них `docker compose up` не стартует.

## Живая проверка DeepSeek/LiteLLM/GigaChat
Из архивированного change `switch-models-to-deepseek-litellm` (tasks 1.1, 6.2–6.7). Ждут ключей. Код, прокси и документация проверены статически и в контейнерах на фиктивных ключах (`tmp/VERIFY.md`). Если проверка требует правки кода или design — новый change.
- [ ] Ключи: владелец присылает `DEEPSEEK_API_KEY`, `GIGACHAT_CREDENTIALS` и scope (`GIGACHAT_API_PERS` или `GIGACHAT_API_B2B`); внести в `.env`, не печатая и не коммитя. Проверка: `grep -c` по именам ключей в `.env`.
- [ ] Пересоздать локальную БД (`docker compose down -v`, эксплуатации не было): `shared_knowledge` создаётся с размерностью 1024; загрузить операторские документы с `reader_id`.
- [ ] OS Manager: запрос с несколькими вызовами инструментов в режиме размышлений проходит без `400`. При `400` — стоп, решение владельца (design D2: прокси может не передавать `thinking`/`reasoning_content`).
- [ ] Загрузка PDF длиннее 512 токенов с `reader_id=pdf` → `completed`, эмбеддинги 1024, поиск возвращает фрагмент. Та же загрузка без `reader_id`: записать ответ GigaChat на кусок 5000 символов.
- [ ] `claude-engineer`: задача на чтение и задача на правку файла; в логах прокси запросы идут на `deepseek-thinking`, обращений к Anthropic нет.
- [ ] `python -m evals --tag smoke` (тратит вызовы моделей); прочитать ответы и причины судьи. `./scripts/mcp_check.sh` на фиктивных ключах уже проходил.
- [ ] Сверить SHA-256 Russian Trusted Root CA и Sub CA (`tasks.md` архива, 1.2) с опубликованными отпечатками до прода.
- [ ] `GET /config` → `available_models` показывает только `deepseek-thinking` (модель менеджера); решить, нужен ли там `deepseek-fast`.
- [ ] При старте планировщик взял `agentos-maintenance`, первая попытка — «All connection attempts failed»; разобрать.
- [ ] Записать результаты в `tmp/VERIFY.md` раздельно: static, deterministic, model, container; что не проверено (sandbox, прод).

## Не покрыто или покрыто частично
- [ ] Эндпоинты `openspec/specs/api/*` описаны по OpenAPI. Вживую проверены: 404 для неизвестных agent/team/workflow/session, 422 для `GET /agents/{id}/runs` без `session_id`, 401 в prd, списки Products/Routines/Sources/Schedules/Registry/Queue, переходы Task/Project и resolve Approval (см. ниже). Остальные негативные сценарии — из объявлений OpenAPI; дописываются в changes, затрагивающих домен.
- [ ] Не описаны структуры ответов без схемы в OpenAPI (например, `POST /agents/{agent_id}/runs`) и типы SSE-событий (кроме `RunStarted`) — по мере changes.
- [ ] Допустимые значения `status` у Schedule run и Queue job в OpenAPI не перечислены — по мере changes.
- [x] Переходы Task/Project и `status` Approval — в `api/company`, `api/company-operations`, `api/approvals`; проверено по исходникам и вживую на одноразовой БД (`tmp/VERIFY.md`). Вживую не проверены переходы из `in_progress`/`in_review` и путь к `done` (нужен запуск Task с моделью), статусы `expired`/`cancelled` у Approval.
- [x] `platform-builder-internal`, `platform-manager-internal`: в `api/teams` — ссылка на документацию Agno, без дублирования.
- Снято: Slack — интеграция не нужна, удалена из кода, зависимостей и документации (change `remove-slack`).
- [ ] Docker/AgentCore sandbox не запускались; поведение описано по `app/sandbox.py`. Для инженера на прокси sandbox понадобится `ANTHROPIC_BASE_URL` на адрес прокси (design D6 change `switch-models-to-deepseek-litellm`).
- [ ] По `CLAUDE.md`: PATCH метаданных Product заменяет словарь целиком, декларации Product/Source не перезаписывают сохранённые правки. Не проверено (требует мутации), в спеку не внесено.
- Снято: MCP OAuth (`MCP_CONNECT_SECRET`) — не проверяем (решение владельца); код `mcp_auth` остаётся.

## Расхождения с контекст-паком (целевое состояние)
- [ ] Свои маршруты (ADR-002): отложены до ядра. Противоречие в правилах снято: `AGENTS.md` разрешает продуктовые маршруты без LLM только через `base_app`; `overview` описывает текущее отсутствие маршрутов. → `core-*`.
- [ ] Продуктовое ядро (Д1–Д22, версии, чек-листы, граф связей, утверждения, журнал решений), Alembic, pytest — серия changes по вертикалям: Alembic + pytest + «документ и версия» → утверждение с маршрутом → граф связей и чек-листы. → `core-*`.
- [x] Модели: DeepSeek (`deepseek-fast` / `deepseek-thinking`) через LiteLLM-прокси; `claude-engineer` — Claude Code на DeepSeek через прокси; `codex-engineer` снимается. → `switch-models-to-deepseek-litellm`.
- [x] Эмбеддинги: у DeepSeek эмбеддингов в официальном API нет → GigaChat `Embeddings-2` (1024 изм.) через прокси. → `switch-models-to-deepseek-litellm`.
- [x] Авторизация: Authentik как модуль `auth` в этом репозитории (не отдельный `authorled-auth`), проверка JWT, схема `authentik` в общей БД; ADR-001 и `03-architecture.md` обновлены. → `auth-module` (архив `changes/archive/2026-10-26-auth-module`, проверки в `tmp/VERIFY.md`).
- [ ] Остаток после `auth-module`: обратный прокси, домен и TLS для Authentik (hosted-проверка), доступ AgentOS UI с токеном Authentik, интерактивная проверка второго фактора и входа Authorization Code с PKCE, срок жизни токенов сервисных учётных записей плагинов, соотношение `/users*` и `/service-accounts` Agno с Authentik, роли в проекте (`can_access_project` ждёт источник от ядра). Следующий этап — собрать компоненты вместе, продуктовая логика поверх (решение владельца 2026-10-26).
- [ ] Мелкие замечания `/opsx:verify auth-module` (не блокировали архив): (1) проверки просроченного токена и токена чужой аудитории в `scripts/auth_check.sh` и вживую; (2) в `openspec/specs/overview` сценарий «Значения по умолчанию окружения» (`RUNTIME_ENV=prd` и `AGENTOS_URL` по умолчанию) противоречит коду, который падает без этих переменных (`app/main.py`) — решить, спека или код верны, → `remove-config-fallbacks`; (3) строка документации в `app/auth/authorization.py` называет `AUTH_AUDIENCE`, код читает `AUTH_FRONTEND_CLIENT_ID`; (4) в интенте `business-intents/authentik-identity-and-isolation.md` три группы, в коде четыре (`plugins`); (5) базовые сценарии `GET /config`, `/teams`, `/registry`, `/company/sources` (`architecture`, `api/core`, `integrations`) не упоминают, что теперь нужен токен; (6) без токена в `dev` отвечают `/docs`, `/openapi.json`, `/mcp/server-card` — решить, закрывать ли.
- [x] Shell и правка файлов: в `05-security-and-compliance.md` и `07-anti-patterns.md` разграничены инструменты разработки и продуктовый агент.
- [ ] Телеметрия: в коде `AgentOS(telemetry=False)` и `AGNO_TELEMETRY=false` в compose (рабочее дерево); спеки и документация не обновлены. → `remove-config-fallbacks`.
- [ ] ClamAV и фронтенд (Refine, CopilotKit, AG-UI) — дорожная карта, не расхождение: появятся вместе с загрузками и фронтендом в `web/`.
- [ ] Redis — закладывается в change первой рассылки продуктовых событий; при одной инстанции API не нужен.

## Расхождения кода и документации
- [x] Ключи моделей в `README.md`, `AGENTS.md`, `example.env`, `docs/sandboxes.md`, скиллах `setup-platform`/`deploy-platform`, критерии `manager_explains_application`: нужны только DeepSeek, GigaChat и ключи прокси; `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` не нужны; в `example.env` — комментарий, кто использует каждый ключ. → `switch-models-to-deepseek-litellm` (tasks 4.x).
- [x] OpenAPI не объявляет схему безопасности для `/users*`, а в prd без токена — 401: факт записан в `api/identity`. Черновик issue в Agno подготовлен, не отправлен (нужно согласие владельца).
- [x] `GET /config` → `available_models` и реестр расходились (opus против opus+sonnet): реестр теперь объявляет обе модели DeepSeek; проверить вживую. → `switch-models-to-deepseek-litellm`: реестр — обе модели, `available_models` — только `deepseek-thinking` (см. «Живая проверка»).

## Fallback-и
Удалены в рабочем дереве (не закоммичено); мастер-спека (`runtime`, `overview`, `integrations`, `api/core`) и документация ещё описывают старое поведение. → `remove-config-fallbacks`.
- [ ] `db/url.py`: все `DB_*` обязательны; compose передаёт их явно.
- [ ] `app/main.py`: `RUNTIME_ENV` обязателен и равен `dev` или `prd`; `AGENTOS_URL` обязателен (в prd — `${AGENTOS_URL:?}`), `DB_PASS` в prd обязателен.
- [ ] `app/registry.py`: режим веб-инструмента — константа `PARALLEL_MODE` (`keyless_mcp` по умолчанию в коде, `sdk` требует `PARALLEL_API_KEY`), без переключения по env.
- [ ] `evals/__main__.py`: `RUNTIME_ENV` не подставляется, должен быть задан явно.
- [ ] Документация под обязательные переменные: `README.md:188-195,288-293`, `example.env` (блоки `AGENTOS_URL`, `PARALLEL_API_KEY`, `DB_*`, нет `RUNTIME_ENV`), `docs/sandboxes.md:34-35` (команда хоста без `DB_DRIVER`/`DB_USER`/`DB_PASS`/`DB_DATABASE`), `.agents/skills/create-agent/SKILL.md:86`, `.agents/skills/deploy-platform/SKILL.md:68`, `AGENTS.md` («application code defaults to `prd`»).
- [ ] Оставшиеся fallback-и (на решение владельца): `scripts/mcp_check.sh:93` (`AGENTOS_URL` по умолчанию `http://localhost:8000`), `compose.prod.yaml` `MCP_CONNECT_SECRET: ${MCP_CONNECT_SECRET:-}`, `compose.yaml` `${IMAGE_NAME:-agentos}:${IMAGE_TAG:-latest}`; `app/interfaces.py` и `app/sandbox.py` не проверены.

## Замечания по качеству
- [x] Дубль operationId `get_config`: это `GET /config` (`agno/os/router.py:102`) и `GET /components/{id}/configs/{version}` (`agno/os/routers/components/components.py:1352`). Факт записан в `api/components`; черновик issue в Agno подготовлен, не отправлен.
- [x] `python -m app.main` слушает `127.0.0.1`, контейнер — `0.0.0.0`: так задумано, записано в `runtime`.
- [ ] Спеки API длинные (INFO «Requirement text is very long»): разбивать домен при первом change, который его затрагивает.
- [ ] `scripts/auth_check.sh` сразу после `docker compose up --wait` иногда падает на получении токена, через ~20 с проходит: blueprints Authentik применяются после того, как сервер стал healthy. Предложение: шаг ожидания в скрипте или healthcheck по готовности провайдера (замечено 2026-10-28).
- [ ] Планировщик при старте API пишет `Schedule … attempt 1 failed: All connection attempts failed`: обращается к `AGENTOS_URL` раньше, чем API начал отвечать. Проверить, повторяет ли он попытку и не теряется ли запуск Routine (замечено 2026-10-28).
- [ ] Архивный `changes/archive/2026-10-26-auth-module/proposal.md` называет фронтенд отдельным репозиторием `authorled-web`; фронтенд в `web/` (ADR-001). Архив не правим — учитывать при чтении.
