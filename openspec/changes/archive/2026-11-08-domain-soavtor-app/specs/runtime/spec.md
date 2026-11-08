## MODIFIED Requirements

### Requirement: Обратный прокси
Настройка обратного прокси MUST храниться в репозитории и обновляться при деплое. На домене сервиса (`app.soavtor.app`) он MUST отдавать собранный фронтенд, вести `/os/` на API без этого префикса и вести `/api/v3/flows/executor/`, `/flows/-/cancel/`, `/application/o/revoke/` на Authentik. Домен Authentik (`auth.soavtor.app`) MUST вести на Authentik. Старый домен сервиса `coauthor.glavai.ru` MUST постоянно (301) переадресовывать на домен сервиса с тем же путём и параметрами. `www.soavtor.app` MUST постоянно (301) переадресовывать на `soavtor.app` с тем же путём. Пока в корне домена продукта нет сайта, `soavtor.app` MUST временно (302) переадресовывать на домен сервиса с тем же путём. Все домены MUST работать по HTTPS.

#### Scenario: Адрес приложения
- GIVEN деплой завершён
- WHEN браузер открывает адрес экрана на домене сервиса, например `/login`
- THEN MUST открыться фронтенд

#### Scenario: Запрос к API
- GIVEN деплой завершён
- WHEN клиент запрашивает `/os/health` на домене сервиса
- THEN запрос MUST дойти до `/health` API

#### Scenario: Вход через домен продукта
- GIVEN деплой завершён
- WHEN фронтенд обращается к `/api/v3/flows/executor/` на своём домене
- THEN запрос MUST дойти до Authentik

#### Scenario: Старая ссылка
- GIVEN деплой завершён
- WHEN браузер открывает `https://coauthor.glavai.ru/stories/42?tab=notes`
- THEN ответ MUST быть `301` с `Location: https://app.soavtor.app/stories/42?tab=notes`

#### Scenario: Адрес с www
- GIVEN деплой завершён
- WHEN браузер открывает `https://www.soavtor.app/pricing`
- THEN ответ MUST быть `301` с `Location: https://soavtor.app/pricing`

#### Scenario: Корень домена до сайта
- GIVEN деплой завершён, а сайт продукта ещё не выложен
- WHEN браузер открывает `https://soavtor.app/`
- THEN ответ MUST быть `302` с `Location: https://app.soavtor.app/`

#### Scenario: Старый домен Authentik
- GIVEN деплой завершён
- WHEN клиент обращается к `auth.coauthor.glavai.ru`
- THEN обратный прокси MUST NOT вести запрос на Authentik
