# Spec Delta

## MODIFIED Requirements

### Requirement: AgentOS UI и JWT
При включённой авторизации система MUST проверять JWT ключами из файла `JWT_JWKS_FILE` (открытые ключи подписи Authentik, выгружаемые модулем `auth`); других источников ключей система MUST NOT принимать. Токены, принимаемые системой, MUST выпускаться Authentik (`openspec/specs/auth/spec.md`).

#### Scenario: Токен не подписан ключом
- GIVEN `RUNTIME_ENV=prd` с заданным ключом
- WHEN клиент передаёт токен, подписанный другим ключом
- THEN система MUST вернуть `401`

#### Scenario: Токен Authentik
- GIVEN ключи Authentik выгружены в `JWT_JWKS_FILE`
- WHEN клиент передаёт действительный Access Token Authentik
- THEN система MUST принять запрос и использовать `sub` токена как `user_id`
