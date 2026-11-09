# Spec Delta

## MODIFIED Requirements

### Requirement: Обратный прокси
Настройка обратного прокси MUST храниться в репозитории и обновляться при деплое. На домене сервиса (`app.soavtor.app`) он MUST отдавать собранный фронтенд, вести `/os/` на API без этого префикса и вести `/api/v3/flows/executor/`, `/flows/-/cancel/`, `/application/o/revoke/` на Authentik. Домен Authentik (`auth.soavtor.app`) MUST вести на Authentik, кроме административной части `/if/admin/`, которая там MUST отвечать `404`. Адрес админки (`admin.soavtor.app`) MUST принимать только TLS-соединения с клиентским сертификатом, подписанным удостоверяющим центром владельца из `/etc/authorled/admin-client-ca.pem`, и MUST вести их на Authentik; без такого сертификата соединение MUST отклоняться до HTTP. Потоки Authentik на домене Authentik и домене сервиса MUST ограничиваться по спеке `auth` («Потоки на публичных адресах»). Authentik MUST доверять заголовкам прокси только с одного адреса: шлюза сети Docker, через который приходит обратный прокси (`AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS=<шлюз>/32`). Старый домен сервиса `coauthor.glavai.ru` MUST постоянно (301) переадресовывать на домен сервиса с тем же путём и параметрами. `www.soavtor.app` MUST постоянно (301) переадресовывать на `soavtor.app` с тем же путём. Домен продукта `soavtor.app` MUST отдавать собранный сайт текущего релиза как статические файлы, на неизвестный адрес MUST отвечать страницей 404 сайта с кодом `404`, а из API MUST вести только `/os/api/v1/beta-requests` на маршрут заявки без префикса `/os`; другие пути `/os/` на домене продукта MUST NOT доходить до API. Все домены MUST работать по HTTPS.

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
- GIVEN выложен релиз с сайтом, а прежде `soavtor.app` временно переадресовывал на сервис
- WHEN браузер открывает `https://soavtor.app/`
- THEN ответ MUST NOT быть переадресацией на `https://app.soavtor.app/`

#### Scenario: Главная сайта
- GIVEN деплой завершён
- WHEN браузер открывает `https://soavtor.app/`
- THEN ответ MUST быть `200` с `index.html` собранного сайта

#### Scenario: Неизвестный адрес сайта
- GIVEN деплой завершён
- WHEN браузер открывает `https://soavtor.app/no-such-page`
- THEN ответ MUST быть `404` со страницей 404 сайта

#### Scenario: Заявка с сайта
- GIVEN деплой завершён
- WHEN форма сайта отправляет `POST https://soavtor.app/os/api/v1/beta-requests`
- THEN запрос MUST дойти до `POST /api/v1/beta-requests` API

#### Scenario: Другой путь API на домене продукта
- GIVEN деплой завершён
- WHEN клиент запрашивает `https://soavtor.app/os/agents` или `https://soavtor.app/os/health`
- THEN запрос MUST NOT дойти до API

#### Scenario: Старый домен Authentik
- GIVEN деплой завершён
- WHEN клиент обращается к `auth.coauthor.glavai.ru`
- THEN обратный прокси MUST NOT вести запрос на Authentik

#### Scenario: Адрес админки без сертификата
- GIVEN деплой завершён
- WHEN клиент без клиентского сертификата или с сертификатом другого удостоверяющего центра открывает `https://admin.soavtor.app/`
- THEN TLS-соединение MUST быть отклонено, HTTP-ответа MUST NOT быть

#### Scenario: Адрес админки через чужое имя
- GIVEN деплой завершён
- WHEN клиент без сертификата устанавливает TLS с именем `auth.soavtor.app` и отправляет запрос с `Host: admin.soavtor.app`
- THEN запрос MUST NOT дойти до Authentik

#### Scenario: Админка на домене Authentik
- GIVEN деплой завершён
- WHEN клиент открывает `https://auth.soavtor.app/if/admin/`
- THEN ответ MUST быть `404`

#### Scenario: Нет сертификата удостоверяющего центра
- GIVEN на сервере нет `/etc/authorled/admin-client-ca.pem`
- WHEN запускается деплой релиза
- THEN деплой MUST завершиться ошибкой с именем файла до запуска контейнеров

#### Scenario: Доверенный прокси не совпадает со шлюзом
- GIVEN `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS` в `.env` не равен `<шлюз сети authorled_agentos>/32` или этой сети нет
- WHEN запускается деплой релиза
- THEN деплой MUST завершиться ошибкой, в которой названы оба значения, до бэкапа и запуска контейнеров

### Requirement: Проверка после деплоя
После запуска деплой MUST проверять по публичному адресу, что `/health` отвечает успехом, а `/agents` без токена отказывает. Деплой MUST также проверять, что `admin.soavtor.app` без клиентского сертификата отклоняет соединение, `https://auth.soavtor.app/if/admin/` отвечает `404`, а поток Authentik по умолчанию на домене Authentik и домене сервиса отвечает `404`. Деплой MUST также проверять сайт на домене продукта: главная и страница политики отвечают `200`, неизвестный адрес — `404`, а `POST /os/api/v1/beta-requests` с пустым телом получает отказ маршрута заявки `422`; настоящую заявку проверка MUST NOT создавать. Если проверка не прошла, запуск MUST завершиться ошибкой. Автоматический откат MUST NOT выполняться.

#### Scenario: API не поднялся
- GIVEN после запуска `/health` не отвечает успехом
- WHEN проходит проверка
- THEN запуск MUST стать красным, и прошлая версия MUST NOT возвращаться сама

#### Scenario: Доступ без токена
- GIVEN `/agents` без токена отвечает успехом
- WHEN проходит проверка
- THEN запуск MUST завершиться ошибкой

#### Scenario: Сайт не отдаётся
- GIVEN `https://soavtor.app/` отвечает не `200` или маршрут заявки на домене продукта отвечает не `422` на пустое тело
- WHEN проходит проверка
- THEN запуск MUST завершиться ошибкой с адресом и полученным кодом

#### Scenario: Админка открыта без сертификата
- GIVEN `https://admin.soavtor.app/` отвечает по HTTP без клиентского сертификата
- WHEN проходит проверка
- THEN запуск MUST завершиться ошибкой с адресом
