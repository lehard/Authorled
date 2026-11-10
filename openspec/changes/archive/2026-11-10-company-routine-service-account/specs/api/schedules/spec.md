## ADDED Requirements

### Requirement: Права Routine из кода
Routine, объявленная в `agno/app/company.py`, MUST запускаться по расписанию с сохранёнными правами сервисной учётной записи `sa-routines`. Сохраняет их команда `scripts/routines_authorize.sh`: она получает токен `sa-routines` по паролю приложения со stdin и правит через `PATCH /company/routines/{id}` каждую Routine объявленных Products, не меняя её текст, cron и исполнитель. Без сохранённых прав запуск Routine MUST отвечать `403` без вызова LLM.

#### Scenario: Routine без сохранённых прав
- GIVEN Routine `this-agentos.agentos-maintenance` создана из объявления и права ей не сохранены
- WHEN наступает её время или её запускают вручную
- THEN запуск MUST записаться в истории как `failed` с кодом `403`
- AND LLM MUST NOT вызываться

#### Scenario: Сохранение прав
- GIVEN у `sa-routines` есть пароль приложения
- WHEN владелец передаёт его на stdin `./scripts/routines_authorize.sh`
- THEN у каждой Routine объявленных Products MUST появиться сохранённые права `sa-routines`
- AND `instructions`, `cron_expr`, `timezone`, `target_type` и `target_id` Routine MUST NOT измениться
- AND команда MUST напечатать имена Routines, которым права сохранены, и MUST NOT печатать пароль и токен

#### Scenario: Запуск с сохранёнными правами
- GIVEN права `sa-routines` сохранены в Routine `this-agentos.agentos-maintenance`
- WHEN Routine запускается по расписанию или вручную
- THEN запуск MUST NOT отвечать `403`
- AND в журнале агентов MUST появиться трасса запуска `company-manager-internal`

#### Scenario: Права переживают перезапуск
- GIVEN права `sa-routines` сохранены в Routine
- WHEN API перезапускается и засевает объявления Company
- THEN сохранённые права Routine MUST остаться

#### Scenario: Нет пароля или отказ
- GIVEN stdin пуст, Authentik не выдал токен или API отказал в правке Routine
- WHEN выполняется `./scripts/routines_authorize.sh`
- THEN команда MUST завершиться ненулевым кодом с сообщением, называющим шаг и код ответа
- AND MUST NOT продолжать с другими Routines
