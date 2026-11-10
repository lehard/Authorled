# Tasks

## 1. Карточка «Новая история»

- [x] 1.1 В `web/src/screens/shelf/ShelfScreen.tsx` кнопке «Новая история» добавить `cursor-pointer` и кольцо фокуса, как у ссылки карточки истории (`outline-none focus-visible:ring-3 focus-visible:ring-ring/50`). Проверка: в браузере над карточкой курсор — рука; Tab до карточки показывает кольцо, Enter открывает диалог «Новая история».
- [x] 1.2 Пустой рамке (`span` с пунктиром) при наведении на `group/new` дать подъём на 3px с переходом 0.15s, как у `.book` в `web/src/screens/workspace.css` (`translateY(-3px)`, `transform 0.15s`); смену цвета рамки и плюса оставить. Делать утилитами Tailwind в `ShelfScreen.tsx`, без новых правил в CSS; тень не добавлять. Проверка: в браузере обложка истории и рамка «Новой истории» при наведении поднимаются на одну высоту (сравнить `getBoundingClientRect().top` до и после наведения у обеих — разница 3px).

## 2. Проверка

- [x] 2.1 `./scripts/validate.sh` (через `env -u BASH_ENV`, с активированным `agno/.venv`) и `git diff --check` проходят; `./web/scripts/check_web_tokens.sh` — без сырых цветов.
- [x] 2.2 Проверка в браузере на полке, в светлой и тёмной темах, на ширине 1280 и 375 px: рука и подъём у обеих карточек, кольцо фокуса у «Новой истории», кнопки вне полки (например, «⋯», «Корзина») по-прежнему со стрелкой. Результаты записать в `tmp/VERIFY.md`.

## Workflow follow-up

- Verify, archive со синхронизацией спеки `web/workspace`, merge `origin/main`, PR в `main` (правила `CLAUDE.md`, «OpenSpec is mandatory», п. 4).
