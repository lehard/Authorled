# TODO: недокументированное и расхождения

Мастер-спецификация пересоздана 2026-10-24. Источники: код репозитория, `GET /openapi.json` и runtime-ответы локального инстанса (`agno 3.1.10`, `RUNTIME_ENV=dev`), отдельный запуск с `RUNTIME_ENV=prd` и одноразовым ключом JWT, `tools/list` MCP. Контекст-пак `openspec/context/` прочитан; он описывает целевое состояние.

## Не покрыто или покрыто частично
- [ ] Эндпоинты `openspec/specs/api/*` описаны по OpenAPI: параметры, поля тела с типами, перечислениями и значениями по умолчанию, схема успешного ответа и объявленные коды ошибок. Вживую проверены только: 404 для неизвестных agent/team/workflow/session, 422 для `GET /agents/{id}/runs` без `session_id`, 401 в prd, списки Products/Routines/Sources/Schedules/Registry/Queue. Остальные негативные сценарии взяты из объявлений OpenAPI.
- [ ] Не описаны структуры ответов без схемы в OpenAPI (например, `POST /agents/{agent_id}/runs` объявляет пустую схему JSON) и типы SSE-событий (кроме примера `RunStarted`).
- [ ] Допустимые значения `status` у Approval (`ApprovalResolve.status` — свободная строка), у Schedule run и Queue job в OpenAPI не перечислены.
- [ ] Правила переходов Task/Project (какие `target` допустимы из какого статуса) не проверены: известны только перечисления `target`.
- [ ] Агенты `platform-builder-internal` и `platform-manager-internal` (участники `os-manager-internal`) задаются библиотекой; их инструкции и инструменты не описаны.
- [ ] Slack описан только по коду `app/interfaces.py`; живая интеграция не запускалась.
- [ ] MCP OAuth (`MCP_CONNECT_SECRET`) и вызов `agno` с промптом не проверялись (тратят модель / требуют секрет).
- [ ] Docker/AgentCore sandbox не запускались; поведение описано по `app/sandbox.py`.
- [ ] По `CLAUDE.md`: PATCH метаданных Product заменяет словарь целиком, а декларации Product/Source не перезаписывают сохранённые правки. Не проверено (требует мутации), в спеку не внесено.

## Расхождения с контекст-паком (целевое состояние)
Код верен для текущего состояния; переход — отдельными changes.
- [ ] Свои маршруты: контекст (ADR-002) требует продуктовые маршруты `/api/v1/` через `base_app`; в коде маршрутов нет, `overview` фиксирует их отсутствие. `CLAUDE.md` и `AGENTS.md` тоже запрещают свои маршруты.
- [ ] Продуктовое ядро (Д1–Д22, версии, чек-листы, граф связей, утверждения, журнал решений), Alembic, pytest — в коде отсутствуют.
- [ ] Модели: контекст требует вызовы только через LiteLLM без захардкоженных моделей; код вызывает Anthropic напрямую (`app/settings.py`), инженеры хардкодят `claude-opus-5-5` и `gpt-6.1-sol`.
- [ ] Эмбеддинги: контекст запрещает зарубежные эмбеддинги; код использует OpenAI `text-embedding-3-small` (`db/__init__.py`).
- [ ] Авторизация: контекст — Authentik (JWT по JWKS); код поддерживает `JWT_JWKS_FILE`, но связка с Authentik не настроена.
- [ ] Shell и правка файлов: контекст запрещает продуктовому агенту shell/код/свободную ФС; инженеры имеют `permission_mode="acceptEdits"` и `sandbox_mode="workspace-write"` (это инструменты разработки, не продуктовый агент — разграничить).
- [ ] Телеметрия: контекст требует выключить телеметрию Agno; в коде и env явного отключения нет.
- [ ] Valkey, ClamAV, фронтенд (Refine, CopilotKit, AG-UI) — в коде отсутствуют.

## Расхождения кода и документации
- [ ] `README.md` (строки 58, 188, 279), `AGENTS.md:53`, `.agents/skills/setup-platform/SKILL.md:39` и критерий `manager_explains_application` в `evals/cases.py` требуют только `OPENAI_API_KEY`; после перехода на Claude OS Manager нужен `ANTHROPIC_API_KEY`. Таблица в `README.md:284` уже верна.
- [ ] `example.env` помечает оба ключа как «Required».
- [ ] OpenAPI не объявляет схему безопасности для `/users*`, хотя в prd все методы возвращают `401` без токена.
- [ ] `GET /config` → `available_models` содержит только `claude-opus-5-5`, а реестр — `claude-opus-5-5` и `claude-sonnet-5-5`.

## Существующие fallback-и (по правилу «без fallback» — на решение владельца)
- [ ] `db/url.py`: значения по умолчанию `ai`/`ai`, `localhost:5432`, `ai` подставляются при отсутствии `DB_*`.
- [ ] `app/main.py`: `RUNTIME_ENV` по умолчанию `prd`, `AGENTOS_URL` по умолчанию `http://127.0.0.1:8000`.
- [ ] `app/registry.py`: при отсутствии `PARALLEL_API_KEY` веб-инструмент молча переключается на бесключевой MCP Parallel.
- [ ] `evals/__main__.py`: `RUNTIME_ENV` по умолчанию `dev`.

## Замечания по качеству
- [ ] FastAPI предупреждает `Duplicate Operation ID get_config for function get_config_version` (библиотека Agno, `agno/os/routers/components/components.py`): у двух операций Components одинаковый operationId.
- [ ] `python -m app.main` слушает `127.0.0.1`, контейнер — `0.0.0.0`.
- [ ] Спеки API длинные (OpenSpec выдаёт INFO «Requirement text is very long»); при необходимости разбить домены.
