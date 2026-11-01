## ADDED Requirements

### Requirement: Refresh token фронтенда
Провайдер фронтенда MUST выдавать новый refresh token при каждом продлении и MUST отклонять повторное использование прежнего (`invalid_grant` и событие «Revoked refresh token was used» в журнале Authentik); `refresh_token_threshold` MUST оставаться `seconds=0`. Фронтенд MUST отправлять каждый refresh token в Authentik не больше одного раза.

#### Scenario: Повторное использование отклоняется
- GIVEN refresh token обменян на новые токены
- WHEN тот же refresh token отправляется в `/application/o/token/` ещё раз
- THEN Authentik MUST ответить `400` с `invalid_grant`, а новый refresh token MUST оставаться действительным

#### Scenario: Нормальная работа без событий
- GIVEN пользователь работает во фронтенде дольше срока жизни Access Token, в том числе со сном вкладки
- WHEN просматривается журнал событий Authentik
- THEN в нём MUST NOT быть событий «Revoked refresh token was used» от этого пользователя
