# Знак и логотип «Соавтор»

Знак: буква «С» на чернильной плашке и курсор соавтора цвета лампы («Кабинет», ADR-006). Выбран владельцем 2026-11-12.

| Цвет | Hex | Токен |
| --- | --- | --- |
| Плашка | `#2b4d8e` | `--blue-9` светлой темы |
| Буква | `#fefdf9` | `--neutral-1` |
| Курсор | `#e6af6e` | `--amber-7` |
| Слово, светлый фон | `#1a222f` | `--neutral-12` |

Шрифт слова — Literata (вес 560, opsz 48), переведена в кривые: SVG не зависит от шрифтов.

## Файлы

- `mark.svg` — основной знак, сетка 32, скруглённая плашка; от 24 px и крупнее.
- `mark-16.svg` — отрисовка под 16 px (толщины и курсор по пиксельной сетке).
- `mark-square.svg` — без скругления, для iOS (система скругляет сама).
- `mark-maskable.svg` — с полем под маску Android.
- `logo-light.svg`, `logo-dark.svg` — знак со словом для светлого и тёмного фона.
- `export/` — готовые растры: `favicon.ico` (16, 32, 48; 16 — из `mark-16.svg`), `favicon-16|32|48.png` (кадры ICO),
  `apple-touch-icon.png` (180, из `mark-square.svg`), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (из
  `mark-maskable.svg`), манифест приложения `manifest.webmanifest` и манифест сайта `site.webmanifest`.
- `preview.png` — лист проверки: знак в 16, 32 и 96 px на светлом и тёмном фоне, логотипы, значки iOS и Android.

Минимальный размер знака со словом — 24 px по высоте; поле вокруг — не меньше четверти высоты знака.
Не перекрашивать плашку и не ставить курсор слева от буквы.

## Копии

Источник — только эта папка (спека `web/brand`). `web/public/` и `site/public/` держат копии байт в байт,
`./scripts/check_brand.sh` (часть `validate.sh`) сверяет их по таблице в самом скрипте:

| Копия в `web/public/` и `site/public/` | Источник |
| --- | --- |
| `favicon.svg`, `brand-mark.svg` | `mark.svg` |
| `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | `export/` |
| `manifest.webmanifest` | `export/manifest.webmanifest` у приложения, `export/site.webmanifest` у сайта |

После правки источника скопируйте файлы заново и запустите `check_brand.sh`.

## Пересборка растров

Растры не собираются в сборке: они лежат готовыми. Если меняется SVG:

1. Отрисуйте каждый SVG в PNG нужного размера в headless Chrome через `playwright-core` из `site/node_modules`
   (`chromium.launch({ executablePath: <Chrome> })`, страница с одним `<svg width height>`,
   `page.screenshot({ omitBackground: true })`): `mark-16.svg` → 16, `mark.svg` → 32, 48, 192, 512,
   `mark-square.svg` → 180, `mark-maskable.svg` → 512.
2. Соберите ICO из трёх кадров Pillow: `Image.open("favicon-48.png").save("favicon.ico", sizes=[(16,16),(32,32),(48,48)],
   append_images=[кадр 16, кадр 32])`.
3. Слово логотипа — кривые из Literata (вес 560, opsz 48) через fontTools (`instantiateVariableFont`, `SVGPathPen`).
