# TODO: недокументированное и расхождения

Мастер-спецификация пересоздана 2026-10-24. Источники: код репозитория, `GET /openapi.json` и runtime-ответы локального инстанса (`agno 3.1.10`, `RUNTIME_ENV=dev`), отдельный запуск с `RUNTIME_ENV=prd` и одноразовым ключом JWT, `tools/list` MCP. Контекст-пак `openspec/context/` прочитан; он описывает целевое состояние.

Решения владельца по пунктам — 2026-10-24. Каждый открытый пункт закрывается отдельным OpenSpec change (`openspec/changes/`); прямых правок мастер-спеки в обход changes не делаем.

## Changes
| Change | Статус | Закрывает |
|---|---|---|
| `switch-models-to-deepseek-litellm` | proposal, design, tasks, дельты готовы; черновик кода в рабочем дереве (tasks 2.1–2.5), не проверен | модели, эмбеддинги, ключи в документации, `available_models`, ADR по моделям |
| `remove-config-fallbacks` | не создан; код уже в рабочем дереве | fallback-и, телеметрия: спеки и документация |
| `core-*` (серия) | не создан | продуктовое ядро, Alembic, pytest, свои маршруты |
| `authentik-jwt` | не создан; после запуска `authorled-auth` | авторизация |

> Внимание: черновик `switch-models-to-deepseek-litellm` в рабочем дереве требует `LITELLM_URL` и `LITELLM_API_KEY`, а прокси в compose ещё нет — API в текущем рабочем дереве не стартует, пока не выполнены tasks 3.x.

## Не покрыто или покрыто частично
- [ ] Эндпоинты `openspec/specs/api/*` описаны по OpenAPI. Вживую проверены: 404 для неизвестных agent/team/workflow/session, 422 для `GET /agents/{id}/runs` без `session_id`, 401 в prd, списки Products/Routines/Sources/Schedules/Registry/Queue, переходы Task/Project и resolve Approval (см. ниже). Остальные негативные сценарии — из объявлений OpenAPI; дописываются в changes, затрагивающих домен.
- [ ] Не описаны структуры ответов без схемы в OpenAPI (например, `POST /agents/{agent_id}/runs`) и типы SSE-событий (кроме `RunStarted`) — по мере changes.
- [ ] Допустимые значения `status` у Schedule run и Queue job в OpenAPI не перечислены — по мере changes.
- [x] Переходы Task/Project и `status` Approval — в `api/company`, `api/company-operations`, `api/approvals`; проверено по исходникам и вживую на одноразовой БД (`tmp/VERIFY.md`). Вживую не проверены переходы из `in_progress`/`in_review` и путь к `done` (нужен запуск Task с моделью), статусы `expired`/`cancelled` у Approval.
- [x] `platform-builder-internal`, `platform-manager-internal`: в `api/teams` — ссылка на документацию Agno, без дублирования.
- [ ] Slack описан только по коду `app/interfaces.py`; живая интеграция не запускалась. Интеграция не нужна; удаление из кода владелец отложил.
- [ ] Docker/AgentCore sandbox не запускались; поведение описано по `app/sandbox.py`. Для инженера на прокси sandbox понадобится `ANTHROPIC_BASE_URL` на адрес прокси (design D6 change `switch-models-to-deepseek-litellm`).
- [ ] По `CLAUDE.md`: PATCH метаданных Product заменяет словарь целиком, декларации Product/Source не перезаписывают сохранённые правки. Не проверено (требует мутации), в спеку не внесено.
- Снято: MCP OAuth (`MCP_CONNECT_SECRET`) — не проверяем (решение владельца); код `mcp_auth` остаётся.

## Расхождения с контекст-паком (целевое состояние)
- [ ] Свои маршруты (ADR-002): отложены до ядра. Противоречие в правилах снято: `AGENTS.md` разрешает продуктовые маршруты без LLM только через `base_app`; `overview` описывает текущее отсутствие маршрутов. → `core-*`.
- [ ] Продуктовое ядро (Д1–Д22, версии, чек-листы, граф связей, утверждения, журнал решений), Alembic, pytest — серия changes по вертикалям: Alembic + pytest + «документ и версия» → утверждение с маршрутом → граф связей и чек-листы. → `core-*`.
- [ ] Модели: DeepSeek (`deepseek-fast` / `deepseek-thinking`) через LiteLLM-прокси; `claude-engineer` — Claude Code на DeepSeek через прокси; `codex-engineer` снимается. → `switch-models-to-deepseek-litellm`.
- [ ] Эмбеддинги: у DeepSeek эмбеддингов в официальном API нет → GigaChat `Embeddings-2` (1024 изм.) через прокси. → `switch-models-to-deepseek-litellm`.
- [ ] Авторизация: Authentik (JWT по JWKS) — настроить, как только поднят `authorled-auth`. → `authentik-jwt`.
- [x] Shell и правка файлов: в `05-security-and-compliance.md` и `07-anti-patterns.md` разграничены инструменты разработки и продуктовый агент.
- [ ] Телеметрия: в коде `AgentOS(telemetry=False)` и `AGNO_TELEMETRY=false` в compose (рабочее дерево); спеки и документация не обновлены. → `remove-config-fallbacks`.
- [ ] ClamAV и фронтенд (Refine, CopilotKit, AG-UI) — дорожная карта, не расхождение: появятся вместе с загрузками и `authorled-web`.
- [ ] Valkey — закладывается в change первой рассылки продуктовых событий; при одной инстанции API не нужен.

## Расхождения кода и документации
- [ ] Ключи моделей в `README.md`, `AGENTS.md`, `example.env`, `docs/sandboxes.md`, скиллах `setup-platform`/`deploy-platform`, критерии `manager_explains_application`: нужны только DeepSeek, GigaChat и ключи прокси; `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` не нужны; в `example.env` — комментарий, кто использует каждый ключ. → `switch-models-to-deepseek-litellm` (tasks 4.x).
- [x] OpenAPI не объявляет схему безопасности для `/users*`, а в prd без токена — 401: факт записан в `api/identity`. Черновик issue в Agno подготовлен, не отправлен (нужно согласие владельца).
- [ ] `GET /config` → `available_models` и реестр расходились (opus против opus+sonnet): реестр теперь объявляет обе модели DeepSeek; проверить вживую. → `switch-models-to-deepseek-litellm` (task 6.1).

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
