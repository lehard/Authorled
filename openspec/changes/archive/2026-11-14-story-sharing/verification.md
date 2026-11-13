# Verification: story-sharing

## Local (2026-11-14, worktree `claude/story-sharing-intent`)

- Static: `./scripts/validate.sh`, `git diff --check`, `npm run check:editor`, `npm run check:chat`,
  `openspec validate story-sharing --strict` — passed.
- Deterministic: `./scripts/dev.sh test` on PostgreSQL of the stand — 1077 passed, among them the matrix of every
  story route against every role and the completeness of that table from OpenAPI, the migration test of 0019.
- Browser (local stand, 1440 and 375 px): invitation of a reviewer, reviewer's comment and suggestion shown in place
  without saving, owner accepts, reader without chat, `/read/<key>` with the screenplay only; two sessions at once —
  «Сейчас правит …» on both sides, a save on an old revision shows «Сценарист сохранил(а) свою версию» and keeps the
  refused text as a snapshot `conflict`.
- Model: one call, «Как пригласить редактора?» — the answer follows the help of the prompt.

## Server (2026-11-14, release v0.3.26)

- The deploy workflow of v0.3.26 passed (validate, build, `deploy/deploy.sh`, health, site and admin checks).
- `GET https://app.soavtor.app/os/health` — 200.
- `POST /os/api/v1/read-links/open` without a token and with an unknown key — 404 «Ссылка не работает.»: the route is
  public and reads `authorled.draft_read_links`, so migration `0019_story_sharing` is applied.
- `GET /os/api/v1/projects/{id}/members` without a token — 401.
- Not checked on the server: sharing between two real accounts (the beta has no second tester yet).
