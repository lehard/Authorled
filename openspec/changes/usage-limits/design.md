# Design

## Context

Мотивация в `proposal.md`, поведение в дельтах спек. Что важно для решения (проверено по коду и по Agno 3.1.10):

- Agno пишет у запуска `RunOutput.metrics` (`RunMetrics`): итоговые токены и разбивку `details["model"]` по моделям (`ModelMetrics.id` — псевдоним LiteLLM, `input_tokens`, `cache_read_tokens`, `output_tokens`, `cost`). Разбивка копится по ходу каждого вызова модели (`accumulate_model_metrics`), поэтому к post-hook она полная. `input_tokens` — это `prompt_tokens`, в него входят и токены из кэша (`prompt_tokens_details.cached_tokens`). В потоке Agno просит `stream_options.include_usage`, токены приходят и в AG-UI.
- `Agent(pre_hooks=..., post_hooks=...)`: pre-hook вызывается после загрузки сессии и до первого вызова модели, получает `run_context` и `session` (`AgentSession` с прошлыми запусками). Post-hook вызывается только у успешного запуска, после ответа модели и до сохранения.
- Agno **глотает** любое исключение хука, кроме `InputCheckError` и `OutputCheckError`: пишет `log_exception` и продолжает запуск (`agent/_hooks.py`). Если просто бросить `RuntimeError` из pre-hook, соавтор ответит без проверки лимита.
- При `InputCheckError` Agno ставит запуску статус `ERROR`, сохраняет его и шлёт `RunErrorEvent` с `content` = сообщение, `error_id` и `additional_data`. AG-UI превращает его в `RUN_ERROR` с `message` и `rawEvent` (словарь события, в нём `additional_data`).
- Упавший или отменённый запуск (исключение модели, отмена, обрыв связи) post-hook не вызывает, но Agno сохраняет его с накопленными метриками. Значит, одним post-hook такие запуски недоучитываются.
- Чат (`CoauthorChat.tsx`) любой `RUN_ERROR` показывает как «Соавтор не смог ответить: … Попробуйте ещё раз.» и возвращает вопрос в поле ввода.
- Хуки соавтора — код приложения: они читают объекты Agno (`RunOutput`, `AgentSession`) и вызывают операции ядра простыми данными, как инструменты соавтора. Ядро Agno не импортирует и схему `ai` не читает.
- Пользователь ядра находится по `auth_subject` = `sub` токена (`run_principal(run_context).user_id`).

## Goals / Non-Goals

**Goals:**
- Расход каждого запуска соавтора в рублях в журнале ядра, без дублей, в том числе у упавших и отменённых запусков.
- Лимит проверяется кодом ядра до вызова модели; любой сбой проверки — отказ запуска.
- Модель подписок, в которую `payments-tochka` добавит источник «Точка» и платное продление без переделки таблиц и операций.

**Non-Goals:**
- Платное продление, платежи, отмена и окончание платной подписки (это `payments-tochka`; здесь у источника, отличного от «выдана», окончание периода — явная ошибка).
- Точный учёт одновременных запросов одного пользователя и стоимость до запуска.

## Decisions

1. **Файлы данных в TOML рядом с ядром: `agno/core/plans.toml` и `agno/core/model_prices.toml`.** Читает стандартный `tomllib` с `parse_float=Decimal`, зависимостей не добавляется, комментарии в файле допустимы (откуда цена). Альтернатива — YAML: `pyyaml` пришёл бы прямой зависимостью и перегенерацией `requirements.txt`.
   Формат тарифов:
   ```toml
   signup_plan = "beta"          # тариф новых аккаунтов

   [plans.beta]
   name = "Бета"
   price_rub = 0                 # цена за период
   period_months = 1             # длина периода в месяцах
   limit_rub = 500               # лимит расхода за период
   purchasable = false           # можно ли купить
   ```
   Формат цен (рубли за 1M токенов, ключ — псевдоним LiteLLM):
   ```toml
   [models.deepseek-fast]
   input_rub = 30
   cache_read_rub = 0.6
   output_rub = 120
   ```
   Каждое поле обязательно, лишние поля, отрицательные числа, `period_months < 1`, код тарифа не из `[a-z0-9-]+` и `signup_plan` не из `[plans]` — ошибка с именем файла и поля. Файлы читаются один раз на процесс (`functools.cache`).

