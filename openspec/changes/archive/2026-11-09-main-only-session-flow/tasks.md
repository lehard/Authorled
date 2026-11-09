# Tasks

## 1. Перенос изменения в worktree от main

- [x] 1.1 Создать worktree `.claude/worktrees/main-only-session-flow` от `origin/main` в ветке `claude/main-only-session-flow`, скопировать туда `openspec/changes/main-only-session-flow/` и `business-intents/main-only-session-flow.md`, удалить эти незакоммиченные копии из основной папки; проверить: `git status` в worktree показывает только эти файлы, в основной папке их нет, `openspec status --change main-only-session-flow` в worktree видит все артефакты.

## 2. Хук при старте сессии

- [x] 2.1 Написать `scripts/hook_session_start.sh` по design (решения 4 и 7): предупреждение в основной папке и при основной папке не на `main`, тишина в worktree, ошибка git — stderr и код 1; проверить вручную: запуск в основной папке печатает JSON с `systemMessage`, в worktree — пустой вывод и код 0, вне git — код 1 с причиной.
- [x] 2.2 Подключить хук `SessionStart` в `.claude/settings.json` через `$CLAUDE_PROJECT_DIR` с таймаутом 10 секунд, не трогая блок `permissions`; проверить: `python3 -m json.tool .claude/settings.json` проходит, новая сессия в worktree стартует без предупреждения.

## 3. Хук при остановке сессии

- [x] 3.1 Написать `scripts/hook_stop.sh` по design (решения 5, 6 и 7): изменения ветки против `merge-base` с `origin/main`, подсчёт задач как у OpenSpec, `stop_hook_active` — выход 0, законченное незаархивированное изменение — `{"decision": "block", "reason": …}`, ошибка git — stderr и код 1; проверить вручную в worktree по сценариям спеки: законченное изменение ветки → блок с именем; `stop_hook_active: true` → код 0 без вывода; неотмеченная задача → без вывода; чужое изменение в `openspec/changes/` → без вывода; без `origin/main` → код 1 с причиной.
- [x] 3.2 Подключить хук `Stop` в `.claude/settings.json` так же, как в 2.2; проверить: JSON валиден, обычный ход сессии заканчивается без напоминания, пока задачи этого изменения не отмечены.
- [x] 3.3 Записать ручные проверки хуков 2.1 и 3.1 (команды, вход, вывод, коды) в `tmp/VERIFY.md`, раздел «deterministic»; проверить: раздел есть и покрывает все сценарии двух требований о хуках.

## 4. Правила процесса в AGENTS.md

- [x] 4.1 Переписать «Parallel sessions» в `AGENTS.md`: одна длинная ветка `main`, основная папка только на `main` и только для чтения, каждая сессия — свой worktree от `origin/main` в ветке `claude/<change>`, слияние только через PR, существующие запреты (`git stash`, `reset --hard`, `add -A` и др.) сохранить; проверить: раздел не противоречит требованию «Одна длинная ветка main».
- [x] 4.2 Переписать пункт 3 «OpenSpec is mandatory»: propose, update и начало apply запускает владелец; после последней задачи сессия сама делает verify, archive, проверки, PR и слияние по design (решения 2 и 3), при CRITICAL, упавшей проверке или конфликте — остановка; проверка на сервере после релиза — отдельный PR; проверить: `grep -n "opsx:verify\|opsx:archive" AGENTS.md` не находит старого «the user runs … themselves», текст совпадает с требованиями «Изменение доводит одна сессия», «Verify и archive без команды владельца», «Слияние PR сессией».
- [x] 4.3 Упомянуть хуки в «Verification» или «Parallel sessions» `AGENTS.md` (что делают, где скрипты) и проверить README, `setup-platform` и `deploy-platform` на упоминания рабочих веток, кроме `main`; проверить: `grep -rn "feature/openspec" AGENTS.md README.md .agents/skills/setup-platform .agents/skills/deploy-platform` пуст.

## 5. Настройки уборки

- [x] 5.1 С подтверждением владельца в чате включить в приложении `auto_archive_on_pr_close`; проверить: настройка читается как включённая.
- [x] 5.2 С подтверждением владельца в чате включить на GitHub `delete_branch_on_merge` для `lehard/Authorled`; проверить: `gh api repos/lehard/Authorled --jq .delete_branch_on_merge` возвращает `true`.

## 6. Разовая уборка

- [x] 6.1 Подготовить для владельца список: 5 коммитов `feature/openspec`, которых нет в `origin/main`, и файлы без коммита основной папки и `coauthor-mentor-checks`, сгруппированные по изменениям OpenSpec и интентам, с предложением по каждой группе (PR в `main`, оставить сессии, выбросить); проверить: каждая группа из `git log origin/main..feature/openspec` и `git status --short` попала в список.
- [x] 6.2 По решению владельца разнести группы по PR в `main` или оставить, затем переключить основную папку на `main`, обновить её до `origin/main` и удалить `feature/openspec` локально и на GitHub; проверить: `git -C <основная папка> branch --show-current` — `main`, `git status --short` пуст, `git ls-remote --heads origin feature/openspec` пуст.
- [x] 6.3 По списку и с подтверждением владельца удалить старые worktree (`git worktree remove`, только чистые) и слитые в `origin/main` локальные ветки; проверить: `git worktree list` показывает только основную папку и worktree работающих сессий.

## Workflow follow-up

- Verify и archive этого изменения сессия делает сама, по новому правилу `AGENTS.md`; затем проверки, PR и слияние в `main`. Это первая проверка процесса на деле; хук остановки должен напомнить о незаархивированном изменении, если сессия пропустит шаг.
