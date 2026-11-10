# Spec Delta

## ADDED Requirements

### Requirement: Права на сертификат удостоверяющего центра админки
Обратный прокси читает `/etc/authorled/admin-client-ca.pem` под своим пользователем, который не входит в группы `root` и `deploy`. Деплой релиза MUST до копии базы и запуска контейнеров проверять, что такой пользователь может прочитать файл: у каталога `/etc/authorled` есть право прохода для остальных, у файла — право чтения для остальных. Иначе деплой MUST завершиться ошибкой с путём, текущими правами и командой исправления; права сам он MUST NOT менять.

#### Scenario: Каталог закрыт для обратного прокси
- GIVEN `/etc/authorled` имеет права `0750`, а `/etc/authorled/admin-client-ca.pem` — `0644`
- WHEN запускается деплой релиза
- THEN деплой MUST завершиться ошибкой, называющей `/etc/authorled`, права `750` и `chmod 751 /etc/authorled`
- AND копия базы, смена кода и контейнеров MUST NOT выполняться

#### Scenario: Файл закрыт для обратного прокси
- GIVEN `/etc/authorled` имеет права `0751`, а `/etc/authorled/admin-client-ca.pem` — `0600`
- WHEN запускается деплой релиза
- THEN деплой MUST завершиться ошибкой, называющей файл, права `600` и `chmod 644 /etc/authorled/admin-client-ca.pem`, до копии базы

#### Scenario: Права настроены
- GIVEN `/etc/authorled` имеет права `0751`, а `/etc/authorled/admin-client-ca.pem` — `0644`
- WHEN запускается деплой релиза
- THEN проверка прав MUST пройти, и деплой MUST идти дальше

#### Scenario: Секреты остаются закрыты
- GIVEN сервер настроен по README
- WHEN пользователь обратного прокси читает `/etc/authorled/authorled.env`
- THEN чтение MUST быть отклонено
