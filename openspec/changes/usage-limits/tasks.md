# Tasks

## 1. Данные и база

- [ ] 1.1 Добавить `agno/core/plans.toml` (тариф `beta`, `signup_plan`) и `agno/core/model_prices.toml` (`deepseek-fast`, `deepseek-thinking` по решению владельца о ценах), `agno/core/plans.py` с проверкой файлов и расчётом стоимости; тесты: формат, пропущенное и лишнее поле, неизвестный тариф и модель, расчёт 0,4224 ₽
- [ ] 1.2 Описать `subscriptions` и `usage_records` в `agno/core/tables.py`, написать миграцию `0009_subscriptions_usage` с подписками для существующих пользователей; тесты: совпадение с базой, ограничения таблиц, миграция с 0008 на базе с пользователем

## 2. Подписки и журнал в ядре

- [ ] 2.1 Добавить `agno/core/subscriptions.py`: `start_subscription`, `current_subscription` с ленивым продлением выданной, `next_period`, `set_plan`, прибавление месяцев с прижатием дня; тесты: 31 января, конец периода, пропущенные месяцы, нет подписки, неизвестный тариф, чужой источник
- [ ] 2.2 Создавать подписку `signup_plan` в `get_or_create_user` (`agno/core/users.py`); тесты: первый вызов даёт одну подписку от `created_at`, повтор не добавляет
- [ ] 2.3 Добавить `agno/core/usage.py`: запись запуска без дублей, расход периода, проверка лимита, отчёт; тесты: одна строка на запуск, сумма за период, исчерпанный лимит, смена тарифа сразу меняет лимит, запуск без токенов, модель без цены

## 3. Соавтор

- [ ] 3.1 Добавить `agno/agents/coauthor_usage.py`: pre-hook (дозапись прошлых запусков беседы и проверка лимита, отказы `usage_limit_reached` и `usage_check_failed`) и post-hook (запись, ошибки как `OutputCheckError`); подключить в `agno/agents/coauthor.py` с проверкой цены модели при старте; тесты на объектах Agno без модели: запись, дозапись отменённого, отказ по лимиту с датой «7 декабря», отказ без подписки
- [ ] 3.2 Показать сообщение об исчерпанном лимите в `web/src/screens/project/chat/CoauthorChat.tsx` по `rawEvent.additional_data.reason`; проверить `npm run lint`, `typecheck`, `build`

## 4. Администратор

- [ ] 4.1 Добавить `agno/admin/__main__.py` (`report`, `set-plan`) и `scripts/usage.sh local|prod`; тесты операций отчёта и смены тарифа по почте (нет почты, две записи с одной почтой)

## 5. Документы и проверки

- [ ] 5.1 Обновить `AGENTS.md` (файлы ядра, данные тарифов, скрипт администратора) и README (раздел про расход и тарифы)
- [ ] 5.2 Перенести дельты в мастер-спеки (`core/subscriptions`, `core/database`, `api/me`, `api/agents`, `web/workspace`)
- [ ] 5.3 Пройти `./scripts/validate.sh`, `./scripts/dev.sh test`, `git diff --check`; записать проверки и непроверенное (запуск с моделью, сервер) в `tmp/VERIFY.md`

## Workflow follow-up

- После релиза: на сервере `./scripts/usage.sh prod report` и сверка токенов с `ai.agno_runs`.
- `/opsx:verify` и `/opsx:archive` — по решению владельца.
