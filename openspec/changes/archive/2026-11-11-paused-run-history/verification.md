# Verification: paused-run-history

## Static
- `npm run typecheck`, `eslint src/screens/project/chat` — clean.

## Browser (local, worktree API on :8000 and Vite on :5173, user writer, database ai_dev_paused_run_history)
- Mode «Спрашивать», «Создай заметку «Кастинг»…», reload without answering the card, open from history: only the author's question; no answer, no Agno line, no card, no line, no «Скопировать», «Полезно», «Не то».
- New conversation, «Разрешить», reload, open from history: «Создана заметка «Финал»» and the answer «Заметка «Финал» создана с этим текстом.» with «Скопировать», «Полезно», «Не то».
- `./scripts/validate.sh`, `git diff --check` — pass.

## Hosted v0.3.19

- Release v0.3.19 from main (lehard/coauthor#79, lehard/coauthor#80), deploy run 43019867658 succeeded: validate, frontend and site build, `/os/health`, site and admin checks.
- Server: `app` at tag `v0.3.19`, `web/current` → `/srv/authorled/web/v0.3.19`, `https://app.soavtor.app/os/health` 200; all containers up, `agentos-api` restarted with the release, no errors in its log for 15 minutes after it.
- Code: `agno/agents/coauthor_tools.py` has `create_research_brief`; `web/src/screens/project/chat/api.ts` checks `PAUSED`. Bundle `ProjectScreen-BAidgd4y.js` contains «Исследовать тему» and `PAUSED`.
- Not checked in a browser on the server: it needs the author's sign-in, and a co-author run there spends the limit of a real account.
