# Tasks

## 1. Стили

- [x] 1.1 Вынести правило `input:autofill, input:-webkit-autofill` из `@layer base` в конец `web/src/design-system/typography.css` вне слоёв: `-webkit-text-fill-color: var(--foreground)`, `caret-color: var(--primary)`, `transition: background-color 0s 600000s, color 0s 600000s`; убрать `box-shadow` с `--paper`

## 2. Проверка в коде

- [x] 2.1 `web/scripts/check-native-ui.ts`: найти правило автозаполнения в CSS `web/src/design-system/`, проверить, что оно вне `@layer` и задаёт цвет текста и задержку; иначе ошибка с названием правила; обновить описание и итоговое сообщение скрипта
- [x] 2.2 Убедиться, что проверка падает без правила (временно переименовать селектор, правку убрать)

## 3. Проверка

- [x] 3.1 `./scripts/format.sh`, `./scripts/validate.sh`, `git diff --check`
- [x] 3.2 Браузер: экран входа, имитация автозаполнения (жёлтый фон и цвет Chrome с `!important`) в светлой, сепии и тёмной темах; поле в покое, в фокусе и с ошибкой — фон как без автозаполнения, текст `--foreground`, рамки видны; итоги и ограничения в `tmp/VERIFY.md`
