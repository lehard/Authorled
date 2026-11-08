# Бизнес-интент: `dev.sh` называет сбой `docker compose`, а не «сервис не запущен»

Статус: решения согласованы с владельцем 2026-11-08; change `dev-sh-compose-errors` создан 2026-11-08 (`openspec/changes/dev-sh-compose-errors/`), ждёт `/opsx:apply`. Владелец: lehard. Обновлено: 2026-11-08.
Рамки: спека `runtime` («`scripts/dev.sh`», «Демо-контент»), спека `auth` («Пользователи для разработки»), `openspec/context/07-anti-patterns.md` (п. 26: fallback-и).

## Why

При завершении `eval-verified-caller` (2026-11-08) владелец запустил `./scripts/dev.sh auth-users` из worktree `.claude/worktrees/payments-tochka-a9b7da`. Compose напечатал «required variable CLOUDRU_API_KEY is missing a value», а следом `dev.sh` сообщил «mailpit is not running». Второе сообщение увело в сторону: стенд работал, сломалось чтение конфигурации.

Причина — проверки вида `[[ -n "$(docker compose ps -q --status running mailpit)" ]] || fail "... is not running"`. Если сама команда `docker compose ps` падает, подстановка даёт пустую строку, и сбой compose выдаётся за «сервис не запущен». Так устроены проверка `mailpit` в `auth-users` и проверки `agentos-db` и `authentik-worker` в `seed`.

Воспроизведено 2026-11-08 на копии `scripts/dev.sh` и compose-файлов во временном каталоге (стенд `authorled` не трогали):

| Ситуация | Что видит человек | Код |
|---|---|---|
| в `.env` нет `CLOUDRU_API_KEY`, `auth-users` | ошибка compose, затем «mailpit is not running» | 1 |
| то же, `seed` | ошибка compose, затем «agentos-db is not running» | 1 |
| `.env` полный, команда запущена из worktree | «mailpit is not running» | 1 |

Третий случай — вторая ловушка. В `compose.yaml` нет `name:`, поэтому проект Compose называется по каталогу (`usage-limits-0a1ec9`, `payments-tochka-a9b7da`). У такого проекта нет контейнеров, а локальный стенд работает в проекте `authorled` из основной рабочей копии. Сообщение не говорит, в каком проекте искали сервис.

Тот же класс ошибки есть в `seed` ещё в одном месте: чтение пользователей разработки из Authentik (`docker compose exec -T authentik-worker ak shell ... | sed ... || true`) глушит любой сбой. Если `exec` не смог запуститься, человек видит «no development users in Authentik: run ./scripts/dev.sh auth-users» вместо настоящей причины. Сейчас `|| true` нужен потому, что `User.objects.get` падает, когда пользователей нет, и этот отказ неотличим от сбоя `exec`.

Правила проекта (07-anti-patterns, п. 26) и владельца («без fallback, падать явно с названием причины») требуют, чтобы сбой назывался своим именем.

## What Changes

1. **Общая проверка запущенного сервиса в `dev.sh`** для `auth-users` (`mailpit`) и `seed` (`agentos-db`, `authentik-worker`):
   - если `docker compose ps` завершился с ошибкой, скрипт сразу завершается кодом `1` с сообщением, что `docker compose` не смог прочитать конфигурацию (его ошибка выше) и что нужно исправить `.env`; сообщение «не запущен» в этом случае не печатается;
   - если compose отработал, а сервиса нет среди запущенных, сообщение называет проект Compose и каталог, например: «mailpit is not running in Compose project usage-limits-0a1ec9 (/путь): run the command from the checkout of the local stand or start it (docker compose up -d)». Имя проекта берётся из `docker compose config` (строка `name:`), как `reset-db` уже берёт оттуда имя тома.
2. **Чтение пользователей разработки в `seed` без `|| true`.** Запрос в `ak shell` сам сообщает, кого из `writer` и `editor` нет (например, через выборку по списку имён вместо `get`), и печатает результат одной строкой. Тогда:
   - сбой `docker compose exec` или `ak shell` останавливает скрипт с его ошибкой и сообщением `dev.sh`, называющим этот шаг;
   - сообщение «no development users in Authentik: run ./scripts/dev.sh auth-users» остаётся только для случая, когда запрос отработал, а пользователей нет.
