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
