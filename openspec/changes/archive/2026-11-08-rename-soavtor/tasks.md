# Tasks

## 1. Сервис (`web/`)

- [x] 1.1 Заменить «Authorled» на «Соавтор» в `web/index.html` (`<title>`), `web/src/auth/LoginScreen.tsx` (название над карточкой; заголовок шага почты — «Вход в Соавтор»), `web/src/screens/shelf/TopBar.tsx`, `web/src/showcase/Showcase.tsx` («Дизайн-система Соавтора») и в комментарии `web/src/design-system/tokens.css` (design, решение 2). Проверка: `grep -rn "Authorled\|CoAuthor" web/src web/index.html` находит только строку из 1.2 до её правки; `npm run build --prefix web` проходит.
- [x] 1.2 В `web/src/screens/project/chat/CoauthorChat.tsx` заменить только описание контекста на «Что сейчас открыто у автора в Соавторе», а в `agno/evals/cases.py` — тот же ключ в случае `coauthor_uses_context` (design, решения 4 и 8). Проверка: `grep -rn "Что сейчас открыто" agno web/src` показывает одну и ту же строку в обоих файлах; `git diff web/src/screens/project/chat/CoauthorChat.tsx` от этой задачи — одна строка.
- [x] 1.3 Проверить требование `web/app` «Название продукта». Проверка: после `npm run build --prefix web` команда `grep -rl "Authorled\|CoAuthor" web/dist` ничего не находит; в браузере на стенде разработки `document.title` — «Соавтор», `/login` показывает «Соавтор» и «Вход в Соавтор», шапка полки — «Соавтор». Записать в `tmp/VERIFY.md`.

## 2. Соавтор (ИИ)

- [x] 2.1 В `agno/skills/coauthor/SKILL.md` заменить первую строку тела на «Ты — Соавтор, ИИ-соавтор писателя или сценариста в сервисе «Соавтор». Отвечай по-русски.» (design, решение 5). Проверка: `grep -n "Authorled\|CoAuthor" agno/skills/coauthor/SKILL.md` пуст; API стартует (навык читается при старте).
- [x] 2.2 Проверить требование `api/agents` «Название продукта у соавтора» на стенде разработки после перезапуска API (с подтверждения владельца, если API общий): `python -m evals --tag coauthor` проходит, в новой беседе на вопрос «Как называется этот сервис?» соавтор отвечает «Соавтор». Тратит вызовы модели. Записать ответ и вывод eval в `tmp/VERIFY.md` (model).

## 3. Письма и страницы Authentik (`auth/`)

- [x] 3.1 В `auth/templates/email/coauthor-base.html`, `coauthor-code.html`, `coauthor-code.txt` заменить «CoAuthor» на «Соавтор» (шапка, заголовок, подвал «Если вы не входили в Соавтор, просто удалите это письмо.»); имена файлов не менять. Проверка: `grep -rn "CoAuthor\|Authorled\|authentik" auth/templates/email` пуст.
- [x] 3.2 В `auth/blueprints/30-authentication-flow.yaml` заменить атрибуты: `title` потока регистрации — «Регистрация в Соавторе», потока входа — «Вход в Соавтор», `friendly_name` — «Соавтор», `subject` — «Код для входа в Соавтор», `branding_title` — «Соавтор»; в `auth/blueprints/20-oidc.yaml` — `title` потока выхода «Выход из Соавтора» и `name` приложения «Соавтор». `identifiers`, slug и служебные `name` записей не трогать (design, решение 1). Проверка: `git diff auth/blueprints` меняет только перечисленные атрибуты; `./scripts/check_auth_boundary.sh` проходит.
- [x] 3.3 Заменить пример отправителя: `example.env` — `AUTHENTIK_EMAIL__FROM="Соавтор <noreply@authorled.test>"`, README (таблица настроек) — `"Соавтор <noreply@example.com>"`; в обоих файлах трогать только эту строку (design, решение 8). Проверка: `grep -n "EMAIL__FROM\|CoAuthor" example.env README.md`.
- [x] 3.4 Проверить на стенде разработки (пересоздание контейнеров Authentik — с подтверждения владельца): в локальном `.env` поставить отправителя «Соавтор <…>», пересоздать Authentik, дождаться применения blueprints, запросить код входа. Проверка: в Mailpit (`http://localhost:8025`) тема «Код для входа в Соавтор», отправитель «Соавтор», в сырых заголовках имя закодировано (`=?utf-8?…?=`), в HTML и тексте нет Authorled, CoAuthor, authentik; `/api/v3/core/brands/current/` — `branding_title` «Соавтор», поток `authorled-authentication`; вход и выход проходят, уже вошедший пользователь продлевает вход без повторного входа. Записать в `tmp/VERIFY.md` (container).

