# Design

## Context

- Требование — дельта `specs/web/design-system/spec.md`, мотивация — `proposal.md`.
- Стили дизайн-системы: `tokens.css` (токены, `@theme`), `typography.css` (`@layer components`: шкала текста, стол, бумага, пометки, `InkLoader`). Базовых правил для элементов страницы (`@layer base`) своих нет: Tailwind preflight сбрасывает только поля и рамки.
- Найдено по коду 2026-10-31: `title` на абзацах в `TextDoc.tsx`; нативный флажок в `Showcase.tsx`; `Textarea` shadcn без `resize-none`; собственные кнопки и ссылки (`.tree-item`, обложки, ссылки) без своего фокуса — Chrome рисует системную обводку; полос прокрутки, выделения, курсора и автозаполнения дизайн-система не задаёт.

## Goals / Non-Goals

**Goals:** один вид этих элементов на всех экранах без правки каждого компонента; проверка, которая ловит возврат системных подсказок и нативных полей выбора.

**Non-Goals:** см. proposal.

## Decisions

1. **Базовый слой дизайн-системы.** В `typography.css` добавляется `@layer base` с правилами для всей страницы (тот файл уже грузится везде и отвечает за «бумагу» и стол). Отдельный файл не нужен.

2. **Полосы прокрутки.**
   - Chrome и Safari: `::-webkit-scrollbar` 10 px, дорожка прозрачная, бегунок — `color-mix(in oklch, var(--foreground) 22%, transparent)` с прозрачной рамкой 3 px (`background-clip: padding-box`) и полным скруглением, при наведении 38%; угол прозрачный.
   - Firefox: `scrollbar-width: thin; scrollbar-color: <бегунок> transparent` внутри `@supports not selector(::-webkit-scrollbar)`, потому что Chrome 121+ при заданном `scrollbar-color` игнорирует `::-webkit-scrollbar`.
   - Цвет — смесь `--foreground` с прозрачностью, поэтому новый токен не нужен и он работает во всех темах.

3. **Выделение и курсор.** `::selection` — фон `color-mix(--primary 24%, transparent)`, текст наследуется; `caret-color: var(--primary)` на полях.

4. **Фокус.** `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; border-radius: inherit }` для всех элементов; у компонентов shadcn остаётся их кольцо (`focus-visible:ring-3`) и `outline-none`, у остальных — это правило. `:focus:not(:focus-visible)` без обводки (клик мышью).

5. **Автозаполнение.** `input:-webkit-autofill` (и `:autofill`) — `-webkit-text-fill-color: var(--foreground)`, фон через `box-shadow: 0 0 0 1000px var(--paper) inset` (фон автозаполнения Chrome иначе не перекрыть), `transition: background-color 9999s` против мигания.

6. **Многострочные поля.** `textarea { resize: none }` в базовом слое: все наши поля растут по содержимому (`field-sizing: content`).

7. **Подсказка абзаца.** `TextDoc` оборачивает абзац в `Tooltip` shadcn (уже есть в `components/ui/`) с типом абзаца, открытие с задержкой 600 мс, `TooltipProvider` один на экран. Флажок витрины — `Checkbox`.

8. **Проверка.** Новый скрипт `web/scripts/check-native-ui.ts` (Node с удалением типов, как `check-contrast.ts`) разбирает `.tsx` в `web/src`, кроме `components/ui/`, и ищет открывающие теги со строчной буквы (HTML-элементы) с атрибутом `title`, `<input>` с `type="checkbox"` или `type="radio"` и `<select>`; теги разбираются целиком, даже если Prettier разнёс атрибуты по строкам. Пропсы компонентов (`<MessageScreen title=…>`) правило не задевает. Ошибка — файл, строка и элемент. Команда `check:native-ui` встаёт в `validate.sh` рядом с `check_web_tokens`.

## Risks / Trade-offs

- [Своя полоса прокрутки на macOS видна всегда, системная скрывается после прокрутки] → тонкая и полупрозрачная, без дорожки; это осознанный выбор «всё в нашем дизайне».
- [Разбор тегов без парсера TSX может ошибиться на `>` внутри выражений атрибутов] → скрипт учитывает фигурные скобки и строки при поиске конца тега; ложные срабатывания видны в выводе и исправляются в скрипте, без исключений для файлов.
- [Нет системной обводки — меньше заметен фокус в сторонних компонентах] → кольцо `--ring` проходит контраст 3:1 (уже в `check:contrast`).
