## ADDED Requirements

### Requirement: Eval соавтора от имени пользователя разработки
Кейс `coauthor_uses_context` (тег `coauthor`) MUST запускать соавтора от имени `writer@authorled.test` с проверенным токеном локального Authentik, проверенным как в API (спека `auth`, «Полномочия запуска для доверенного кода»). Если аккаунта `writer` в ядре нет, кейс MUST создавать его как при первом входе. Лимит и журнал расхода MUST работать как в чате. Кейсы `smoke` MUST идти без пользователя и MUST NOT зависеть от Authentik и `AUTH_DEV_WRITER_TOKEN`.

#### Scenario: Соавтор доходит до модели
- GIVEN локальный стенд с Authentik, выполнен `./scripts/dev.sh auth-users`, `AUTH_DEV_WRITER_TOKEN` задан в `.env`, `RUNTIME_ENV=dev`
- WHEN на хосте выполняется `python -m evals --tag coauthor`
- THEN кейс `coauthor_uses_context` MUST получить ответ модели и оценку судьи
- AND в журнале расхода MUST появиться запись этого запуска у аккаунта `writer@authorled.test`

#### Scenario: Аккаунта в ядре нет
- GIVEN в Authentik есть `writer`, а в ядре его аккаунта нет
- WHEN выполняется `python -m evals --tag coauthor`
- THEN аккаунт MUST быть создан с почтой и именем из токена и подпиской тарифа новых аккаунтов, а кейс MUST выполниться

#### Scenario: Нет секрета
- GIVEN `AUTH_DEV_WRITER_TOKEN` не задан
- WHEN выполняется `python -m evals --tag coauthor`
- THEN кейс MUST завершиться ошибкой, называющей `AUTH_DEV_WRITER_TOKEN`, без вызова модели, а команда MUST вернуть ненулевой код

#### Scenario: Authentik не выдал токен
- GIVEN Authentik недоступен по адресу из `AUTH_ISSUER` или отказал в токене (неверный пароль приложения)
- WHEN выполняется `python -m evals --tag coauthor`
- THEN кейс MUST завершиться ошибкой, называющей адрес Authentik или его отказ, без вызова модели
- AND секрет и токен MUST NOT попадать в вывод

#### Scenario: Не локальный стенд
- GIVEN `RUNTIME_ENV` не равен `dev`
- WHEN выполняется `python -m evals --tag coauthor`
- THEN кейс MUST завершиться ошибкой без запроса токена и без вызова модели

#### Scenario: Лимит исчерпан
- GIVEN расход `writer` в текущем периоде достиг лимита тарифа
- WHEN выполняется `python -m evals --tag coauthor`
- THEN кейс MUST завершиться отказом с сообщением о лимите и датой обновления, а не «Не удалось проверить лимит соавтора»

#### Scenario: Smoke без Authentik
- GIVEN Authentik остановлен и `AUTH_DEV_WRITER_TOKEN` не задан
- WHEN выполняется `python -m evals --tag smoke`
- THEN три кейса MUST выполниться как раньше, без пользователя