2. **Стоимость в рублях считает ядро по своим ценам.** `cost = ((input − cache_read)·input_rub + cache_read·cache_read_rub + output·output_rub) / 1 000 000`, `Decimal`, хранится `numeric(14, 6)`. `cache_read > input` — ошибка. Стоимость LiteLLM в долларах (`ModelMetrics.cost`) сохраняется как есть, только для сверки; её отсутствие — `NULL`, это не ошибка.
   Цены: курс 100 ₽ за доллар без наценки, полный прайс DeepSeek. Числа в файле — по решению владельца (см. Open Questions: официальная страница на 2026-11-07 расходится с интентом).

3. **Таблица `subscriptions`.**
   | колонка | тип | смысл |
   |---|---|---|
   | `id` | `uuid` PK | |
   | `user_id` | `uuid` → `users.id` (RESTRICT) | |
   | `plan` | `text` ≠ '' | код тарифа из `plans.toml` (не внешний ключ: тарифы — данные файла) |
   | `source` | `text`, CHECK `IN ('granted')` | источник: «выдана»; `payments-tochka` расширит CHECK своей миграцией |
   | `status` | `text`, CHECK `IN ('active', 'ended')` | |
   | `started_at` | `timestamptz` | начало подписки, якорь периодов |
   | `period_start`, `period_end` | `timestamptz`, `period_end > period_start` | текущий период `[start, end)` |
   | `ended_at` | `timestamptz` | есть тогда и только тогда, когда `status = 'ended'` |
   | `created_at`, `updated_at` | `timestamptz` | |

   Частичный уникальный индекс `ix_subscriptions_one_active (user_id) WHERE status = 'active'`: у пользователя не больше одной действующей подписки, база это держит сама. Закончившиеся подписки остаются строками истории.
   Альтернатива — колонки подписки в `user_settings`: тогда журнал не мог бы сослаться на подписку, а смена источника затирала бы прошлое.

4. **Таблица `usage_records`** — одна строка на запуск и модель.
   | колонка | тип |
   |---|---|
   | `id` | `uuid` PK |
   | `user_id` | `uuid` → `users.id` (RESTRICT) |
   | `subscription_id` | `uuid` → `subscriptions.id` (RESTRICT) |
   | `run_id`, `session_id`, `agent_id`, `model` | `text` ≠ '' |
   | `run_status` | `text`, CHECK `IN ('completed', 'error', 'cancelled')` |
   | `input_tokens`, `cache_read_tokens`, `output_tokens` | `bigint` ≥ 0, `cache_read_tokens <= input_tokens` |
   | `cost_rub` | `numeric(14, 6)` ≥ 0 |
   | `provider_cost_usd` | `numeric(14, 6)`, может быть пусто |
   | `occurred_at` | `timestamptz` — начало запуска |
   | `created_at` | `timestamptz` |

   Уникальность `(run_id, model)`: повторная запись того же запуска ничего не добавляет (`ON CONFLICT DO NOTHING`). Индекс `(subscription_id, occurred_at)` для суммы за период. Расход периода — сумма `cost_rub` строк подписки с `occurred_at` в `[period_start, period_end)`. Ни текста, ни почты в журнале нет; `session_id` — идентификатор беседы.

5. **Период и продление — лениво, в операции «текущая подписка».** Отдельного планировщика нет. `current_subscription(connection, user_id, now)` берёт действующую подписку `FOR UPDATE`; если `now >= period_end` и источник `granted`, сдвигает период вперёд, пока он не накроет `now` (пропущенные месяцы просто проходят). Если источник другой — ошибка `SubscriptionEnded` (платное продление делает `payments-tochka`). Конец периода: `started_at` плюс целое число месяцев тарифа, день месяца прижимается к последнему (31 января → 28 февраля → 31 марта), время суток — как у `started_at`.
   Продлевается по источнику, а не по цене: выданная администратором подписка бесплатна для пользователя при любом тарифе.

