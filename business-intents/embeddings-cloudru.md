# Бизнес-интент: эмбеддинги базы знаний через Cloud.ru Foundation Models

Статус: решения согласованы с владельцем 2026-11-08; change `switch-embeddings-to-cloudru` реализован, выпущен в v0.2.1 и проверен на сервере 2026-11-08 (эмбеддинги 1024 через прокси, загрузка и поиск в базе знаний), `SBER500_*` удалены из env сервера; осталось архивировать change (`/opsx:archive`). Владелец: lehard. Обновлено: 2026-11-08.
Рамки: ADR-003 (модели только через LiteLLM-прокси, приложение знает только псевдонимы), `openspec/context/05-security-and-compliance.md` (эмбеддинги только в РФ или свои), мастер-спеки `integrations` («Эмбеддинги через шлюз Sber500», «Выбор модели эмбеддингов»), `llm-gateway`, `api/knowledge`. Предыдущий шаг — архивный change `2026-10-29-switch-embeddings-to-sber500`.

## Why

Эмбеддинги базы знаний сейчас идут через общий шлюз Sber500, а он больше не работает. 2026-11-08 и локально, и на сервере шлюз отвечает `429 budget_exceeded`: ключ, который выдали стартапу менторы, израсходовал свой бюджет. Риск «доступ к шлюзу не принадлежит проекту» из design прошлого change сработал. GigaChat API по ключу физлица отвечает `402`, так что запасного рабочего псевдонима тоже нет.

Владелец завёл свой платный аккаунт в Cloud.ru Evolution: сервисный аккаунт `coauthor-embeddings`, роли «Пользователь сервисов» и `ml_inference_ai_marketplace.apikey-limit.user`, ключ Foundation Models, баланс пополнен. Cloud.ru — российское облако, API совместим с OpenAI. В каталоге есть те же три модели, что были на шлюзе.

Живая проверка 2026-11-08 (`https://foundation-models.api.cloud.ru/v1`, ключ не печатался):

| Модель Cloud.ru | Размерность | Токенов на 5000 символов русского текста | Предел входа |
| --- | --- | --- | --- |
| `ai-sage/Giga-Embeddings-instruct-480M` | 1024 | 1123 | 8192 токена |
| `BAAI/bge-m3` | 1024 | 1495 | 8192 токена |
| `Qwen/Qwen3-Embedding-0.6B` | 1024 | 2166 | больше 17 000 токенов |

- Все три принимают пакетный запрос (массив текстов).
- Параметр `dimensions` все три отклоняют (`400`, «does not support Matryoshka embeddings»), как и шлюз Sber500. `drop_params: true` по-прежнему нужен.
- TLS: сертификат `*.api.cloud.ru` от GlobalSign, его проверяет и бандл прокси `agno/litellm/certs/ca-bundle.pem`.

## What Changes

1. **Псевдонимы эмбеддингов переходят на Cloud.ru.** В `agno/litellm/config.yaml` у `giga-embeddings`, `bge-m3-embeddings` и `qwen3-embeddings` меняются провайдер и имя модели: `openai/ai-sage/Giga-Embeddings-instruct-480M`, `openai/BAAI/bge-m3`, `openai/Qwen/Qwen3-Embedding-0.6B`. Адрес `https://foundation-models.api.cloud.ru/v1` записан прямо в конфигурации прокси: это постоянный публичный адрес, а не секрет. `drop_params: true` остаётся.
2. **Имена псевдонимов не меняются.** Белый список в `agno/app/settings.py`, переменная `EMBEDDINGS_MODEL` и проверка размерности 1024 остаются как есть. Активная модель — `giga-embeddings` (так уже стоит в `.env` локально и на сервере).
3. **Ключ — новая обязательная переменная прокси `CLOUDRU_API_KEY`.** Без неё прокси не стартует (`${CLOUDRU_API_KEY:?...}` в compose), как и с остальными ключами.
4. **Шлюз Sber500 удаляется из конфигурации.** Переменные `SBER500_API_BASE` и `SBER500_API_KEY` уходят из compose, `example.env` и документации. Держать обязательным ключ, который заведомо не работает, нельзя, а возврат на шлюз не планируется.
5. **Документы и спецификации.** Требование `integrations` «Эмбеддинги через шлюз Sber500» заменяется на «Эмбеддинги через Cloud.ru Foundation Models»; обновляются `llm-gateway`, `api/knowledge` (если там названы модели), ADR-003 (дополнение 2026-11-08), README, `AGENTS.md`, скиллы `setup-platform` и `deploy-platform`, комментарий в `compose.prod.yaml`, контекст-пак (`03-architecture.md`, `05-security-and-compliance.md`), `openspec/TODO.md`, мастер-спеки `overview` и `architecture`, критерий в `agno/evals/cases.py`.

## Scope

- Конфигурация прокси, compose (локальный и продовый), `example.env`, документация, спецификации.
- Выкладка: перед релизом в `/etc/authorled/authorled.env` на сервере добавляется `CLOUDRU_API_KEY` (с подтверждения владельца), после релиза удаляются строки `SBER500_*`.
- Проверка: эмбеддинг через прокси по каждому из трёх псевдонимов (1024 измерения); загрузка документа в `shared_knowledge` локально и поиск по нему; то же на сервере после релиза; запись в `tmp/VERIFY.md`.

