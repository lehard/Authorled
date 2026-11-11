# Verification: research-brief

## Static
- `./scripts/validate.sh` — passed after all changes; `git diff --check` clean.
- `npm run typecheck`, `eslint src/screens/project` — clean after the `parseArgs` fix.

## Deterministic
- `./scripts/dev.sh test` — 957 passed, 2 failed (`test_release_set_loads`: set bound 75 < 76 requests; new test assertion); both fixed, `tests/test_coauthor_actions.py` 30 passed.

- Final `./scripts/dev.sh test`: 959 passed.

## Model
- `python -m evals.coauthor actions-run --all` (deepseek-fast, ai_dev_research_brief): 99% passed (75/76), without core refusal 97% (74/76), fields 98% (39/40); report `tmp/coauthor-actions/20261111T103713Z.md`. Previous full run 2026-11-09 (68 requests): 91% (62/68).
- `create_research_brief` 4/4 passed in 1 attempt; `research-fact-question` (expect none) passed. The only failure: `character-vasily` (residence field), unrelated.
- Briefs read: 3 100–4 200 chars; each has purpose, short story context, questions, report format with sources, «не проверено», clichés; no scene headings.
- 19.00 ₽ for 76 requests.

## Browser (local, worktree API on :8000 and Vite on :5173, user writer)
- Empty conversation shows «Исследовать тему»; click puts the start of the request into the field with focus, nothing is sent.
- «Исследование» in the «⋮» menu of «Заметки» puts the start before the typed text (focus stays on the menu trigger); on the notes page at 375 px the sheet opens with the start in the field, focus in the field, no horizontal scroll.
- Mode «Спрашивать»: confirmation card «Создать задание на исследование «…»» with the start of the brief; «Разрешить» → note «Исследование: …» in the navigator and the research card.
- Mode «Сам»: card with «Приложите к запросу» → «Открыть сценарий» and the export path.
- Links: `https://claude.ai/new`, `https://chatgpt.com/`, `_blank`, `noopener noreferrer`, no text in the address.
- Found: after the continuation Agno 3.1.10 sends the paused call again (keys in another order) and the chat appends its arguments to the same call, so `parseArgs` read `{}` and «Скопировать задание» copied an empty string. Fixed in `actions.ts` (`once`: equal repeated objects count as one); after it the copy gives the whole brief (5 569 chars).
- Card after reload (task 3.4, design decision 10): `loadConversation` rebuilds changing calls from `tools` of each run. Checked after reload and opening from history: research card with working «Скопировать задание» (4 202 chars), «Создан документ: персонаж «Пётр»» with a link to the card, «Отклонено: Создать заметку «Финал»», the core refusal «Отказ: Правка драфта запрещена…» (a run keeps a plain-text refusal, AG-UI sends it as a JSON string; `asAgui` does the same), no confirmation card for a call nobody answered.

- Attachment of a note with an original: «Переправа.txt» + «Скачать» gives the same name and text.
- 375 px: the restored card fits (16–322 px), no horizontal scroll.

## Limits
- A run paused and never answered shows Agno's «I have tools to execute, but I need confirmation.» as its answer after reload; this was so before the change (history always showed run content).
- The «Исследование» item of the «⋮» menu of «Заметки» leaves focus on the menu trigger, not in the field.

## Hosted v0.3.19

- Release v0.3.19 from main (lehard/coauthor#79, lehard/coauthor#80), deploy run 43019867658 succeeded: validate, frontend and site build, `/os/health`, site and admin checks.
- Server: `app` at tag `v0.3.19`, `web/current` → `/srv/authorled/web/v0.3.19`, `https://app.soavtor.app/os/health` 200; all containers up, `agentos-api` restarted with the release, no errors in its log for 15 minutes after it.
- Code: `agno/agents/coauthor_tools.py` has `create_research_brief`; `web/src/screens/project/chat/api.ts` checks `PAUSED`. Bundle `ProjectScreen-BAidgd4y.js` contains «Исследовать тему» and `PAUSED`.
- Not checked in a browser on the server: it needs the author's sign-in, and a co-author run there spends the limit of a real account.
