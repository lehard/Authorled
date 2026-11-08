# Design

## Context

Мотивация — в `proposal.md`, поведение — в дельте `runtime`.

- `scripts/dev.sh` работает под `set -euo pipefail` и в начале переходит в корень репозитория. Под `set -e` ошибка подстановки внутри `[[ -n "$(...)" ]]` скрипт не останавливает, поэтому сбой `docker compose ps` превращается в пустую строку.
- Проверки сервисов: `mailpit` в `auth-users`, цикл по `agentos-db` и `authentik-worker` в `seed`. Остальные команды вызывают compose напрямую (`up`, `run`, `exec`, `stop`), и `set -e` останавливает их с ошибкой compose.
- В `compose.yaml` нет `name:`, поэтому проект Compose называется по каталогу. Проверено 2026-11-08: `docker compose config` печатает первой строкой `name: <проект>`; `reset-db` уже читает из этого вывода имя тома через `awk`.
- `seed` читает пользователей так: `people="$(docker compose exec -T authentik-worker ak shell -c '... User.objects.get(...) ... print("DEMO_USERS " + json.dumps([...]))' | sed -n 's/^DEMO_USERS //p' || true)"`. `get` падает, если пользователя нет, а `|| true` нужен, чтобы этот случай дошёл до сообщения про `auth-users`. Тем же путём глушится и сбой `exec`. Вывод `ak shell` смешан с логами Authentik, поэтому у строки результата префикс. `python -m demo` читает из stdin JSON-список `{subject, email, name}`.

## Goals / Non-Goals

**Goals:**
- Одна функция проверки сервиса для обеих команд: три исхода (сбой compose, сервис не запущен, запущен) с разными сообщениями.
- Чтение пользователей в `seed` с двумя исходами без подавления ошибок: сбой шага или список отсутствующих.

**Non-Goals:**
- Менять формат входа `python -m demo`.
- Проверять, что сервис `healthy`, а не только `running`: сейчас проверяется только `running`, и спека большего не требует.

## Decisions

1. **Функция `require_running <сервис> <команда>` в `dev.sh`.**
   - Объявление `local` отдельно от присваивания, затем `ids="$(docker compose ps -q --status running "$service")" || fail "..."`. Так код возврата compose не теряется (у `local x="$(...)"` код возврата — от `local`).
   - Сбой compose: `fail` с текстом вроде «docker compose failed (its error is above), so <сервис> was not checked: fix .env (compose.yaml requires every variable it names)». Ошибку compose скрипт не перехватывает и не переписывает: она уже в stderr.
   - Пусто: имя проекта читается из `docker compose config` (`sed -n 's/^name: //p'`, первая строка), затем `fail "<сервис> is not running in Compose project <проект> (<каталог>): <команда> needs the local stand; run it from the checkout where the stand runs, or start it (docker compose up -d)."`. Если имя не нашлось, это отдельная явная ошибка, а не сообщение без проекта.
   - Альтернатива — проверять `docker compose config -q` один раз в начале каждой команды. Отвергнута: две проверки одного и того же, а ошибку `ps` всё равно надо обрабатывать.
   - Альтернатива — назвать в сообщении проекты из `docker compose ls`. Отвергнута: это подсказка «правильного» стенда угадыванием, интент её исключил.
2. **Пользователи в `seed`: выборка по списку имён и две строки результата.**
   - В `ak shell` `User.objects.filter(username__in=("writer", "editor"))` вместо `get`. Печатаются `DEMO_MISSING <имена через пробел>` (пустая, если все есть) и `DEMO_USERS <JSON>` (только найденные, формат прежний).
   - В bash вывод сначала целиком сохраняется в переменную: `output="$(docker compose exec ...)" || fail "reading the development users from Authentik (authentik-worker) failed; its error is above."`. Затем из него берутся обе строки через `sed`.
   - Нет строки `DEMO_MISSING` или `DEMO_USERS` — явная ошибка «ak shell printed no result line». Непустой `DEMO_MISSING` — прежнее сообщение «no development users in Authentik (<имена>): run ./scripts/dev.sh auth-users.».
   - Альтернатива — убрать `|| true` и оставить `get`. Отвергнута: тогда отсутствие пользователей превращается в traceback, и сценарий «Нет пользователей разработки» перестаёт называть `auth-users`.
   - Альтернатива — разбирать JSON в bash. Отвергнута: отдельная строка с именами проще и не требует `jq`.

## Risks / Trade-offs

- [Формат `docker compose config` изменится, строки `name:` не будет] → явная ошибка с названием шага; сообщение не теряет смысл молча.
- [Сбой `exec` проверить на живом стенде нельзя, не останавливая чужие контейнеры] → проверка на копии файлов с заглушкой `docker` в `PATH`, которая отвечает на `ps` и падает на `exec`; реальный сбой compose — на копии с неполным `.env`.
- [Логи Authentik однажды начнутся с `DEMO_`] → префиксы с подчёркиванием и в начале строки; риск тот же, что у нынешнего `DEMO_USERS`.

## Migration Plan

Нет: изменение только в скрипте локальной разработки, без данных и деплоя.
