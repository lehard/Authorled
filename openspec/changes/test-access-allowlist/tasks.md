# Tasks

## 1. Настройка

- [x] 1.1 Передать `AUTH_ALLOWED_EMAILS` как обязательную в окружение Authentik в `auth/compose.yaml`, добавить `AUTH_ALLOWED_EMAILS=*` в `example.env` и локальный `.env`; проверить, что `docker compose config` без неё падает с её именем.
- [x] 1.2 Описать настройку и её смену через `docker compose up -d authentik-server authentik-worker` в README и скиллах `setup-platform`, `deploy-platform`; проверить, что `git diff --check` проходит и реальных почт в диффе нет.

## 2. Политика регистрации

- [x] 2.1 Добавить проверку списка в политику `authorled-email-not-registered` раньше проверки занятой почты; проверить на локальном стенде с `AUTH_ALLOWED_EMAILS=tester@authorled.test`, что почта не из списка получает отказ, пользователь не создан, а в Mailpit нет письма.
- [x] 2.2 Проверить на локальном стенде остальные сценарии спеки `auth`: другой регистр, занятая почта не из списка даёт тот же отказ, `*` открывает регистрацию, смена настройки с пересозданием контейнеров работает без правки blueprint.
- [x] 2.3 Проверить, что blueprint применился на пустой схеме: `./scripts/dev.sh reset-db --yes`, старт стека, регистрация почты из списка проходит.

## 3. Экран регистрации

- [x] 3.1 Добавить текст отказа в таблицу `KNOWN` в `web/src/auth/flow/flowClient.ts` с полем `page`; проверить в браузере на локальном стенде, что экран показывает сообщение, шаг кода не открывается, а другую почту можно ввести.

## 4. Итоговая проверка

- [x] 4.1 Запустить `./scripts/validate.sh`, `./scripts/check_auth_boundary.sh`, `./scripts/auth_check.sh` и `git diff --check`; записать результаты и ограничения в `tmp/VERIFY.md`.

## Workflow follow-up

- Обновить статус `business-intents/test-access-allowlist.md` после реализации.
- Заархивировать change после `/opsx:verify`.
