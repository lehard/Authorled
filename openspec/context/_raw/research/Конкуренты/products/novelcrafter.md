# Novelcrafter

## 1. Что это и для кого
Веб-инструмент для длинной прозы с Codex (библия), планированием (Grid, Matrix, Outline) и ИИ, который пользователь подключает сам (BYOK). Для пишущих, которым нужен контроль над моделями, промптами и стоимостью. Сайт https://www.novelcrafter.com, справка https://www.novelcrafter.com/help. Дата проверки 2026-10-27; changelog до 19 окт 2026: https://www.novelcrafter.com/changelog

## 2. Цена и платформы
- Scribe $4 (без ИИ), Hobbyist $8 (BYOK, сводки сцен, извлечение персонажей, генерация по битам), Artisan $14 (Workshop Chat), Specialist $20 (приглашения, команды, приоритетная поддержка); годовая оплата «2 месяца в подарок». https://novelcrafter.com/pricing
- Бесплатного тарифа нет, пробный период 21 день без карты; пожизненной покупки нет (https://www.novelcrafter.com/help/faq/general/is-there-a-lifetime-payment-option). После отмены доступ только на чтение и экспорт.
- Платформы: веб; установка как PWA в Chrome/Edge/Safari на десктопе (https://www.novelcrafter.com/help/faq/general/web-app); офлайна нет (https://www.novelcrafter.com/help/faq/general/can-i-use-nc-in-ofline-mode). Нативных и мобильных приложений в справке нет.

## 3. Сильные стороны
- Codex с правилами «когда отдавать ИИ» (always / when detected / don't include / never), алиасами, отношениями и progressions по сценам: https://www.novelcrafter.com/help/docs/codex/codex-tracking , https://www.novelcrafter.com/help/docs/codex/progressions-additions
- Полностью настраиваемая система промптов: компоненты, входы, пресеты, персоны, коллекции моделей: https://www.novelcrafter.com/help/docs/prompts/prompt-types
- Prompt Preview — видно точный промпт: https://www.novelcrafter.com/help/docs/prompts/prompt-preview
- BYOK: OpenAI, Anthropic, Gemini, OpenRouter (100+ моделей по справке, 300+ по маркетингу), локальные Ollama и LM Studio: https://www.novelcrafter.com/help/faq/ai-connections/does-novelcrafter-provide-its-own-ai , https://www.novelcrafter.com/
- Matrix (записи Codex и подсюжеты × сцены) и Appearance Heatmap: https://www.novelcrafter.com/help/docs/plan/planning-with-the-matrix

## 4. Функции по разделам таксономии (кратко; полный список в novelcrafter.csv)
- Редактор: жирный/курсив/подчёркнутый/зачёркнутый, заголовки, списки, цитаты, выравнивание, шрифт и размер, настраиваемые разделители сцен (https://www.novelcrafter.com/help/docs/write/formatting-text , https://www.novelcrafter.com/help/docs/write/the-write-interface); focus mode; тёмная тема; undo и история сцены. Массового поиска и замены нет (https://www.novelcrafter.com/help/faq/general/is-there-a-find-and-replace). Комментариев нет, заметки через секции (https://www.novelcrafter.com/help/faq/write/annotate-text). Сценарного редактора нет; есть пресет Script (https://www.novelcrafter.com/help/faq/ai-and-prompting/script-and-screenplays).
- Структура: акты → главы → сцены, метки, архив, Create from Outline с восемью шаблонами (https://www.novelcrafter.com/help/docs/plan/create-from-outline), Outline со сворачиваемыми главами, обновление организации от 24.09.2026.
- Библия: шесть типов записей (персонажи, локации, предметы, лор, подсюжет, прочее; свои типы добавлять нельзя), теги, одно изображение, связи, Mentions по рукописи/чатам/сниппетам, Series Codex (https://www.novelcrafter.com/help/docs/codex/codex-types).
- Цели и статистика: Word Statistics, Characters per Scene; целей и серий дней в справке не найдено.
- Версии и совместная работа: история сцен/Codex/промптов с восстановлением (без сравнения), роли viewer/editor, команды на Specialist; без реального времени (https://www.novelcrafter.com/help/docs/app/collaboration-and-coauthoring).

## 5. ИИ
**Что умеет** (UI: слэш-меню `/` в рукописи, меню выделения, вкладка Chat, библиотека промптов):
- Scene beat / Continue writing: `/` → указания → выбор входов → Apply / Retry / Discard / Section; «Tweak and Generate» для смены модели и входов: https://www.novelcrafter.com/help/docs/write/generating-prose , https://www.novelcrafter.com/help/faq/write/scene-beat-vs-continue-writing
- Text replacement: Expand, Rephrase (POV, время, мысли, диалог, пассив → актив, «show»), Shorten; нужно ≥4 слов выделения; инструкции в квадратных скобках: https://www.novelcrafter.com/help/docs/write/text-replacement-prompts
- Scene Summarization (~80 слов) и Detect Characters (наполняет Codex из сцены): https://www.novelcrafter.com/help/docs/prompts/prompt-types , https://novelcrafter.com/features
- Workshop Chat (Artisan+): контекст выбирается вручную — весь роман, акты/главы/сцены, сниппеты, записи Codex; упоминание имени или алиаса подтягивает запись; смена модели и промпта на лету; Extract переносит результат в Codex, план, биты: https://www.novelcrafter.com/help/docs/chat/the-chat-interface , https://www.novelcrafter.com/help/docs/organization/the-extract-feature , https://www.novelcrafter.com/help/faq/chat/novelcrafter-vs-gpt-claudeai
- Стиль автора: пресет Your Voice + сниппет-образец: https://www.novelcrafter.com/help/faq/write/writing-samples
- Генераторы названий книги, персонажей, локаций, предметов; «Critique» прозы: https://novelcrafter.com/features
- Reasoning/thinking (бета, с января 2026): https://www.novelcrafter.com/help/docs/models/thinking-settings

**Сборка контекста** (шесть шагов): упоминания в бите и тексте до него → ручные ссылки сцены → запись POV-героя → глобальные → дочерние (relations) → фильтр записей без текста. Сортировка: глобальные, тип, имя. https://www.novelcrafter.com/help/faq/ai-and-prompting/codex-context-in-prompting . Скрыть от ИИ можно часть сцены (секция), всю сцену или деталь Codex: https://www.novelcrafter.com/help/faq/write/hiding-information-from-ai

**Оплата.** Novelcrafter собственных моделей и кредитов не предоставляет; ИИ оплачивается напрямую провайдеру по токенам (вход/выход отдельно) без наценки. Пример справки (ноябрь 2024): промпт «бит → проза» ~4 200 токенов на входе и 500 на выходе стоит от <$0.001 (GPT-4o mini) до ~$0.10 (Claude Opus). Есть фиксированные тарифы провайдеров (featherless и др.) и бесплатные модели через OpenRouter. https://www.novelcrafter.com/help/faq/ai-and-prompting/ai-cost . Сообщение «out of AI credits» относится к лимиту провайдера.

**Данные.** Справка не описывает хранение и обучение на текстах; единственный вариант без отправки третьим лицам — локальная модель. Политика конфиденциальности не открывалась.

**Языки.** Любой язык, который поддерживает модель, кроме письма справа налево: https://www.novelcrafter.com/help/faq/general/language-compatibility . Язык интерфейса не проверен.

## 6. Импорт, экспорт
Импорт: .docx и Markdown (акты H1, главы H2, сцены `***`, без картинок и оглавления); в оглавлении справки есть страница про Apple Pages (https://www.novelcrafter.com/help/docs/import/word). Экспорт: .docx и Markdown с выбором частей, плюс Codex, чаты, сниппеты; гайды по Scrivener и Atticus (https://www.novelcrafter.com/help/docs/export/novel). Книжной вёрстки и EPUB нет, вёрстка «планируется» (https://www.novelcrafter.com/help/faq/export/format-for-export).

## 7. Жалобы пользователей
Крутая кривая обучения и сложная первичная настройка, затраты на API сверх подписки (вторичная оценка $10–50 в месяц), лаги при сотнях записей Codex или открытии всего романа. Источники: https://www.novelcrafter.com/help/faq/general/novelcrafter-lagging , https://www.jenova.ai/en/resources/novelcrafter (обзор, частично вторичные данные). Нет массовой замены текста — «одна из самых запрашиваемых» (справка).

## 8. Что взять Authorled
- Четыре режима участия записи библии в ИИ-контексте и правило автодобавления по упоминаниям/алиасам.
- Progressions: факты о персонаже, видимые ИИ только начиная с нужной сцены.
- Prompt Preview — показать пользователю собранный контекст.
- Extract: перенос ответа чата в структуру (библия, план).
- Matrix «записи × сцены» и heatmap появлений.
- Секции-заметки внутри сцены с переключателем «читает ли ИИ».

## 9. Не проверено и расхождения
- Каталог моделей через OpenRouter: «100+», «180+», «300+» в разных источниках.
- Справка по импорту: «Word и Markdown», но в оглавлении есть страница Apple Pages.
- Pricing: «Advanced review tools» и Universes помечены как planned; Workshop Chat у Artisan не отмечен как planned.
- Hover-карточки, шаблоны анкет персонажей, цели письма, орфография, язык интерфейса, мобильные приложения, политика обучения — подтверждения не найдено.
- Статистика цен ИИ в справке датирована ноябрём 2024; пересчёт на 2026 не делался.
- Источники по жалобам вторичные; прямых Reddit-тредов поиск не вернул.