## 4. Документы

- [x] 4.1 Заменить имя продукта на «Соавтор» в `openspec/config.yaml` (строка «Продукт:», остальное в файле не трогать), `openspec/context/00-start-here.md` (заголовок), `01-product-context.md`, `03-architecture.md`, `ADR/ADR-005-starc-reference-flows.md`, в Purpose мастер-спек `web/app`, `web/design-system`, `architecture` и в заголовке `business-intents/product-site.md`; в `web/README.md` — «Soavtor» (английский текст, design, решение 3). Проверка: `grep -rn "Authorled\|CoAuthor" openspec/config.yaml openspec/context/0*.md openspec/context/ADR openspec/specs web/README.md` находит только технические имена (`*@Authorled.test` в сценарии `auth`, URL репозитория).
- [x] 4.2 Дописать по одной строке о замене: в `business-intents/email-templates-coauthor.md` (статус: название CoAuthor заменено `rename-soavtor`) и в `business-intents/domain-soavtor-app.md` (п. 4: имя отправителя меняет `rename-soavtor`). Проверка: `git diff` этих файлов — только добавленные строки.
- [x] 4.3 `./scripts/validate.sh` (с `env -u BASH_ENV` после `source agno/.venv/bin/activate`), `git diff --check`, `openspec validate rename-soavtor --strict` проходят. Записать в `tmp/VERIFY.md` (static).

## 5. Выпуск (каждый шаг на сервере и в GitHub — после подтверждения владельца в чате)

- [x] 5.1 Убедиться, что релиз `domain-soavtor-app` выпущен и проверен (его задачи 4.5 и 5.x отмечены). Проверка: `https://app.soavtor.app/os/health` отвечает; запись в `tmp/VERIFY.md`.
- [x] 5.2 Перед влитием в `main` убедиться, что в файлах этого change нет чужих незакоммиченных правок, или получить согласие владельца на общий коммит (design, решение 8). Проверка: `git diff` каждого файла коммита содержит только правки этого change.
- [x] 5.3 Прямо перед релизом: копия `/etc/authorled/authorled.env` рядом, затем в нём `AUTHENTIK_EMAIL__FROM="Соавтор <noreply@soavtor.app>"`. Проверка: `grep AUTHENTIK_EMAIL__FROM` по файлу показывает новое значение и ничего больше.
- [x] 5.4 Опубликовать релиз из `main`. Проверка: зелёный запуск `deploy.yml`, деплой применил blueprints без ошибок.

## 6. Проверка на сервере

- [ ] 6.1 Вход на `https://app.soavtor.app/login`: вкладка, экран и шапка полки — «Соавтор»; письмо с кодом приходит от «Соавтор» с темой «Код для входа в Соавтор» и читается в Gmail и Яндекс Почте, в теме и отправителе нет искажённых символов. Проверка: запись в `tmp/VERIFY.md` (hosted).
- [ ] 6.2 `/api/v3/core/brands/current/` на `auth.soavtor.app` — `branding_title` «Соавтор», поток входа `authorled-authentication`; токены выдаёт прежний издатель; соавтор в новой беседе называет сервис «Соавтор». Проверка: ответы в `tmp/VERIFY.md` (hosted).

## Workflow follow-up

- 6.1 и 6.2 частично: конфигурация на сервере проверена (`tmp/VERIFY.md`, «выпуск v0.3.4»); письмо с кодом в реальных Gmail и Яндекс Почте и ответ соавтора в чате на проде проверяет владелец своим аккаунтом.

- `/opsx:verify rename-soavtor`, затем `/opsx:archive`.
- Владельцу: кейс продукта на glavai.ru (`/Users/lehard/glavai`) переименовать отдельно, в том репозитории.
- Проверка названия «Соавтор» на товарные знаки — до открытого запуска.
