# Tasks

## 1. Модуль и данные биллинга

- [x] 1.1 Создать `agno/billing/`: перенести `core/plans.py`, `core/subscriptions.py`, `core/usage.py`, `plans.toml`, `model_prices.toml` без изменения правил. Описать `subscriptions` и `usage_records` в `billing/tables.py` (свой `MetaData(schema="billing")`, тот же `naming_convention`, `user_id` без `ForeignKey`) и убрать их из `core/tables.py`. Добавить `billing/connection.py` и `billing/engine.py` (design D5, D6). Проверка: `python -c "import billing"` из `agno/` без импорта `core` (`python -X importtime` не показывает `core.`).
- [x] 1.2 Написать интерфейс `billing/__init__.py` по design D2: каждая операция в своей транзакции, `ensure_subscription` с `pg_advisory_xact_lock` и правилом «ни одной подписки», `record_runs` одной транзакцией, `run_session` с `RunNotFound`, `report(user_ids, at)` без почт. Проверка: `mypy` по `agno/` проходит.
- [x] 1.3 Добавить схему `billing` в `agno/db/init.sql`. Сделать цепочку Alembic биллинга (`billing/alembic.ini`, `billing/migrations/env.py` с журналом в `billing`) и миграцию `b0001_from_core` (проверка таблиц в `authorled` с явной ошибкой, `SET SCHEMA`, снятие двух внешних ключей на `users`, design D7). Проверка: на локальной базе `alembic -c billing/alembic.ini upgrade head` переносит таблицы, повторный запуск ничего не меняет.
- [x] 1.4 Применять обе цепочки: `agentos-migrate` в `agno/compose.yaml` (ядро, потом биллинг), `scripts/dev.sh test`; проверить, что `compose.prod.yaml` берёт ту же команду. Проверка: `./scripts/dev.sh migrate` завершается `0`, в `billing.alembic_version` стоит `b0001_from_core`.
- [x] 1.5 Перенести тесты в `agno/tests/` на `billing`: `test_plans.py`, `test_subscriptions.py`, `test_usage.py` (внутренние функции на фикстуре `connection`). Добавить фикстуру `billing_alembic_config`. Новые тесты:
  - интерфейс: `ensure_subscription` один раз, при действующей и при закончившейся подписке ничего не меняет; одновременные вызовы дают одну подписку; `record_runs` атомарна; `run_session` для чужого запуска даёт `RunNotFound`; `report` без почт;
  - перенос `b0001`: строки и `id` сохраняются, таблиц в `authorled` нет;
  - схема `billing` принадлежит `agentos` и не имеет внешних ключей в другие схемы;
  - описание таблиц биллинга совпадает с базой;
  - у цепочки биллинга одна голова.

  Проверка: тесты биллинга в `./scripts/dev.sh test` проходят.

## 2. Ядро без биллинга

- [x] 2.1 Убрать выдачу подписки из `core/users.get_or_create_user`, добавить `created_at` в `Account`. Перенести `user_id_by_email` из `core/usage.py` в `core/users.py`, добавить там список неудалённых аккаунтов с почтами для отчёта. Проверка: `test_accounts.py` и `test_users.py` проходят, `get_or_create_user` больше не создаёт строк в `billing.subscriptions`.
- [x] 2.2 Переписать `tests/test_migrations.py` на две цепочки: перед откатом ядра удалять таблицы биллинга и очищать `billing.alembic_version`, после `upgrade head` ядра применять `upgrade head` биллинга (design D10). Очистку в `tests/routes.py`, `test_accounts.py` и `test_stories_core.py` перевести на таблицы биллинга. Проверка: `./scripts/dev.sh test` проходит целиком.

## 3. Связь через слой приложения

