# Verification: editor-empty-placeholder

## Static and deterministic

- `./scripts/validate.sh` (agno/.venv, `env -u BASH_ENV`): passed, including `npm run check:editor --prefix web`.
- `check:editor`, section 14: `emptyParagraphs` gives only the empty paragraphs (a text ending with "\n" is not empty), the plugin marks them `pw-empty`, the mark goes after typing; `styles.css` has no `br:only-child` and no `pw-empty-heading`.
- `git diff --check`: clean.

## Browser (Chrome pane, `VITE_DATA_SOURCE=fixtures`, «Последний паром»)

- Action «…переправа закрыта».» + Shift+Enter at the end: the paragraph has no `pw-empty`, `::after` is `none` (before the fix: «Что происходит» over the text).
- Empty paragraph after it, switched through all 14 types with their keys: each has `pw-empty` and its placeholder; the scene heading shows «ИНТ. МЕСТО — ВРЕМЯ» in `::before` and keeps its number «2» in `::after`.
- «жарим жарим» Shift+Enter «фвафафы» Shift+Enter: no placeholder, screenshot without overlap.

## Limits

- Safari not checked.
- Hosted: not deployed by this change.
