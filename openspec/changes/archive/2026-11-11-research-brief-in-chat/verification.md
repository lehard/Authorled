# Verification: research-brief-in-chat

## Deterministic
- `./scripts/dev.sh test`: 958 passed — no `research` column (0017 on a 0016 base keeps the note), `research` in POST/PATCH is an unknown field (422), the co-author has six changing tools again, the actions set loads.

## Browser (local, worktree API :8000 + Vite :5173, user writer, ai_dev_research_brief_in_chat; no evals by owner's decision)
- «Последний паром», «паромщики на Волге в 90-е»: the co-author asked for purpose, place and year; after the answer (scenes of the last day, today, Astrakhan region) the answer held a `research-brief` block, no «Разрешить», no note.
- Block: header «Задание для Deep Research» + «Скопировать» (copies the whole brief, 4 261 chars, from `# тема`), 160 px visible, «Развернуть целиком» → 448 px with scroll, «Свернуть»; Claude/ChatGPT links without parameters, `_blank`; the Markdown styles of the answer no longer underline the link buttons or paint the inner `pre`.
- «Сохранить в заметки» created «Исследование: Закрытие речной переправы на Нижней Волге: …» with the brief as text; the button became «Сохранено в заметки» with a link to it; API notes have no `research`.
- Mode «Сам», character Пётр; the window widened from the sheet to the column: «Создан документ: персонаж «Пётр»» stays (results live in the provider).
- Mode «Спрашивать», declined note: «Отклонено: …» with the Ban icon, no `×`.
- Reload and open from history: the block, «Сохранить в заметки» and the action lines are back.

## Limits
- «Разрешено: …» with the check icon shows only when the chat did not get a result; not reproduced in the browser, the code path is the same `Line`.
- The minimal text size of the design system is 13 px (`text-caption`); the monospace text of the block uses it.

## Hosted v0.3.20

- Release v0.3.20 from main (lehard/coauthor#81 … lehard/coauthor#85), deploy run 43112226835 succeeded: validate, frontend and site build, `/os/health`, site and admin checks.
- Server: `app` at tag `v0.3.20`, `web/current` → `/srv/authorled/web/v0.3.20`, `https://app.soavtor.app/os/health` 200; all containers up, `agentos-api` restarted with the release, no errors in its log for 15 minutes after it.
- Database: `authorled.alembic_version` = `0017_drop_note_research`; `authorled.notes` has no `research` column (0016 added it, 0017 dropped it).
- Code and bundle: `ResearchBlock.tsx` handles `research-brief`; `create_research_brief` is gone from `coauthor_tools.py`; bundle `ProjectScreen-Df0xXIoW.js` contains «Показать целиком».
- Not checked in a browser on the server: it needs the author's sign-in, and a co-author run there spends the limit of a real account.
