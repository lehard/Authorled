# Verification: research-brief-polish

## Browser (local, worktree API :8000 + Vite :5173, user writer, ai_dev_research_brief_polish; screenshots, no evals)
- Card: header with the topic and icon buttons; hover on «Скопировать задание» shows the tooltip of the same text; copy turns the icon into a check «Скопировано» and back after 2 s; «Сохранить в заметки» (bookmark-plus) shows a spinning loader, then a bookmark-check link «Сохранено в заметки — открыть» to the new note.
- Preview fades out at the bottom; «Показать целиком» is an interface-font ghost button with a chevron, apart from the monospace text. Found during the pass: the model writes `##` headings inside the brief; the card now hides heading marks in what it shows, the copy keeps the original text (checked: copied text has `##`).
- Answer row: «Скопировать», «Полезно», «Не то» are the same ghost buttons; under an older answer with «Полезно» chosen only a small thumb icon stays; hover shows the whole row with the same pressed look as under the last answer.
- Dark and light themes at 375 px: card, line with links and row are even; no horizontal scroll.
- `./scripts/validate.sh` first failed on `check:native-ui` (a native `title` on the topic); the topic now has the same `Tooltip`; then `validate.sh` and `git diff --check` pass.
