# Tasks

## 1. Компонент и проверка

- [x] 1.1 Создать `web/src/design-system/components/GrowingTextarea.tsx` по design (решения 1–4) и экспортировать его из `web/src/design-system/index.ts`. Устройство: обёртка-сетка, копия `<span aria-hidden>` (`invisible`, `whitespace-pre-wrap`, `[overflow-wrap:anywhere]`, текст + пробел, подсказка при пустом значении) и `<textarea rows={1}>` в одной ячейке. Свойства: обязательные `value`, `minRows` и `limit` (`{ rows }`, `{ screen }` или `"none"`; min и max в `lh` и `dvh` на копии), `variant` `"field" | "bare"`, `placeholderClassName`, `className` на обёртке; остальное и `ref` передаются в `<textarea>`. Комментарий над компонентом ссылается на спеку `web/design-system` («Многострочные поля растут с текстом»). Проверка: `npm run typecheck --prefix web` и `npm run lint --prefix web` проходят
- [x] 1.2 В `web/scripts/check-native-ui.ts` добавить два правила (design, решение 6): `<textarea` в `.tsx` из `web/src` только в `design-system/components/GrowingTextarea.tsx`; строки `field-sizing` нет в `.tsx` и `.css` из `web/src`, включая `components/ui`. Поправить комментарий в начале файла. Проверка: временная строка `<textarea />` в любом экране даёт ошибку `check:native-ui` с именем файла; после её удаления ошибка остаётся только для мест, которые ещё не перешли (группа 2)

## 2. Переход мест

- [x] 2.1 `CoauthorChat.tsx`: поле ввода → `GrowingTextarea` с `minRows={1}`, `limit={{ screen: 1 / 3 }}`, `variant="bare"`; обёртка с кнопками, `onKeyDown`, `onPaste` и подписи не меняются. Проверка: `npm run check:chat --prefix web` проходит, клавиши Enter и Shift+Enter и скрепка работают как раньше (группа 3)
- [x] 2.2 `CommentViews.tsx` → `minRows={2}`, `limit={{ screen: 1 / 3 }}`, `variant="field"`, `bg-paper`, тот же `ref`, `autoFocus` и Cmd+Enter. `Field.tsx` → `minRows={rows}`, `limit="none"`, `variant="field"`, `bg-paper`, `id` для `Label`. `SceneBoard.tsx` (биты) → `minRows={4}`, `limit="none"`, `variant="field"`. Проверка: `npm run typecheck --prefix web`
- [x] 2.3 `ProseDoc.tsx` и `NoteDoc.tsx` → `limit="none"`, `variant="bare"`, `placeholderClassName` с нынешней бледной подсказкой, `readOnly` запертого драфта; `minRows` такое, чтобы пустой лист был высотой около нынешних 320 px (сверить снимком до и после в Chromium). Проверка: снимок пустого синопсиса и пустой заметки до и после — высота листа отличается не больше чем на строку
- [x] 2.4 Удалить `web/src/components/ui/textarea.tsx` и заменить комментарий о `field-sizing` в `web/src/design-system/typography.css` на ссылку на `GrowingTextarea`. Проверка: `grep -rn "field-sizing\|ui/textarea" web/src` пусто, `npm run check:native-ui --prefix web` проходит

## 3. Проверка в браузерах

- [x] 3.1 Playwright, WebKit 18 (Playwright 1.48 в окружении scratchpad) и Chromium, окно 1440×900, источник данных `fixtures`, сценарии дельты `web/workspace` «Поле ввода чата растёт с текстом»: пустое поле в одну строку; три строки после длинной фразы из сценария; сорок строк — высота поля не больше 300 px, есть прокрутка внутри, каретка видна; после отправки — одна строка; скрыть и открыть колонку с четырьмя строками — четыре строки. Высоту брать из `getBoundingClientRect`, отсутствие прокрутки — из `scrollHeight <= clientHeight`
- [x] 3.2 Там же сценарии `web/design-system` и «Высота полей документов и комментариев»: синопсис из тридцати абзацев без прокрутки внутри (прокручивается страница); комментарий выше 300 px останавливается на 300 px; восемь строк в поле профиля без прокрутки; при сужении окна с 1440 до 900 px поле с тремя строками становится выше без ввода; длинное слово без пробелов не даёт прокрутки вбок; пустая последняя строка после Shift+Enter занимает место
- [x] 3.3 `./scripts/validate.sh` (с `env -u BASH_ENV`) и `git diff --check` проходят; результаты 3.1–3.3 записаны в `tmp/VERIFY.md` (раздел deterministic, с версиями WebKit и Chromium)

## Workflow follow-up

- Владелец после выкладки проверяет руками в Safari на Mac: длинное сообщение в чате и длинный синопсис.
- Архив change после проверки владельца.
