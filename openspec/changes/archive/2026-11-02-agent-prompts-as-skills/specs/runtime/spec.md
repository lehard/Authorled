## MODIFIED Requirements

### Requirement: Образы
`agno/Dockerfile` MUST собираться с контекстом — корнем репозитория. Он MUST собирать общую базу `agnohq/python:3.14` с `uv pip sync` по `agno/requirements.txt` и две цели:
- `agentos` (по умолчанию): весь контекст сборки в `/app`, рабочий каталог и `PYTHONPATH` — `/app/agno`, entrypoint `/app/agno/scripts/entrypoint.sh`, CMD `uvicorn app.main:app --host 0.0.0.0 --port 8000`;
- `sandbox`: пользователь UID 1000, порт 8080, `python -I -m agno.sandbox.agentcore.server serve`.

`.dockerignore` в корне репозитория MUST исключать `.env*`, `.claude/`, `.codex/`, `tmp/`, `web/` и выгруженные ключи `auth/jwks/jwks.json*` и MUST оставлять `.agents/skills/`, `agno/skills/`, `AGENTS.md` и `openspec/`.

#### Scenario: Сборка sandbox
- WHEN выполняется `docker build --target sandbox --load -t agno-sandbox:local -f agno/Dockerfile .` из корня репозитория
- THEN MUST собираться образ, используемый `docker_sandbox()`

#### Scenario: Состав образа API
- GIVEN образ цели `agentos` собран
- WHEN перечисляется содержимое `/app`
- THEN MUST присутствовать `/app/AGENTS.md`, `/app/.agents/skills/`, `/app/openspec/`, `/app/agno/app/main.py` и `/app/agno/skills/coauthor/SKILL.md`
- AND `/app/web` и `/app/.env` MUST отсутствовать
