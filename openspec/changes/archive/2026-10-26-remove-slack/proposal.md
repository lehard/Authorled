# Proposal

## Why

Интеграция со Slack не нужна: владелец решил (2026-10-26) не использовать её. Сейчас она остаётся в коде необязательной веткой (`app/interfaces.py`), тянет в зависимости `slack-sdk` и `aiohttp` через extra `agno[slack]`, описана в README, `example.env`, мастер-спеках и контекст-паке. Это мёртвая поверхность: не проверялась вживую (`openspec/TODO.md`), расширяет список секретов и зависимостей. Ранее удаление откладывалось (non-goal change `switch-models-to-deepseek-litellm`); теперь снимаем отсрочку.

## What Changes

- Из `app/interfaces.py` удаляется подключение `Slack` и чтение `SLACK_BOT_TOKEN` / `SLACK_SIGNING_SECRET`; остаётся MCP (`attach_interfaces` публикует `agno` и встроенные инструменты, `mcp_auth` без изменений).
- Из `pyproject.toml` убирается extra `slack` у `agno`; `requirements.txt` пересобирается скриптом (исчезают `slack-sdk` и, если на него больше ничто не ссылается, `aiohttp`).
- Из `example.env`, `README.md`, `AGENTS.md`, `.agents/skills/setup-platform/SKILL.md` убираются упоминания Slack.
- Мастер-спеки через дельты: требование «Slack» удаляется из `integrations`; «Каналы доступа» (`overview`), «Слои приложения» (`architecture`) и «Сведения об инстансе» (`api/core`) теряют упоминания Slack.
- Контекст-пак и вспомогательные документы: `03-architecture.md`, диаграмма в `architecture/spec.md`, пункт Slack в `openspec/TODO.md`.
- **BREAKING** (мягко): переменные `SLACK_BOT_TOKEN` и `SLACK_SIGNING_SECRET` в `.env` перестают действовать; Slack-приложение, настроенное на этот инстанс, перестанет получать ответы. По вашим словам, интеграция нигде не используется.

## Scope

- `app/interfaces.py`, `pyproject.toml`, `requirements.txt`.
- `example.env`, `README.md`, `AGENTS.md`, `.agents/skills/setup-platform/SKILL.md`.
- `openspec/context/03-architecture.md`, `openspec/TODO.md`.
- Дельты мастер-спек: `integrations`, `overview`, `architecture`, `api/core`.
- Проверка: `./scripts/validate.sh`, `git diff --check`, запуск приложения, `GET /config` и `scripts/mcp_check.sh`; запись в `tmp/VERIFY.md`.

## Non-goals

- Удаление или изменение MCP, `mcp_auth`, `MCP_CONNECT_SECRET`.
- Другие chat-интерфейсы Agno (Telegram, WhatsApp и т.п.): их и так нет в коде.
- Запрет на будущую интеграцию или проверка `.env` на устаревшие переменные Slack (они просто игнорируются, как любые неиспользуемые).
- Обновление пина Agno и других зависимостей; пересборка `requirements.txt` не должна менять версии остальных пакетов.
- Правка исторических записей: `openspec/changes/archive/**`, строки «Удаление Slack (владелец отложил)» в закрытых/чужих change не переписываются.

## Capabilities

### New Capabilities
<!-- нет -->

### Modified Capabilities
- `integrations`: удаляется требование «Slack» (подключение при двух переменных окружения).
- `overview`: «Каналы доступа» — REST API и MCP без Slack; к сценарию «Без Slack» добавляется сценарий с заданными переменными Slack.
- `architecture`: «Слои приложения» — `app/interfaces.py` отвечает только за MCP.
- `api/core`: «Сведения об инстансе» — формулировка `interfaces: []` без отсылки к Slack. Требование уже изменяет `switch-models-to-deepseek-litellm`; эта дельта строится поверх его версии (см. design).

## Impact

- Код: `app/interfaces.py` (−~15 строк); зависимости: −`slack-sdk`, возможно −`aiohttp`; образы нужно пересобрать (обе цели Dockerfile).
- API: `GET /config` и `GET /info` не меняются (`interfaces: []` уже в текущем состоянии без переменных Slack). Количество путей и операций OpenAPI не меняется.
- Секреты: из списка настроек уходят две переменные.
- Порядок с другими change: правки `pyproject.toml` и `requirements.txt` пересекаются с незакоммиченным `switch-models-to-deepseek-litellm`; применять после его завершения или вместе в одном рабочем дереве.