- [x] 3.1 В `app/api/me.py` после `get_or_create_user` вызывать `billing.ensure_subscription(account.id, account.created_at)` без перехвата ошибок. Проверка: тесты в `test_me_routes.py` проходят — первый вызов даёт одну подписку `beta` в `billing.subscriptions`, повтор не меняет число строк, вызов после упавшей выдачи выдаёт подписку.
- [x] 3.2 В `agents/coauthor.py` проверять файлы данных и цену модели через `billing`. В `agents/coauthor_usage.py` находить `user_id` через `core.users.active_user_id`, затем вызывать `billing.recorded_run_ids`, `record_runs` и `check_limit`; признаки и тексты отказов не менять. Проверка: `test_coauthor_usage.py` проходит — лимит, дозапись отменённого, нет подписки, закончившаяся подписка.
- [x] 3.3 В `admin/__main__.py` строить `report` из `billing.report` по списку аккаунтов ядра и подставлять почты; `set-plan` выполнять через `core.users.user_id_by_email` и `billing.set_plan`. Обновить ссылку на спеку в `scripts/usage.sh`. Проверка: тесты команд администратора проходят, вывод `report` по колонкам не изменился.
- [x] 3.4 Выдавать подписку через `billing.ensure_subscription` в `demo/__main__.py` и `evals/coauthor/user.py`, перевести импорты `ModelPrice` и `prices` в `evals/coauthor/` и `evals/routing/` на `billing`. Проверка: `test_demo.py` и `test_coauthor_eval.py` проходят, `python -m evals.coauthor --help` стартует.

## 4. Граница и документация

- [x] 4.1 Добавить `scripts/check_billing_boundary.sh` по design D9 и вызвать его из `scripts/validate.sh`. Добавить в `validate.sh` проверку одной головы цепочки биллинга. Проверка: `./scripts/validate.sh` проходит. Временное нарушение — `import billing` в файле `agno/core/` и `from core import users` в `agno/billing/` — роняет проверку с названием файла; после проверки нарушение убрать.
- [x] 4.2 Обновить `AGENTS.md` (раздел «Where changes belong»: `agno/billing/`, его миграции, проверка границы; убрать биллинг из описания `agno/core/`), README (пути к `plans.toml` и `model_prices.toml`, команда миграций) и `openspec/context/03-architecture.md` (модуль биллинга, схема `billing`). Проверка: `grep -rn "core/plans\|core/usage\|core/subscriptions\|core/model_prices\|core/plans.toml" README.md AGENTS.md openspec/context scripts` ничего не находит.

## 5. Проверка целиком

- [x] 5.1 Пройти `./scripts/validate.sh`, `./scripts/dev.sh test` и `git diff --check`. Применить миграции на копии локальной базы `ai` с данными (`./scripts/dev.sh migrate`), сверить число строк подписок и журнала до и после, вызвать соавтора в локальном API и проверить новую строку в `billing.usage_records`. Записать результаты в `tmp/VERIFY.md` отдельно: static, deterministic, model, container, hosted (последнее — «не проверено до релиза»). Живой запрос к соавтору перенесён на проверку после релиза (решение владельца 2026-11-09): локально он требует мигрировать общую `ai`, где работает API основной копии.

## Workflow follow-up

- После архивации проверить, что `openspec/specs/core/subscriptions/` удалена (`retire_capabilities: true`), а `openspec/specs/billing/subscriptions` и `billing/module` созданы.
- После релиза проверить сервер по шагу 3 «Migration Plan» из `design.md`, включая живой запрос к соавтору и новую строку в `billing.usage_records`, и дописать hosted-результат в `tmp/VERIFY.md` и статус в `business-intents/billing-module.md`.
- Перенести ветку `claude/payments-tochka-a9b7da` на модуль биллинга в своём change.
- Оценки ответов (`coauthor-mentor-checks`): кто вливается вторым, переводит `core/feedback.py` на `billing.run_session` вместо чтения `usage_records` и маршрут `app/api/feedback.py` — на передачу беседы в ядро (design D8). Сессию этого change предупредить.