6. **Смена тарифа сохраняет период и расход.** `set_plan` меняет `plan` действующей подписки; лимит сразу берётся из нового тарифа, расход за период уже накоплен в журнале. Длина следующего периода — из нового тарифа.

7. **Подписка при создании аккаунта.** `get_or_create_user` в той же транзакции, где вставил `users`, вызывает `start_subscription(user_id, signup_plan, 'granted', users.created_at)`. Одновременные первые вызовы создают один аккаунт (уникальный `auth_subject`), значит и одну подписку. Для существующей записи подписка не создаётся: её дала миграция; нет подписки — ошибка `NoSubscription` при запуске соавтора.

8. **Миграция `0009_subscriptions_usage`.** Создаёт обе таблицы и вставляет каждой неудалённой записи `users` подписку `beta`/`granted`/`active` с `started_at = period_start = users.created_at`, `period_end = created_at + interval '1 month'` (Postgres прижимает конец месяца так же, как ядро). Дальше период догоняет ленивое продление. Код тарифа в миграции записан литералом: это данные на момент миграции.

9. **Хуки соавтора (`agno/agents/coauthor_usage.py`).**
   - **pre-hook `check_usage_limit(run_context, session)`**: в одной транзакции (a) дописывает в журнал прошлые запуски этой беседы, которых там нет (`completed`, `error`, `cancelled`, у которых есть `details["model"]`; текущий `run_id` пропускается), (b) проверяет лимит. Лимит исчерпан (`расход >= limit_rub`) → `InputCheckError("Лимит соавтора на этот период исчерпан. Он обновится 7 декабря.", CheckTrigger.INPUT_NOT_ALLOWED, additional_data={"reason": "usage_limit_reached", "renews_at": <ISO>})`. Дата — день `period_end` по Москве (UTC+3, без перехода на летнее время), месяц словами в родительном падеже.
   - Любое другое исключение pre-hook (нет аккаунта, нет подписки, неизвестный тариф, база) пишется в лог с типом и идентификаторами и превращается в `InputCheckError("Не удалось проверить лимит соавтора. Напишите в поддержку.", additional_data={"reason": "usage_check_failed"})` с исходным исключением в `__cause__`. Это не запасной путь: запуск не идёт, ошибка видна. Без перевода Agno проглотил бы её и пустил запуск без лимита.
   - **post-hook `record_usage(run_output, run_context)`**: пишет запуск в журнал. Нет `details["model"]` у завершённого запуска — ошибка «нет токенов». Любая ошибка записи превращается в `OutputCheckError("Не удалось записать расход соавтора. Напишите в поддержку.")`: запуск получает статус `ERROR` и событие ошибки, а не молчаливую запись в лог. Запуск с метриками остаётся в сессии, и следующий pre-hook допишет его.
   - Дозапись прошлых запусков закрывает недоучёт упавших и отменённых запусков в той же беседе. Запуск, после которого автор больше не писал в эту беседу, остаётся неучтённым — принятый риск беты.
   Альтернатива — подкласс модели DeepSeek, пишущий расход после каждого вызова: ловит больше, но лезет во внутренности Agno, которые меняются от версии к версии.

10. **Проверка при старте.** `agents/coauthor.py` при импорте читает оба файла и требует цену для `coauthor.model.id`; без неё API не стартует с ошибкой, называющей модель. Цену модели запуска ищет и операция записи: модель не из файла — ошибка с её именем.

11. **Сообщение в чате.** `runOrThrow` в `CoauthorChat.tsx` смотрит `rawEvent.additional_data.reason`: для `usage_limit_reached` показывает `message` как есть, без «Соавтор не смог ответить», в нейтральном стиле подсказки, а вопрос остаётся в поле. Остальные ошибки — как сейчас. Текст сообщения задаёт бэкенд.

