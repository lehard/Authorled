# Spec Delta

## ADDED Requirements

### Requirement: Отказы историй не кэшируются
Отказы маршрутов историй MUST отправляться с заголовком `Cache-Control: no-store`. Статус и тело отказа MUST NOT меняться.

#### Scenario: Отказ до создания аккаунта
- WHEN пользователь с верным токеном, у которого ещё нет записи в `users`, вызывает `GET /api/v1/projects`
- THEN ответ MUST быть `404` с причиной «Аккаунта ещё нет: сначала вызовите GET /api/v1/me» и заголовком `Cache-Control: no-store`
