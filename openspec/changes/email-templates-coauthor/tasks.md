# Tasks

## 1. Шаблоны

- [x] 1.1 Добавить `auth/templates/email/coauthor-base.html` по `design.md`: таблицы, встроенные стили, цвета светлой темы, `color-scheme: light`, блоки `title`, `content`, `footer`; проверить, что в файле нет `cid:`, картинок, внешних ссылок и слов Authorled и authentik.
- [x] 1.2 Добавить `auth/templates/email/coauthor-code.html` и `coauthor-code.txt` с кодом и сроком 10 минут, удалить `authorled-code.*`; проверить, что шаблоны рендерятся в контейнере `authentik-server` с тестовым кодом.
- [x] 1.3 В `auth/blueprints/30-authentication-flow.yaml` указать новую тему и шаблон, рядом с `token_expiry` оставить комментарий о тексте письма; проверить, что blueprint применён в статусе `successful`.
- [x] 1.4 Показать `AUTHENTIK_EMAIL__FROM` с именем в `example.env` и таблице настроек README, обновить локальный `.env`; проверить, что `docker compose config` передаёт значение целиком, и что `./scripts/validate.sh` и `git diff --check` проходят.

## 2. Проверка локально

- [x] 2.1 Запросить код на локальном стеке; проверить в Mailpit тему, имя отправителя, HTML и текстовую версию, отсутствие вложений и слов Authorled и authentik.
- [x] 2.2 Зарегистрировать временного пользователя с кодом из нового письма и удалить его; проверить, что регистрация завершилась.

## 3. Проверка на сервере

Эти шаги меняют сервер и GitHub, поэтому каждый выполняется после подтверждения владельца.

- [ ] 3.1 Изменить `AUTHENTIK_EMAIL__FROM` в `/etc/authorled/authorled.env`, затем выпустить релиз из `main`; проверить зелёный запуск Deploy и что blueprint применён с новым шаблоном.
- [ ] 3.2 Получить письмо с кодом на Gmail и Яндекс Почту владельца; проверить вид на компьютере и телефоне и в тёмной теме.
- [ ] 3.3 Записать проверки и ограничения в `tmp/VERIFY.md`, отдельно результаты static, container и hosted.

## Workflow follow-up

- Обновить статус `business-intents/email-templates-coauthor.md` после реализации.
- Заархивировать change после `/opsx:verify`.
