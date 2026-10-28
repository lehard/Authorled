# Spec Delta

## REMOVED Requirements

### Requirement: Slack
**Reason**: интеграция со Slack не используется (решение владельца 2026-10-26); код и зависимость `slack-sdk` удаляются.
**Migration**: удалить `SLACK_BOT_TOKEN` и `SLACK_SIGNING_SECRET` из `.env`; Slack-приложение, указывающее на этот инстанс, отключить на стороне Slack. Доступ к OS Manager — через REST API и MCP `/mcp`.
