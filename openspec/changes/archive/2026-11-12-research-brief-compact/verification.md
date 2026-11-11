# Verification: research-brief-compact

## Deterministic
- `./scripts/dev.sh test`: 958 passed (prompt loads).

## Browser (local, worktree API :8000 + Vite :5173, user writer, ai_dev_research_brief_compact; no evals by owner's decision)
- Request with purpose, place and time named: one phrase «Готово — задание для Deep Research:», then the card, nothing after it.
- Card: topic in the header (truncated), icons «Скопировать» and «В заметки» with labels; preview 72 px, «Развернуть» → 448 px; «Скопировать» gives the whole brief (5 355 chars); «В заметки» created the note and turned into a link to it.
- One line «Вставьте промпт в Claude или ChatGPT и используйте Deep Research»; «Claude» → `https://claude.ai/new`, «ChatGPT» → `https://chatgpt.com/`, `_blank`; no other buttons or hints.
- Under the answer with the brief: no «Скопировать»; «Полезно» and «Не то» appear once the run is linked to the answer, a moment after the answer ends (as before; the answer's own «Скопировать» used to hide the gap).
- Two answers, wide window: the row shows under the last answer only; hover on the first shows it; «Полезно» chosen on the first stays visible without hover, the others hide.
- 375 px: a tap on an older answer shows its row; no horizontal scroll.

## Limits
- In a hidden browser pane the opacity transition waits for the next frame; seen in the check, not in a visible window.
