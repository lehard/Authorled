# Spec Delta

## MODIFIED Requirements

### Requirement: Доступ к /mcp
Авторизация включена при любом `RUNTIME_ENV`, включая `dev`, поэтому запрос к `/mcp` без токена MUST отклоняться кодом `401`. Для `./scripts/mcp_check.sh` токен Authentik MUST передаваться в `MCP_CHECK_TOKEN`.

#### Scenario: prd без токена
- GIVEN `RUNTIME_ENV=prd` и задан `JWT_JWKS_FILE`
- WHEN клиент выполняет `GET /mcp` без токена
- THEN система MUST вернуть `401`

#### Scenario: dev без токена
- GIVEN `RUNTIME_ENV=dev` и задан `JWT_JWKS_FILE`
- WHEN клиент выполняет `GET /mcp` без токена
- THEN система MUST вернуть `401`

#### Scenario: Проверка MCP с токеном
- GIVEN платформа запущена и `MCP_CHECK_TOKEN` содержит действительный токен Authentik
- WHEN выполняется `./scripts/mcp_check.sh`
- THEN скрипт MUST выполнить handshake и получить `tools/list`
