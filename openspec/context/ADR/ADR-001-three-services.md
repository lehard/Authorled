---
owner: lehard
updated: 2026-10-26
---
# ADR-001: Три сервиса, связь через стандартные контракты
## Status: Accepted
## Context
Нужны авторизация, интерфейс писателя и продуктовый бэкенд с агентом.
## Decision
Три независимо деплоящихся сервиса: `authorled-auth` (Authentik), `authorled-web` (Refine + CopilotKit + редактор сценария; состав фронтенда — ADR-004), `authorled` (Agno). Связь только через OIDC/JWT и REST/SSE/AG-UI. Вся продуктовая логика — в бэкенде; промежуточного бэкенда между фронтом и AgentOS нет.
## Consequences
Фронт — тонкий клиент без своей БД. У каждого сервиса свои данные. Бэкенд только проверяет токены Authentik (JWKS), доступ к проектам проверяет сам.
## Alternatives considered
> TODO: что отвергли (например, BFF между фронтом и AgentOS, встроенная авторизация Agno) и почему — у lehard.
## Review date
> TODO
