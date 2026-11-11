# Verification: research-brief-document

## Deterministic
- `./scripts/dev.sh test`: core, routes, tool, migration tests incl. `research` (object or NULL, author routes refuse it with 422, rename keeps it, tool stores screenplay and note_ids, 0016 leaves old notes NULL).

## Browser (local, worktree API :8000 + Vite :5173, user writer, ai_dev_research_brief_document; no evals by owner's decision)
- «Последний паром», «Хочу изучить паромщиков на Волге в 90-е»: first two prompt versions created the brief at once (the model even wrote «время уточню»); after the rule «first answer is always a question, unless purpose, place and time are all named» the co-author asked for purpose, place and time.
- Answer «сцены последнего дня, наши дни, Астраханская область»: brief by the frame (main question, scenes, 4 prioritized questions, where to search, not needed, how to research, report format); after «Разрешить» the note opened in the centre, in the chat one line «Создано задание на исследование «…»», answer without «карточка».
- Head over the text: copy gives the field text with an unsaved edit; Claude/ChatGPT links without parameters; rename keeps the head (research kept in API); attachments (set directly in the local DB for the check): «Открыть сценарий» + export path, «Переправа.txt» «Скачать» gives the same bytes, a trashed one shows «Вложения нет»; a plain note has no head.
- «Русь XV века, обычаи»: clarification first; after «важно всё» the first prompt version made one (strong) brief; after the concrete rule (more than three sides = wide) the co-author proposed two briefs and created both on «да».
- Wider window: the note and its head stay; chat lines after a layout change are the subject of `chat-outcomes-keep`.

## Limits
- The model follows the clarification and split rules by the prompt only; checked by eye on three requests, not measured.
- During the check a failed send typed the request into the local note «Финал» (test data of the worktree database).