3. **Спека `runtime`, требование «`scripts/dev.sh`».** Добавить правило: сбой самой команды `docker compose` MUST сообщаться как сбой compose, а не как «сервис не запущен»; сообщение «не запущен» MUST называть проект Compose и каталог. Сценарии: «Compose не может прочитать конфигурацию», «Сервис не запущен в проекте этого каталога», «Сбой чтения пользователей Authentik в `seed`».

## Scope

- `scripts/dev.sh`: общая проверка сервиса для `auth-users` и `seed`; чтение пользователей в `seed` без `|| true`.
- Спека `runtime`, требование «`scripts/dev.sh`» (и сценарий «Демо-контент» про `auth-users`, если меняется формулировка).
- Проверка на копии файлов во временном каталоге, без изменений на работающем стенде: `.env` без обязательной переменной; полный `.env` в каталоге с другим проектом Compose; на стенде — обычные `auth-users` и `seed` проходят как сейчас (их запускает владелец). Результат в `tmp/VERIFY.md`.

## Non-goals

- Сам переключаться на проект `authorled` или искать «правильный» стенд через `docker compose ls`: это угадывание, которое правила запрещают.
- Добавлять `name:` в `compose.yaml`: тогда каждый worktree управлял бы общим стендом, а его не должны перезапускать другие сессии.
- Менять остальные команды `dev.sh` (`db`, `api`, `migrate`, `test`, `stop`, `reset-db`, `psql`): они вызывают compose напрямую под `set -euo pipefail` и уже останавливаются с его ошибкой.
- Проверять заполненность `.env` в `dev.sh` до вызова compose: обязательные переменные уже проверяет сам `compose.yaml` (`${VAR:?...}`), дублировать список не нужно.

## Constraints (из контекст-пака)

- Без fallback: сбой compose — явная ошибка с названием, а не подмена другим сообщением (07-anti-patterns, п. 26).
- Работающий стенд `authorled` в основной рабочей копии используют другие сессии: проверка не перезапускает и не пересоздаёт его контейнеры.
- Секреты из `.env` в вывод не попадают.

## Acceptance criteria

- `.env` без `CLOUDRU_API_KEY`: `./scripts/dev.sh auth-users` и `./scripts/dev.sh seed` завершаются кодом `1`, после ошибки compose печатают сообщение про сбой `docker compose` и не печатают «is not running».
- Полный `.env` в каталоге, где стенд не запущен: сообщение «… is not running» называет проект Compose и каталог.
- `seed`, когда `authentik-worker` запущен, а `auth-users` не выполнялся: сообщение про `./scripts/dev.sh auth-users`, база не меняется (как сейчас по спеке).
- `seed`, когда `docker compose exec` в `authentik-worker` падает: скрипт завершается кодом `1` с сообщением про этот шаг, а не про `auth-users`.
- На работающем стенде из основной рабочей копии `auth-users` и `seed` ведут себя как сейчас.

## Risks

- **Формат вывода `docker compose config`.** Имя проекта берём из строки `name:`; если формат изменится в другой версии Compose, скрипт не найдёт имя. Смягчение: при пустом имени — явная ошибка, а не сообщение без проекта.
- **Вывод `ak shell` смешан с логами.** Строку результата уже отличают префиксом `DEMO_USERS`; новый формат должен сохранить префикс.

## Open Questions

- Решено 2026-11-08: в тот же change входит чтение пользователей в `seed` без `|| true`; автоматический выбор проекта `authorled` и `name:` в `compose.yaml` не делаем.

## References

- Сообщение владельца при `eval-verified-caller` 2026-11-08: «required variable CLOUDRU_API_KEY is missing a value», затем «mailpit is not running».
- `scripts/dev.sh`: проверки `docker compose ps -q --status running` в `auth-users` и `seed`, чтение пользователей с `|| true` в `seed`, `docker compose config` в `reset-db`.
- `agno/compose.yaml`, `auth/compose.yaml`: обязательные переменные `${VAR:?...}`; `compose.yaml` без `name:`.
- Спеки `runtime` («`scripts/dev.sh`», «Демо-контент») и `auth` («Пользователи для разработки»).
