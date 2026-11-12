# Проверки caddy-manifest-type (2026-11-12)

## Статические

- `./scripts/validate.sh` и `git diff --check`: прошли. CI пулл-реквеста #89 зелёный.
- `caddy validate` для `deploy/Caddyfile` в `caddy:2.11.9` (версия сервера) с пустым файлом по пути УЦ админки: «Valid configuration». `caddy fmt` файл не меняет.

## Детерминированные

- Причина: Go берёт типы из `/usr/share/mime/globs2`, если такой файл есть, и тогда не смотрит в `/etc/mime.types`. На сервере `globs2` без `.webmanifest`, в образе `caddy:2.11.9` файла `globs2` нет.
- Контейнер `caddy:2.11.9` с теми же блоками и с `globs2` сервера:
  - без строк `header`: `check_manifest.sh` выходит с кодом 1 — у приложения `text/plain`, у сайта тип не указан, как было на проде;
  - со строками: код 0, `application/manifest+json`, со сжатием и без.

## На сервере (релиз v0.3.22, выкладка 43175336805 прошла)

- Шаг «Check the manifest type» зелёный: `app.soavtor.app` и `soavtor.app` отдают `/manifest.webmanifest` с ответом 200 и типом `application/manifest+json`, со сжатием и без.
- Остальные шаги выкладки (`/os/health`, `/os/agents`, сайт, админка) прошли.
