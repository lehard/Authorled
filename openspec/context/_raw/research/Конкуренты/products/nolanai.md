# NolanAI (теперь FinalBit)

## 1. Что это и для кого

Веб-платформа компании FinalBit для кино и сериалов: сценарный редактор с ИИ-соавтором, оценка сценария, а дальше подготовка к съёмкам (разметка, расписание, бюджет, раскадровка, питч-дек, видео). Для инди-режиссёров, сценаристов, продюсеров, студий и киношкол ([сайт](https://www.finalbitai.com/), [llms-full.txt](https://www.finalbitai.com/llms-full.txt)). NolanAI переименован в FinalBit: «тот же продукт, та же команда», nolanai.app переадресует на finalbitai.com, приложение работает на studio.nolanai.app ([NolanAI is now FinalBit](https://www.finalbitai.com/nolan-ai), [блог](https://www.finalbitai.com/blog/we-are-now-finalbit-heres-why)). Справка: [help.finalbitai.com](https://help.finalbitai.com/en/) (Intercom, около 85 статей), changelog: [releases](https://www.finalbitai.com/releases). Версия: v3.19.0 от 25 сентября 2026. Дата проверки: 2026-11-08.

Путаница имён: брали только сценарный продукт FinalBit. Режиссёр Кристофер Нолан, «Nolan» в каталогах ИИ (на theresanaiforthat отзывы, похоже, о другом продукте) и прочие «Nolan» сюда не входят.

## 2. Цена и платформы

- Basic 0 USD: 1 активный сценарий (с 25 сентября 2025), 100 разовых запросов к ИИ, экспорт PDF и FDX с водяным знаком, история 3 дня ([цены](https://www.finalbitai.com/pricing), [Free Plan](https://help.finalbitai.com/en/articles/12357456-what-s-changing-in-the-free-plan)).
- Creator: 120 USD за 3 месяца (около 40 USD в месяц), Pro: 300 USD за 3 месяца (около 100 USD в месяц). Скидка 10% при оплате за 3 месяца, 30% за год. На странице цен ещё промокод USEFB30 на 30%. На Creator ИИ без лимита, 10 отчётов Coverage и 10 Plot Hole в месяц, 100 кредитов на видео; на Pro «Pro AI» с более глубоким контекстом, бюджет, автоматическая разметка, читка, 210 кредитов ([цены](https://www.finalbitai.com/pricing)).
- 7 дней пробы Creator или Pro, нужна карта; деньги не возвращают; студентам 50% на годовой тариф; есть Enterprise и программа для школ ([проба](https://help.finalbitai.com/en/articles/16527808-does-finalbit-offer-a-free-trial), [возврат](https://help.finalbitai.com/en/articles/9976925-can-i-get-a-refund-on-my-plan), [Education](https://www.finalbitai.com/education)).
- Платформа: только браузер ([FinalBit](https://www.finalbitai.com/nolan-ai)); Safari поддерживается с v2.9.13. Десктопных и мобильных приложений не нашли.

## 3. Сильные стороны

- Сценарий связан с производством: правка сцены сразу обновляет разметку, расписание, раскадровку и бюджет ([Breakdown](https://www.finalbitai.com/features/automatic-script-breakdown), [v3.17.0](https://www.finalbitai.com/releases/FinalBit-v3.17.0-collaborative%20film%20pre-production%20software)).
- Много аналитики ИИ по запросу: Coverage с оценкой, Plot Hole Detection, Script Doctor с принятием правок одним кликом ([Coverage](https://www.finalbitai.com/features/ai-script-coverage-for-film-producers-and-writers), [Plot Hole](https://www.finalbitai.com/features/plot-hole-detection-report), [v2.14](https://www.finalbitai.com/releases/nolanai-v2-14-the-inception-rewritten-update)).
- Чат-соавтор Blake (Co-Pilot) с выбором модели (Claude, GPT, Gemini, Grok), выбором сцен в контекст и 17 готовыми сниппетами (скриншоты владельца, [редактор](https://www.finalbitai.com/features/free-professional-ai-screenplay-editor)).
- Старт с идеи, тритмента или питч-дека: ИИ строит аутлайн по актам, автор проверяет, потом получает черновик до ~36 сцен ([v3.16.0](https://www.finalbitai.com/releases/new-ways-to-start-a-film-tv-project)).
- Частые релизы (около 45 с конца 2023), эпизодика и вертикальные микродрамы ([v3.15.0](https://www.finalbitai.com/releases/micro-drama-episodic-production-tools)).

## 4. Функции по разделам

- Редактор: элементы сценария на Cmd+1–7 (включая Act), Tab переключает типы, жирный, курсив, подчёркивание, зачёркивание, отмена и повтор, поиск и замена ([шорткаты](https://help.finalbitai.com/en/articles/9916140-keyboard-shortcuts), [поиск](https://help.finalbitai.com/en/articles/9934323-is-there-a-find-and-replace)). Courier 12, шрифт меняется только при экспорте ([шрифт](https://help.finalbitai.com/en/articles/14893519-how-do-i-check-the-editor-font-size)). Титульная страница с контактами, номера сцен, залоченные версии с суффиксами 2A/2B ([v2.6.10](https://www.finalbitai.com/releases/nolanai-v2-6-10), [v3.11](https://www.finalbitai.com/releases/finalbit-v3-11-locked-script-versions-with-suffixes-and-advanced-ai-images)). По скриншотам владельца: левая панель Scenes/Characters с поиском и кнопкой Add a New Scene, меню Dashboard, Edit, Share, Tools, Help, вкладки Deck и Reports, счётчик страниц и слов, тёмная тема. Двойной диалог, CONT'D, автодополнение и цветные ревизии нигде не описаны.
- Структура: проект собирает сценарии, разметку, расписание, шот-лист, раскадровку, питч-дек и отчёты ([Project](https://help.finalbitai.com/en/articles/9960440-what-is-project)). Форматы: фильм, пилот сериала, Video Shorts для TikTok/Instagram ([загрузка](https://help.finalbitai.com/en/articles/9939666-how-to-upload-existing-script)). Тритмент, трёхактная структура по Save the Cat, бит-шит ([v2.10.0](https://www.finalbitai.com/releases/nolanai-v2-10-0-introducing-treatments-and-more), [бит-шит](https://help.finalbitai.com/en/articles/14072322-how-to-generate-a-beat-sheet-from-your-screenplay)). Перетаскивания сцен по справке нет ([порядок сцен](https://help.finalbitai.com/en/articles/9940634-how-to-re-arrange-scenes)), удаление сцены необратимо ([удаление](https://help.finalbitai.com/en/articles/9940632-how-do-i-delete-scenes)).
- Доски: корк-доски и таймлайна истории в официальных источниках нет; есть арки и сеть отношений персонажей как ИИ-инструменты ([Character Development](https://www.finalbitai.com/features/character-development)).
- Библия: карточки персонажей с описанием и фото (своё или сгенерированное), Generate Character ([персонаж](https://help.finalbitai.com/en/articles/9940497-how-to-add-a-new-character)). Локации, реквизит и костюмы есть только как элементы разметки. Варианты имени сводятся в одного персонажа ([v3.19.0](https://www.finalbitai.com/releases/ai-script-breakdown-bulk-tagging-cast-list)).
- Цели и статистика: цели по фазам разработки и прогресс (v2.10.0), счётчик страниц и слов, присутствие персонажей по сценам в разметке.
- Версии: автосохранение, история 3, 90 или 365 дней по тарифу, сравнение бок о бок, восстановление, авторство каждой правки ([цены](https://www.finalbitai.com/pricing), [v3.17.0](https://www.finalbitai.com/releases/FinalBit-v3.17.0-collaborative%20film%20pre-production%20software)).
- Совместная работа: живое соавторство с 2024 года, комментарии, роли Editor и Viewer, приглашение по email, бесплатно 1 общий проект ([v2.6.16](https://www.finalbitai.com/releases/nolanai-v2-6-16-enhanced-collaboration-features-on-nolanai), [v3.7.0](https://www.finalbitai.com/releases/nolanai-v3-7-0), [ColLab](https://help.finalbitai.com/en/articles/9940643-how-do-i-add-a-collaborator-invite-a-friend)).
- Производство: разметка ИИ, расписание со стрипбордом и агентом Neil, DOOD, call sheets, шот-лист, бюджет ИИ, раскадровка, видео, питч-дек с подбором актёров, читка 400+ голосами ([функции](https://www.finalbitai.com/features), [Scheduling](https://www.finalbitai.com/features/scheduling), [Table Read](https://www.finalbitai.com/features/ai-audio-table-read)).

## 5. ИИ

- Co-Pilot 2.0 (в интерфейсе чат «Blake (Co-Pilot)»): выделить абзац или сцену и попросить сменить тон, сократить, отполировать диалог; правка сцены или всего сценария (весь сценарий только на Pro); история подсказок, правка перед вставкой ([Co-Pilot](https://www.finalbitai.com/features/ai-copilot), [v3.3.0](https://www.finalbitai.com/releases/nolanai-v3-3-0-new-co-pilot-for-nolanai-editor), [v2.12.5](https://www.finalbitai.com/releases/nolanai-v2-12-5-directors-cut)). По скриншотам: подсказка «Select any text… and click the Ask AI button», выбор модели (GPT-5.6 Terra), список Scenes для контекста, 17 сниппетов с поиском (Brainstorm Ideas, Plot Twist Generator, Script Diagnostics, Filler Finder, Story Momentum Check и др.), у ответа Copy, лайк и дизлайк (Insert виден только на демо-картинке в пустом чате), дисклеймер «FinalBit may make mistakes».
- По скриншотам из заметки владельца «Нолан» (2026-11-08):
  - Онбординг Starting Your Story: одно обязательное поле Plot, Submit, и ИИ пишет начало сценария. У владельца из одной строки вышло 16 сцен, 9 страниц, 1669 слов; есть Skip. Первое, что видит автор, — ИИ пишет за него.
  - Панель над выделением: Convert To (тип элемента), Ask AI, комментарий, история, цвет, ВСЕ ЗАГЛАВНЫЕ, B I S U. Меню Ask AI: Fix Spelling & Grammar, Improve Writing, Continue Writing, Other, Adjust Tone (Dark, Light, Sad, Scary, Sinister, Exciting, Comic, Crazy). Ответ уходит в чат Co-Pilot.
  - Continue Writing переписал и сам выделенный фрагмент (строки изменены и разбиты), потом продолжил на несколько сцен до BLACKOUT. Разницы с исходником не показано, вставить можно только копированием.
  - Разговоры с Co-Pilot хранятся списком: название по запросу, дата, удаление.
  - На дашборде проекта: обложка (Generate Cover ИИ или Upload), синопсис, жанр, язык, число версий; вкладки Editor, Breakdown, Scheduling, Budgeting, Shot List, AI Video, Storyboard, Deck, Plot Hole, Script Coverage; агент Orson с выбором модели. Меню Tools повторяет вкладки, Reports — Plot Hole и Script Coverage; Edit — Title Page, Synopsis, Find.
  - Комментарии: подчёркнутый фрагмент, значок с числом на полях, панель с автором, сценой, цитатой и кнопками «решено» и «удалить».
- Отчёты: Coverage (логлайн, синопсис, персонажи, комментарии, оценка), Plot Hole Detection (причинность, правила мира, поведение персонажей), Script Doctor (формат, темп, диалоги; предложения с подсветкой и принятием в один клик) ([Script Doctor](https://www.finalbitai.com/features/smart-formatting), [как исправить сценарий](https://help.finalbitai.com/en/articles/15003492-how-can-i-use-ai-to-fix-or-improve-my-screenplay)).
- Агенты: Orson (чат по проекту, создание историй, на Claude 4.8), Neil (расписание), Reel (видео) ([v3.6.0](https://www.finalbitai.com/releases/nolanai-v3-6-0), [v3.13](https://www.finalbitai.com/releases/finalbit-v3-13-update-video-editor-v2-reel-ai-director)).
- Модели: Claude, GPT, Gemini, Grok; в 2026 добавлены GPT-5.4, Claude 4.6–4.8, Gemini 3.1 Pro ([v3.12](https://www.finalbitai.com/releases/finalbit-v3-12-gpt-5-4-claude-4-6-gemini-3-1-update)). Ответы ИИ на языке сценария: испанский, французский, русский, португальский ([языки](https://help.finalbitai.com/en/articles/9940624-how-do-i-use-nolanai-in-a-different-language)).
- Оплата: запросы входят в тариф (Basic 100 разово, Creator и Pro без лимита), видео за кредиты. Свой ключ API не описан.
- Подача: «помогает, а не заменяет», полный сценарий ИИ «не напишет» ([справка](https://help.finalbitai.com/en/articles/9934325-how-to-generate-a-complete-100-page-screenplay), [About](https://www.finalbitai.com/about-us)). При этом с v3.16.0 ИИ собирает черновик до ~36 сцен из идеи.
- Данные: работы не используют для обучения своих моделей, договоры с поставщиками LLM запрещают обучение, права остаются у автора ([Privacy](https://www.finalbitai.com/privacy-policy), [обучение](https://help.finalbitai.com/en/articles/14126629-do-you-train-ai-models-on-my-scripts-or-share-them-with-other-users), [IP](https://help.finalbitai.com/en/articles/14126477-if-i-upload-my-script-to-finalbit-do-i-still-100-own-my-ip)).

## 6. Импорт, экспорт, формат файлов

- Импорт: PDF, FDX, Fountain, DOCX; при нестандартной вёрстке PDF распознаётся с ошибками ([v3.16.0](https://www.finalbitai.com/releases/new-ways-to-start-a-film-tv-project), [PDF](https://help.finalbitai.com/en/articles/9939866-when-i-upload-a-script-in-pdf-format-i-notice-that-its-formatting-appears-incorrect)). Импорт источников для старта (тритмент, питч-дек, аутлайн).
- Экспорт сценария: PDF (шрифт и размер настраиваются) и FDX; на бесплатном с водяным знаком ([цены](https://www.finalbitai.com/pricing), [экспорт PDF](https://help.finalbitai.com/en/articles/14496658-can-i-increase-the-font-size-when-exporting-my-script-to-pdf)). Экспорт Fountain и DOCX не подтверждён.
- Производство: разметка в PDF и FDX, расписание и DOOD в PDF, CSV и Excel, шот-лист и раскадровка в PDF, бюджет в PDF и Excel (Pro).
- Открытого формата хранения нет в описании; данные в облаке.

## 7. Жалобы пользователей

Независимых отзывов мало. G2: 4,3 из 6 отзывов, минусы «неточность, порог входа, слабое качество текста» (по выдаче поиска, страница отдаёт 403) ([G2](https://www.g2.com/products/nolanai-finalbit/reviews)). Product Hunt: отзывов нет, запуск в 2023 ([PH](https://www.producthunt.com/products/nolanai/reviews)). Обзор Screenweaver: качество подсказок «смешанное», шаблонные диалоги, много воды, мало способов видеть всю историю как таймлайн ([Screenweaver](https://www.screenweaver.ai/blog/top-ai-tools-screenwriters-2026)). AIChief: мало подробностей о возможностях ИИ, порог входа ([AIChief](https://aichief.com/ai-text-tools/nolan-ai/)). Сам FinalBit в своём обзоре признаёт: модули мельче профильных инструментов, не индустриальный формат файла, порог входа ([блог](https://www.finalbitai.com/blog/ai-screenwriting-tools-2026)). Обсуждений на Reddit не нашли.

## 8. Что взять Authorled

- Готовые запросы с поиском, разбитые на «придумать» и «проверить». Наши быстрые действия делать «проверочными» (Script Diagnostics, Filler Finder, Story Momentum Check), а генеративные (Plot Twist Generator) не давать или переделать в вопросы автору.
- Контекст выбирает автор: список сцен под чатом. Вместе с ним стоит показывать, на что опирается ответ, и честно сообщать о переполнении контекста (у FinalBit это просто ошибка Context Length Exceeded).
- Отчёты по запросу (Coverage, Plot Hole, Script Doctor) как отдельная вкладка Reports. Script Doctor показывает предложения в тексте и даёт перейти к сценам с правками, это близко к нашим предложениям правок.
- История подсказок, правка перед вставкой и отложенное применение. Оценка лайк/дизлайк у ответа — сигнал качества для наших эвалов.
- Как не надо: Continue Writing молча переписывает выделенный текст автора и отдаёт результат в чат, откуда его надо копировать. У нас правка — предложение по месту с видимой разницей и решением автора.
- Онбординг «одна строка → 16 сцен» противоположен нашему. Наш первый экран может задать автору 2–3 вопроса об истории вместо генерации.
- Меню действий над выделением компактно: тип элемента, ИИ, комментарий, история в одной панели. Список тонов (Adjust Tone) у нас уместен как вопрос «какой тон ты хочешь здесь?», а не как перепись.
- Позиционирование «ИИ помогает, а не пишет» без генерации всего сценария. У FinalBit слова расходятся с делом: черновик до ~36 сцен из идеи. Это место для нашего отличия.

## 9. Не проверено и расхождения

- Цены. На официальной странице по умолчанию показан период 3 месяца (Creator 120 USD, Pro 300 USD; со скидкой 108 и 270, с промокодом 75,60 и 189). Месячную цену на странице не увидели; 40 USD для Creator подтверждает релиз v3.6.1. G2 и TopAI пишут 40 и 100 USD в месяц, Techjockey от 40 USD, AIChief Pro 19 и Studio 49 USD (устарело).
- Script Doctor: в справке «только Pro», в сравнении тарифов отмечен и у Creator.
- Импорт: в справке PDF и FDX «только для Basic и Pro», Fountain бесплатно; в сравнении тарифов PDF и Final Draft Import есть на всех тарифах.
- Бесплатный тариф: блог «без ограничения проектов и водяных знаков», страница цен: 1 сценарий и водяной знак. Запросы ИИ: «100 разовых» в таблице и «на 30 дней» в описании тарифа.
- Порядок сцен: справка говорит, что перетаскивания нет; страница редактора обещает двигать сцены вверх и вниз.
- Формат: блог FinalBit называет минусом «не индустриальный формат файла», хотя экспорт FDX заявлен.
- ИИ «не пишет сценарий целиком» по справке, а с v3.16.0 собирает черновик до ~36 сцен.
- Совместная работа: «без апгрейда» в справке и 1 общий проект на бесплатном тарифе в таблице.
- Языки: справка называет испанский, французский, русский и португальский; релиз v2.10.0 упоминает экспорт с арабским. Язык интерфейса не проверен.
- Модель GPT-5.6 Terra видна только на скриншотах владельца, в релизах не упомянута.
- Не проверено: двойной диалог, CONT'D, автодополнение, цветные ревизии, экспорт Fountain и DOCX, офлайн, мобильные приложения, своё сохранение промптов, BYOK. Страница релиза v3.17.0 не отобразилась, текст взят из RSS. Отзывы G2 не открылись (403). «Scene cards» из обзора Screenweaver официальными источниками не подтверждены.
- Дата переименования: в одном каталоге апрель 2025, по релизам имя FinalBit появилось около v3.6 (апрель 2025); часть старых заметок задним числом подписана FinalBit.
