# Design

## Context

Мотивация — в `proposal.md`, поведение — в дельте `runtime`.

- `scripts/validate.sh` вызывает `ruff`, `mypy`, `alembic` по имени. При пустом `VIRTUAL_ENV` он только печатает предупреждение. Сам `check_auth_boundary.sh` вызывает `python -c 'from app.auth.authorization import GROUP_SCOPES …'`.
- Локально без venv (Mac владельца, 2026-11-08):
  - `ruff` → `~/Library/Python/3.13/bin`;
  - `alembic` → `/Library/Frameworks/Python.framework/Versions/3.13/bin`;
  - `mypy` и `python` не находятся.
- CI (`validate.yml`): `actions/setup-python` (3.14) и `uv pip install --system` ставят пакеты в Python раннера. Его `python`, `ruff`, `mypy` и `alembic` лежат в одном `bin`, venv не активен.
- `agno/scripts/venv_setup.sh` создаёт `agno/.venv`, где те же четыре команды лежат в `agno/.venv/bin`.
- `check_auth_boundary.sh` ищет blueprint'ы и сервисы Authentik через `grep -r … .` с исключениями `.venv*`, `.git`, `tmp`, `node_modules`, `openspec`, `business-intents`. Рабочие копии агентов в `.claude/worktrees/` содержат копию `auth/` и попадают в находки. Каталог `.claude/` в git, кроме `commands/`, `settings.json` и ссылки `skills`, игнорируется.

## Goals / Non-Goals

**Goals:**
- Один признак «окружение проекта» и для venv, и для CI, без ветвления по `VIRTUAL_ENV`.
- Отказ до первой проверки, с причиной и подсказкой.

**Non-Goals:**
- Проверять версии инструментов поштучно против `requirements.txt`: единого каталога с `python`, где импортируются зависимости проекта, достаточно, чтобы не взять чужую установку.

## Decisions

1. **Признак окружения — один каталог `bin` у `python`, `ruff`, `mypy` и `alembic` плюс импорт зависимостей.**
   - Шаг `check_python_env` в начале `validate.sh`:
     - `command -v python`;
     - для каждого инструмента — `command -v` и сравнение `dirname` с каталогом `python` (через `realpath`, чтобы символические ссылки venv не давали ложных расхождений);
     - затем `python -c 'import agno, alembic, mypy'`. `ruff` в этом списке нет: его пакет не нужен для импорта, он проверяется только каталогом.
   - Любое расхождение — сообщение (что не так, откуда взято, что выполнить) и `exit 1`.
   - Альтернатива — требовать `VIRTUAL_ENV`. Отвергнута: CI работает без venv.
   - Альтернатива — подставлять `agno/.venv/bin` в `PATH`, если он есть. Отвергнута: это скрытый выбор окружения, запрещённый правилами.
   - Альтернатива — `uv run --with-requirements`. Отвергнута: медленнее и расходится с CI.
2. **Сравнение каталогов через `realpath` самого каталога, а не файла.** В venv `python` — символическая ссылка на интерпретатор `uv` вне venv, а `ruff`/`mypy`/`alembic` — обычные скрипты в `.venv/bin`. Сравнивается `realpath "$(dirname "$(command -v X)")"`, то есть каталог, в котором команду нашёл `PATH`, а не цель ссылки.
3. **`.claude` исключается целиком (`--exclude-dir='.claude'`) в обоих поисках `check_auth_boundary.sh`.** `--exclude-dir` сравнивает только имя каталога, поэтому `worktrees` в нём не указать без риска скрыть одноимённый каталог в другом месте. В закоммиченной части `.claude/` конфигурации Authentik нет и быть не должно.

## Risks / Trade-offs

- **На раннере CI инструмент окажется в другом каталоге.** Тогда CI упадёт на новом шаге. Смягчение: прогнать workflow на ветке до слияния (задача в tasks).
- **Будущий Python-инструмент в `validate.sh`** придётся добавить в список проверяемых. Список стоит рядом с проверкой, в одном месте.

## Migration Plan

Нет: изменение только в скриптах проверки, без данных и деплоя.
