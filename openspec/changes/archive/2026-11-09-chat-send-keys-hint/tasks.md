# Tasks

## 1. Клавиши по системе

- [x] 1.1 Создать `web/src/screens/shared/keys.ts`: `isMac` по `navigator.platform.startsWith("Mac")`, подписи `newLineKey` (`⇧↵` / `Shift+Enter`) и `sendKey` (`↵` / `Enter`); короткий комментарий со ссылкой на спеку `web/workspace`, «Подсказка клавиш в поле чата». Проверка: `npm run typecheck --prefix web` (или `tsc` из `validate.sh`) без ошибок.

## 2. Чат

- [x] 2.1 В `CoauthorChat.tsx` placeholder поля: `${newLineKey}: новая строка`, когда `useMediaQuery("(any-pointer: fine)")` истинно, иначе «Напишите соавтору». Проверка: в Chrome на macOS пустое поле показывает «⇧↵: новая строка»; в эмуляции телефона (Mobile в панели браузера) — «Напишите соавтору».
- [x] 2.2 Обернуть «Отправить» в `Tooltip` дизайн-системы (как `Tool` в `ScreenplayEditor.tsx`): «Отправить» и `sendKey` приглушённым цветом; триггер — обёртка, чтобы подсказка была и у неактивной кнопки; без мыши — без подсказки. Проверка: наведение на кнопку при пустом и непустом поле показывает «Отправить ↵»; `check:native-ui` проходит.
- [x] 2.3 Проверить ширину: окно 1100 px, пустое поле — высота одной строки (24 px) для «⇧↵: новая строка» и, с подменой `navigator.platform` на `Win32`, для «Shift+Enter: новая строка». Проверка: высота поля записана в `tmp/VERIFY.md`.
- [x] 2.4 Пройти сценарий «Клавиши как прежде»: Shift+Enter переводит строку, Enter отправляет, подсказка исчезает с текстом. Проверка: результат в `tmp/VERIFY.md`.
- [x] 2.5 Подсказка поля мелкая и приглушённая: передать в `GrowingTextarea` `placeholderClassName` из `design.md` (решение 3); `GrowingTextarea.tsx` не менять. Проверка: окно 1100 px, пустое поле высотой 24 px, у подсказки `font-size` 12 px, на macOS и с подменой `Win32`; результат в `tmp/VERIFY.md`.

## 3. Общая проверка

- [x] 3.1 `./scripts/validate.sh` и `git diff --check` проходят.

## Workflow follow-up

- Проверка владельцем в Safari; затем `/opsx:archive`.