12. **Администратор.** `python -m admin report|set-plan <почта> <тариф>` (`agno/admin/`) работает через операции ядра. `scripts/usage.sh local|prod <команда>` запускает его в контейнере `agentos-api` (`prod`: `docker compose -p authorled -f compose.yaml -f compose.prod.yaml exec -T agentos-api …` из `/srv/authorled/app`). Цель обязательна: скрипт не угадывает, где он. `report` в одной транзакции продлевает истёкшие выданные подписки (то же, что сделал бы запуск соавтора) и печатает по каждому неудалённому пользователю: почта, тариф, период, запросы (число запусков), токены (вход, кэш, выход), расход ₽, лимит ₽, остаток ₽, сумма LiteLLM $. `set-plan` ищет ровно одного неудалённого пользователя с этой почтой, иначе ошибка.

### Контракт для `payments-tochka`

Публичные операции ядра (`agno/core/`), все принимают `Connection` в транзакции вызывающего:

```python
# core/plans.py
@dataclass(frozen=True) class Plan: code, name, price_rub: Decimal, period_months: int, limit_rub: Decimal, purchasable: bool
def plans() -> Plans            # .signup: Plan; .get(code) -> Plan (UnknownPlan); .all() -> tuple[Plan, ...]
def prices() -> Prices          # .get(model) -> ModelPrice (UnknownModel)

# core/subscriptions.py
SOURCES = ("granted",); STATUSES = ("active", "ended")
@dataclass(frozen=True) class Subscription: id, user_id, plan, source, status, started_at, period_start, period_end
def start_subscription(connection, user_id, plan: str, source: str, start: datetime) -> Subscription
    # заканчивает действующую (status=ended, ended_at=start) и создаёт новую с первым периодом от start
def current_subscription(connection, user_id, now: datetime) -> Subscription
    # FOR UPDATE; продлевает выданную; NoSubscription, UnknownPlan, SubscriptionEnded (источник не granted, период истёк)
def next_period(connection, subscription_id) -> Subscription
    # сдвигает период на один вперёд от period_end; ядро вызывает её при продлении выданной, оплата — после подтверждённого платежа
def set_plan(connection, user_id, plan: str) -> Subscription
    # меняет тариф действующей подписки, период и расход сохраняются

# core/usage.py
def period_spend(connection, subscription: Subscription) -> Decimal
def check_limit(connection, subject: str, now: datetime) -> Allowance  # LimitReached(renews_at, spent, limit)
```

Чтобы добавить источник «Точка», `payments-tochka` своей миграцией расширяет CHECK `source` и, если нужно, `status`, и решает в `current_subscription`, что делать с истёкшей платной подпиской (сейчас — `SubscriptionEnded`).

## Risks / Trade-offs

- [Неучтённый последний упавший запуск беседы] → дозапись при следующем сообщении в беседе; остаток недоучёта виден сверкой с `ai.agno_runs` и счётом DeepSeek.
- [Одновременные запросы одного пользователя выходят за лимит] → допустимо для беты (интент). `FOR UPDATE` подписки упорядочивает проверки, но не ждёт окончания запусков.
- [Синхронные хуки в асинхронном запуске блокируют цикл событий на время короткого запроса к базе] → запросы по индексам; инструменты соавтора делают так же.
- [Сбой записи после ответа показывает ошибку под готовым ответом] → редкий случай; явная ошибка лучше тихого недоучёта.
- [Цены расходятся со счётом DeepSeek: пиковые и ночные тарифы] → считаем по одной цене из файла; сверка — колонка в долларах и счёт DeepSeek.

## Migration Plan

Деплой обычным релизом: `agentos-migrate` применяет `0009` до старта API. Отката нет (миграции только вперёд); при ошибке в файлах данных API не стартует, исправление — новым релизом.

## Open Questions

- Цены моделей: официальная страница DeepSeek (журнал изменений от 2026-10-17) даёт `deepseek-flash` $0.3 / $0.006 / $1.2 за 1M (вход / кэш / выход) в пиковые часы и вдвое меньше вне пика; `deepseek-v4-pro` $1.32 / $0.044 / $3.96 и вдвое меньше вне пика. Интент называет 14 / 2,8 / 28 ₽ и 174 / ? / 348 ₽. Вопрос передан владельцу; до ответа в файле пиковые цены (рекомендация: они не занижают расход).
