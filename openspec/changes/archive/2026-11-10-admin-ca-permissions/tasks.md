# Tasks

Проверка `deploy.sh` идёт на копии в одноразовом контейнере Linux (`docker run --rm --network none`, уже скачанный образ `python:3.13-slim` с GNU coreutils), с путями `ROOT` и `ADMIN_CLIENT_CA`, заменёнными на временный каталог, заглушками `docker` (печатает шлюз сети) и `git` (печатает метку и выходит с кодом 1) в `PATH`, фиктивными `app/.git`, `app/.env` с `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS=<шлюз>/32`, `backups/` и `incoming/<tag>/index.html`. Контейнеры стенда и сервер не трогаются.

## 1. Проверка прав в деплое

- [x] 1.1 Добавить в `deploy/deploy.sh` функцию `check_admin_ca_readable` и её вызов в `check_inputs` после проверки наличия файла (design, D1); проверить на копии: каталог `0750` и файл `0644` — код 1, сообщение называет каталог, `750` и `chmod 751`, метки заглушки `git` нет; каталог `0751` и файл `0600` — код 1 с файлом, `600` и `chmod 644`; каталог `0751` и файл `0644` — проверка проходит и запуск доходит до заглушки `git` (её метка в выводе); файла нет — прежнее сообщение «is missing»
- [x] 1.2 `bash -n deploy/deploy.sh` (`shellcheck` в проекте и на машине нет); проверить: без ошибок

## 2. Документы

- [x] 2.1 README: настройка сервера — `chmod 751 /etc/authorled` с пояснением (design, D2); описание проверок перед деплоем называет права; «Certificate» и «Renewal and loss» — права файла и каталога; проверить: `grep -n "chmod 750" README.md` ничего не находит, `authorled.env` по-прежнему `chmod 640`
- [x] 2.2 `.agents/skills/deploy-platform/SKILL.md` (шаг 2 и строка о потере ключей) и подсказка `scripts/admin_cert.sh` — права каталога; проверить: `grep -rn "admin-client-ca" README.md .agents/skills/deploy-platform/SKILL.md scripts/admin_cert.sh` — каждое место установки файла называет `0751` у каталога; `bash -n scripts/admin_cert.sh`

## 3. Общая проверка

- [x] 3.1 `env -u BASH_ENV ./scripts/validate.sh` в активированном `agno/.venv` и `git diff --check`; проверить: оба без ошибок
- [x] 3.2 Только чтение на сервере: `ssh authorled 'stat -c "%a %U:%G %n" /etc/authorled /etc/authorled/admin-client-ca.pem /etc/authorled/authorled.env; sudo -u caddy test -r /etc/authorled/authorled.env && echo open || echo closed'`; проверить: `751`, `644`, `640` и `closed` — следующий релиз пройдёт новую проверку
- [x] 3.3 Записать в `tmp/VERIFY.md` раздел этого change: прогоны копии `deploy.sh` по четырём случаям, статические проверки, чтение прав на сервере; что выкладка проверяется только следующим релизом

## Workflow follow-up

- Verify, archive (specs synced), merge `origin/main`, проверки и слияние пулл-реквеста — по AGENTS.md («Finish in the same session»).
- Следующий релиз (по просьбе владельца) проходит шаг «Deploy on the server» с новой проверкой.
