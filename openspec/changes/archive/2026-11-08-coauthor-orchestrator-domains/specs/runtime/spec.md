# Spec Delta

## ADDED Requirements

### Requirement: Телеметрия Agno выключена
Приложение MUST NOT отправлять телеметрию Agno ни в одном запуске. Агенты и команды Agno приложения (`Agent`, `Team`), включая компоненты экзамена маршрутизации, MUST создаваться с `telemetry=False`; инженер `claude-engineer` — внешний агент `ClaudeAgent`, у которого телеметрии Agno нет. Внутренние менеджеры Agno слушаются только `AGNO_TELEMETRY`, поэтому API MUST отказываться стартовать, если `AGNO_TELEMETRY` не равен `false`; значение MUST NOT подставляться по умолчанию. Compose (dev и prod), `./scripts/dev.sh api` и `example.env` MUST задавать `AGNO_TELEMETRY=false`.

#### Scenario: Нет AGNO_TELEMETRY
- GIVEN `AGNO_TELEMETRY` не задан или не равен `false`
- WHEN импортируется `app.main` (старт API, `python -m evals`)
- THEN импорт MUST завершиться ошибкой, называющей `AGNO_TELEMETRY` и требуемое значение `false`

#### Scenario: Агент приложения без телеметрии
- GIVEN `AGNO_TELEMETRY` не задан
- WHEN создаётся агент `coauthor` или компонент экзамена
- THEN у него MUST быть `telemetry=False`, и его запуск MUST NOT отправлять событие телеметрии