## Non-goals

- GigaChat (`gigachat-embeddings`, `GIGACHAT_*`, сертификаты Russian Trusted CA) не трогаем. Что с ним делать — в Open Questions.
- Чат-модели остаются на DeepSeek. В каталоге Cloud.ru есть и `DeepSeek-V4-Pro`, но переводить их сюда — отдельное решение.
- Размер чанка 1200 символов не меняется: он помещается в предел любой из трёх моделей.
- Учёт расхода на эмбеддинги в журнале `usage-limits` не добавляется: базой знаний пользуется только администратор (как и решено в `usage-limits`).
- Миграция векторов: `shared_knowledge` пуста и локально, и на сервере (проверено 2026-11-08, 0 строк), поэтому пересоздавать нечего.

## Constraints (из контекст-пака)

- Модели только через LiteLLM-прокси, приложение знает только псевдонимы (ADR-003).
- Эмбеддинги только в РФ или свои (05-security): Cloud.ru — российский провайдер; основная модель Giga-Embeddings — российская разработка.
- Без fallback: нет `CLOUDRU_API_KEY` — прокси не стартует; ошибка Cloud.ru (нет денег, нет доступа) — явная ошибка загрузки со статусом `failed`, без перехода на другой псевдоним.
- Ключ только в `.env` и `/etc/authorled/authorled.env`, не в git, логах и чате.

## Acceptance criteria

- Локально с `EMBEDDINGS_MODEL=giga-embeddings` документ загружается в базу знаний со статусом `completed`, векторы по 1024 числа, поиск возвращает его фрагмент.
- Каждый из трёх псевдонимов через прокси отдаёт вектор из 1024 чисел.
- Без `CLOUDRU_API_KEY` в `.env` `docker compose up` падает с сообщением, где названа эта переменная.
- В репозитории (кроме архива changes) не осталось `SBER500_*` и адреса шлюза `shared1.multitool.works`.
- На сервере после релиза загрузка и поиск в базе знаний работают; в «Потреблении» Cloud.ru виден расход.
- `./scripts/validate.sh` и `./scripts/mcp_check.sh` проходят.

## Risks

- **Баланс кончится — эмбеддинги встанут.** Cloud.ru отвечает «Not enough money», загрузка документа завершится ошибкой. Перехода на другой провайдер нет (запрещено правилами). Смягчение: бюджет и уведомление в «Контроле затрат» Cloud.ru (делает владелец в консоли).
- **Цена Giga-Embeddings не найдена в тарифах.** В приложении к договору Cloud.ru от 07.11.2025 есть только bge-m3 (около 0,60 ₽ за 1 млн токенов с НДС) и Qwen3-Embedding-0.6B (около 0,84 ₽). Цену Giga-Embeddings владелец увидит в «Потреблении» после первых запросов. При объёмах базы знаний администратора это копейки.
- **Ключ сервисного аккаунта бессрочный или долгий.** Утечка даёт доступ к оплачиваемым моделям Cloud.ru с баланса владельца. Ключ ограничен ролями Foundation Models; при подозрении — перевыпуск в консоли.
- **Имена моделей в каталоге Cloud.ru могут поменяться.** Ошибка будет явной, правка — одна строка в `config.yaml`.

## Open Questions

- Решено 2026-11-08: провайдер — Cloud.ru Foundation Models, свой платный аккаунт владельца.
- Решено 2026-11-08: активная модель — `giga-embeddings` (`Giga-Embeddings-instruct-480M`): та же, что была на шлюзе, российская, экономнее других на русском тексте.
- Решено 2026-11-08: шлюз Sber500 убрать из конфигурации целиком.
- Что делать с `gigachat-embeddings`: он не работает (`402`), но его ключи остаются обязательными в compose, а ради него держится бандл Russian Trusted CA. Рекомендация: не трогать в этом change, а убрать отдельным, если владелец не заведёт платный GigaChat B2B.

## References

- Архив `openspec/changes/archive/2026-10-29-switch-embeddings-to-sber500/` (proposal, design: риски шлюза).
- `agno/litellm/config.yaml`, `agno/app/settings.py` (`EMBEDDING_ALIASES`, `EMBEDDING_DIMENSIONS`), `agno/compose.yaml`, `compose.prod.yaml`, `example.env`.
- Ответ шлюза Sber500 2026-11-08: `429`, `budget_exceeded`, бюджет 75 000 превышен.
- Cloud.ru: `GET /v1/models` (114 моделей, 2026-11-08), [тарифы Foundation Models](https://cdn.cloud.ru/docs/legal/tariffs/evolution/future-version/foundation-models.pdf), [описание услуги](https://cdn.cloud.ru/docs/legal/contracts/terms-of-service/evolution/current-version/description-foundation-models.pdf).
- [Тарифы GigaChat API для юрлиц](https://developers.sber.ru/docs/ru/gigachat/tariffs/legal-tariffs) — рассмотренная альтернатива (14 ₽ за 1 млн токенов, нужен договор юрлица).
