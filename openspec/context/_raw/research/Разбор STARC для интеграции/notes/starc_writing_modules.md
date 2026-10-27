# STARC (Story Architect): writing and story-development modules, screen by screen

Research date: 2026-10-27. Latest STARC release: **v0.8.4, published 2026-10-27** ([GitHub API release list](https://github.com/story-apps/starc/releases)). Release dates below come from the GitHub API (`gh api repos/story-apps/starc/releases`).

Screenshot paths are relative to `https://starc.app` (for example `https://starc.app/media/help/en/navigation-1.png`). Russian versions are under `/media/help/ru/...` and `/ru/help/...`.

Source-code findings come from a sparse clone of `story-apps/starc` (master, cloned 2026-10-27). File paths are relative to the repo root.

---

## 1. Module inventory: which document types exist and which screens/modes each has

### Takeaway
A STARC project is a tree of typed documents in a left-hand **navigator**. Each document type has one or more **views** (editors), switched by icons at the top-left of the workspace. The screenplay is a container with sub-documents: title page, synopsis, treatment (поэпизодник), script text, statistics. Script text has 4 views (text, cards, timeline, breakdown) and treatment has 2 (text, cards). All views edit one shared model, so changes sync instantly.

### Cited Findings

**Global layout and navigation**
- The navigator is on the left and the workspace on the right. There are 3 levels: the project level (general info, locations, characters, series, other elements), the document level (expand a story to see its sub-documents), and the scene level (expand Screenplay to see scenes). Drag-and-drop reorders items. Dragging scenes moves the text immediately, and dragging a document to the recycle bin deletes it — [Help: Navigation](https://starc.app/help/navigation/). Screenshots: `/media/help/en/navigation-1.png` … `navigation-9.png`.
- For the screenplay text, the top-left icons switch between four views: **Text, Cards, Timeline, Script breakdown**. "Changes made in one view sync across all four" — [Help: Navigation](https://starc.app/help/navigation/).
- Start screen: a burger menu (top-left) with Sign in, a "+ Create story" button in the left panel and in the centre, and storage settings (save path, import). The create dialog offers 5 story types: **Screenplay, Comic book, Audio drama, Stageplay, Novel**. After creation, the left panel shows the title, description, poster generator and the modules (title page, synopsis, treatment, script text), which vary by story type. "+ Add Document" sits at the bottom-left — [Help: Start writing](https://starc.app/help/start-writing/). Screenshots: `/media/help/en/start-writing-1.png` … `-7.png`.
- In the source, the "Add document" dialog offers: Add screenplay, novel, stageplay, audioplay, comic book, character, location, world, text, folder, mind map, image gallery and presentation. It groups items as "Story", "World of story" and "Structure & notes". It also has an "Insert into" target, "Episodes amount" / "Split to episodes" for screenplays, and an import-from-file option. Some types show "Document can be created only with a PRO or CREATOR version of the app." — `src/core/ui/project/create_document_dialog.cpp` in [story-apps/starc](https://github.com/story-apps/starc).

**Document object types** (`src/corelib/domain/document_object.h`, [repo](https://github.com/story-apps/starc)):
- Screenplay: TitlePage, Synopsis, Treatment, Text, Dictionaries, Statistics.
- ScreenplaySeries (introduced in v0.8.0): Episodes, TitlePage, Synopsis, Treatment, Text, Statistics.
- ComicBook, Audioplay and Stageplay: TitlePage, Synopsis, Text, Dictionaries, Statistics. They have no treatment.
- Novel: TitlePage, Synopsis, **Outline**, Text, Dictionaries, Statistics.
- GameScript: an enum value with no UI yet.
- Characters/Character, Locations/Location, Worlds/World, Plots/Plot.
- Folder, SimpleText, MindMap, Image, ImagesGallery, Presentation, Link, RecycleBin.

**Views (editors) per document, from `src/core/management_layer/plugins_builder.cpp`**

| Document | Views (switch icons) |
|---|---|
| Project | Information, Parameters, Collaborators |
| Screenplay (root) | Information (logline, poster, etc.), Parameters (template override etc.) |
| Screenplay / Title page | Title page editor |
| Screenplay / Synopsis | Simple text editor |
| Screenplay / Treatment (поэпизодник) | Treatment text, Treatment cards (a "beatboard" view is commented out in code) |
| Screenplay / Text | Text, Cards, Timeline, Breakdown |
| Screenplay / Statistics | Statistics view + statistics navigator (reports list) |
| Screenplay series / Episodes | Episodes **plan** editor |
| Screenplay series / Treatment, Text, Statistics | Same as screenplay, aggregated across episodes |
| Novel / Outline (план) | Outline text, Outline cards (beatboard commented out) |
| Novel / Text | Text, Cards, Timeline |
| Comic book / Audioplay / Stageplay | Information, Parameters, Title page, Synopsis, Text, Statistics (one view each) |
| Characters (group) | **Relations map** |
| Character | Character profile editor, **Character dialogues** |
| Locations (group) | **Locations map** |
| Location | Location profile, **Location scenes** |
| Worlds (group) | **Worlds map** |
| World | World profile |
| Folder | Folder text editor (folder acts as a text document) |
| Text | Simple text editor |
| Mind map / Image gallery / Presentation | Dedicated views |
| Recycle bin | Recycle bin view |

— [plugins_builder.cpp](https://github.com/story-apps/starc/blob/master/src/core/management_layer/plugins_builder.cpp)

- **Open vs closed source:** 25 plugins are private git submodules (`git@github.com:story-apps/...`). They are character_information, location_information, characters_relations, locations_map, worlds_map, world_information, screenplay_cards, screenplay_timeline, screenplay_breakdown(+structure), screenplay_series_plan, screenplay_series_statistics, novel_cards, novel_timeline, mind_map, images_gallery, presentation, character_dialogues, location_scenes, project_collaborators, and all *_statistics plugins. Open plugins include screenplay_text, screenplay_treatment, novel_text/outline, stageplay/audioplay/comic text, title_page and simple_text — [.gitmodules](https://github.com/story-apps/starc/blob/master/.gitmodules).

**Plan gating (pricing page, current)** — [Pricing](https://starc.app/pricing/)
- **FREE ($0):** unlimited projects and documents, cover generator, folders, text documents, session statistics. Characters, locations and worlds get basic info + export. Screenplay: logline & synopsis, title page, **treatment and script text**, basic statistics, import/export, scene number locking. Comic, audio and stage: logline/synopsis, title page, text, import/export. Novel: logline/synopsis, title page, outline & text, basic statistics.
- **PRO ($4.17/mo annual or $150 lifetime):** mind maps, image gallery, presentations, character **relations editor** and extended info, location/world **maps** and extended info, **dialogues and scenes from all stories**. Screenplay: **corkboard (cards), timeline, extended statistics**. Novel: corkboard and timeline. Audio drama: extended statistics. Planned for 2026: image editor, web links, **screenplay and novel beats editors**, comics page/panel visual editor.
- **CREATOR ($8.34/mo annual; formerly CLOUD, renamed in v0.8.1, March 2026):** sync, real-time collaboration, 5 GB cloud. Screenplay: **script breakdown, showrunner tools, series plan**, statistics across all episodes. Planned: season-wide beats/cards/timeline, page-number locking, storyboard.
- AI Assistant is credit-based and available on PRO and CREATOR — [Pricing](https://starc.app/pricing/). Details are in sibling note `starc_ai_assistant.md`.
- Educational: 50% off — [Pricing](https://starc.app/pricing/).

### Inferences
- The "screenplay as a folder of sub-documents (title page / synopsis / treatment / text / statistics)" structure maps well onto Authorled's methodology documents. Synopsis is literally a simple text document. Authorled's 22 docs could be modelled as STARC Text/Folder documents next to a Screenplay.
- Stageplay, audio play and comic have **no treatment and no cards/timeline**. Only Screenplay and Novel have the outline↔text pipeline.

### Gaps
- Exact panel contents of the closed-source PRO views (cards, timeline, maps, breakdown, series plan) cannot be read from source. They are known only from help pages and release notes.
- The "Plots" document type (`Plots = 20000`) exists in the enum, but I found no UI or help for it.

---

## 2. Screenplay text editor: elements, Tab/Enter, autocomplete, numbering, side panels

### Takeaway
The editor is a paginated, template-driven script editor. It has 13 screenplay paragraph types, Ctrl+digit hotkeys, a configurable Tab/Enter "jump/change" matrix, character/location autocomplete with dictionaries, and toggleable right-hand panels: scene parameters, bookmarks, comments/review, dictionaries, compliance checklist and AI.

### Cited Findings

**Paragraph types** (`TextParagraphType` enum, `src/corelib/business_layer/templates/text_template.h`, [repo](https://github.com/story-apps/starc))
- Common: UnformattedText, InlineNote.
- Grouping: ActHeading/ActFooter, SequenceHeading/SequenceFooter, PartHeading/Footer, ChapterHeading/Footer, PageSplitter.
- Script: SceneHeading, Character, Dialogue, SceneCharacters, **BeatHeading**, Action, Parenthetical, Lyrics, Transition, Shot.
- Audio: Sound, Music, Cue. Comic: PageHeading, PanelHeading, Description. Novel and plain text: ChapterHeading1–6, Text.
- Group levels (`TextGroupType`): Scene, Beat, Page, Panel, Chapter1–6. Folder levels (`TextFolderType`): Act, Sequence, Part, Chapter.
- Each block can carry review-mark properties (comments, authors, dates, isRevision/isAddition/isRemoval), resource marks for breakdown, and page-break correction marks ("(MORE)/(CONT'D)") — same file.
- Russian names used in help: Заголовок сцены, Описание действия, Персонаж, Ремарка, Реплика. Additional ones: Участники сцены, Кадр, Переход, Лирика, Заметка по тексту, Простой текст, Группа, Акт — [RU help: Формат сценария](https://starc.app/ru/help/screenplay-format/). Screenshot: `/media/help/ru/screenplay-format.png`.

**Default hotkeys** (`src/corelib/data_layer/storage/settings_storage.cpp`)

| Ctrl+0 Unformatted | Ctrl+1 Scene heading | Ctrl+Shift+1 Beat heading | Ctrl+2 Scene characters | Ctrl+3 Action | Ctrl+4 Character |
|---|---|---|---|---|---|
| Ctrl+5 Parenthetical | Ctrl+6 Dialogue | Ctrl+7 Lyrics | Ctrl+8 Shot | Ctrl+9 Transition | Ctrl+Shift+0 Inline note |

Ctrl+Space inserts a Sequence heading and Ctrl+Shift+Space an Act heading. Ctrl/Cmd+D runs "Split paragraph" (dual dialogue) — [Help: Double dialogue](https://starc.app/help/double-dialogue/), screenshots `/media/help/en/double-dialogue-1.png` … `-4.png`.

**Tab/Enter logic (defaults).** "Jump" applies when the cursor is at the end of a non-empty block. "Change" applies when the block is empty and changes its type. Source: `settings_storage.cpp`, user-editable in Settings → Components → Screenplay → shortcuts table (`settings_view.cpp`, columns JumpByTab / JumpByEnter / ChangeByTab / ChangeByEnter).

| From | Tab → (jump) | Enter → (jump) | Tab on empty (change) | Enter on empty (change) |
|---|---|---|---|---|
| Scene heading | Scene characters | Action | Action | Scene heading |
| Scene characters | Action | Action | Action | Action |
| Beat heading | Action | Action | Action | Action |
| Action | Character | Action | Character | Scene heading |
| Character | Parenthetical | Dialogue | Action | Action |
| Parenthetical | Dialogue | Dialogue | Dialogue | Parenthetical |
| Dialogue | Parenthetical | Action | Parenthetical | Action |
| Lyrics | Parenthetical | Action | Parenthetical | Action |
| Transition | Scene heading | Scene heading | Action | Transition |
| Shot | Action | Action | Action | Shot |
| Inline note | Action | Action | Inline note | Inline note |
| Sequence heading | Scene heading | Scene heading | Scene heading | Act heading |
| Act heading | Sequence heading | Scene heading | Sequence heading | Act heading |

The treatment, stage play and audio play editors have their own matrices in the same file (for audio play, Scene heading → Tab → Cue).

**Editor defaults and options** (`settings_storage.cpp`):
- Scene numbers hidden by default (left/right placement options).
- "Continue dialogue" (CONT'D) off; correct text on page breaks on.
- "Save items from text" on: characters and locations typed in text are auto-added to the project.
- Hints (autocomplete) for all items on.
- Character suggestions in an empty block on.
- Typing "(" in dialogue converts it to a parenthetical.
- Navigator: show beats in treatment on, show beats in screenplay off, show scene number on, show scene text on.
- Help confirms that after Action + Tab you type the character name, and that names appear as a suggestion list — [RU help: Формат сценария](https://starc.app/ru/help/screenplay-format/).

**Toolbar and panel actions** (UI strings in `src/core/management_layer/plugins/screenplay_text/` and `src/corelib/ui/modules/`):
- Undo/Redo, **Current paragraph format** (type dropdown), show/hide **fast format panel**, Search text, Show/hide beats headings, **Show only current scene text** / Show full text (scene isolation), Enable/Disable review mode, Enable/Disable AI assistant.
- Show/hide **scene parameters**: alternate title, colour, tags, story day — see section 3.
- Show/hide **bookmarks list**: bookmark name, text, colour.
- Show/hide **screenplay dictionaries**: dictionary types "Scene intro", "Scene time", "Character extension", "Transition", with Add/Remove. These are the autocomplete lists such as INT./EXT., DAY/NIGHT, V.O./O.S. and CUT TO:.
- Show/hide **compliance check results** ("Checklist").
- Context menu: Split paragraph, Merge paragraph, "End of act", "End of folder".
- Search scope: In the whole text, scene heading, action, character, dialogue, cast list.
- Scene search by number with `#` was added in v0.7.5 — [Releases](https://github.com/story-apps/starc/releases).

**Scene isolation mode:** a top-panel icon (corner marks with a centre circle) keeps only the cursor's scene visible. Switch scenes via the navigator. Works in any project type — [Help: Scene isolation](https://starc.app/help/scene-isolation-mode/). Screenshots: `/media/help/en/scene-isolation-mode-1.png` … `-3.png`.

**Templates (formatting standards):** Application Settings → Components. Script templates: International A4, American Letter ("one page ≈ one minute"), **Russian**, Arabic, Hebrew, Tamil, Telugu (8 total, one unnamed on the page). Text: 4 variants. Comics: 4. Audio drama: BBC A4 Arial. Stage play: American. Novel: 2 page formats × 4 fonts — [Help: Document templates](https://starc.app/help/document-templates/). Screenshots: `/media/help/en/templates-1.png` … `-7.png`.
- Custom template: "create new template based on current". Per-element font, size, case, spacing and indents. Page format, margins, page-number position, columns, title-page layout. Per-screenplay override via the gear icon on the screenplay tab → "Override common settings for this screenplay" — [Help: Custom templates](https://starc.app/help/custom-templates/). Screenshots: `/media/help/en/custom-template-1.png` … `-7.png`. The default template key in code is `world_cp` (`settings_storage.cpp`).
- Experimental "use pages as duration" (eighths of a page) was added in v0.8.3 (2026-09-22). Timing is otherwise per-template (chronometer) — [Releases](https://github.com/story-apps/starc/releases).

**Double dialogue:** set the line to Character, right-click → Split Paragraph (Ctrl+D), fill both halves. Undo with Merge Paragraph — [Help: Double dialogue](https://starc.app/help/double-dialogue/).

### Inferences
- The Tab/Enter matrix is a clean, data-driven spec that Authorled can replicate for its "final text" editor. It is the same model KIT Scenarist used.
- "Save items from text" means characters and locations are a by-product of writing. Authorled's casting list could be synced from STARC character documents, or the other way round.

### Gaps
- The help has no dedicated article on the screenplay editor itself (elements, timing settings, scene-number locking UI). Defaults come from source code, not docs.
- I found no docs on the exact differences between the Russian and US templates (margins, ИНТ./НАТ. vs INT./EXT.). The RU format guide only mentions ИНТ./НАТ. and ДЕНЬ/НОЧЬ abbreviations — [RU help](https://starc.app/ru/help/screenplay-format/).
- I could not reach the content of the compliance "Checklist" panel (rules list).

---

## 3. Outline ↔ text linkage: treatment, beats, cards, timeline, acts/sequences, colours/tags

### Takeaway
Treatment (поэпизодник) and script text are **two views of the same document model**. The treatment shows scene headings and beats, while the script shows headings, beats (hidden by default) and full text. Moving a beat moves the text written inside it. Cards and timeline are further views over the same scene/beat/act/sequence tree. Per-scene metadata (alternate title, colour, tags, story day) lives in the scene-parameters panel.

### Cited Findings
- Beats are "important plot points expressed through action". You work with them in the **Treatment** or directly in the Screenplay. In Treatment, add a scene title, press Enter, and type beats. Three-dots menu → "Show scene parameters" opens a right panel with **alternate scene title, colour, tags, story day**. In Screenplay, a toggle icon (a rectangle with two bars) shows or hides beats inside the script. Beats contain scene text, so "moving a beat moves the scene text written inside it", and changes appear in the Screenplay section — [Help: Beat sheet / Как составить поэпизодник](https://starc.app/help/beat-sheet/). Screenshots: `/media/help/en/treatment-1.png` … `treatment-10.png`.
- Code structure: the treatment uses shadow paragraph types (`SceneHeadingShadowTreatment`, `BeatHeadingShadowTreatment`, `ActHeadingShadowTreatment`, `SequenceHeadingShadowTreatment`). This confirms the treatment is a projection of the same text model, not a separate document — `text_template.h`.
- Acts and sequences are folder-level paragraph types (ActHeading/ActFooter, SequenceHeading/SequenceFooter) with hotkeys Ctrl+Shift+Space / Ctrl+Space and the context action "End of act" / "End of folder" — `text_template.h`, `settings_storage.cpp`, screenplay_text UI strings.
- **Cards:** both Treatment and Text have a Cards view, which is a PRO "corkboard". **Timeline:** a view of Text (PRO). Since **v0.8.4 (2026-10-27)** the timeline is built into script cards. It shows the card's position, colours and bookmarks, with two-way selection between card and timeline scene — [Releases](https://github.com/story-apps/starc/releases); [Pricing](https://starc.app/pricing/).
- v0.7.8 (2025-07-15) improved copy/paste between the beat sheet and the script. v0.7.7 (2025-03-10) fixed copying beats in the screenplay outline and novel plan — [Releases](https://github.com/story-apps/starc/releases).
- Novel: Outline (план) ↔ Text, with cards for both and a timeline for the text. Planned for 2026: dedicated "screenplay and novel beats editors" (the beatboard views are commented out in `plugins_builder.cpp`) — [Pricing](https://starc.app/pricing/).
- Series (v0.8.0, 2025-12-09): a series module creates multi-episode documents. "A folder of episodes works as an episode-by-episode outline", with series-wide statistics and scene/episode numbering — [Releases](https://github.com/story-apps/starc/releases). The simpler documented pattern is one screenplay document per episode, folders for seasons (Shift-click multi-select, drag into folder), and spin-offs as other story types in the same project — [Help: Series project](https://starc.app/help/create-a-series-project/). Screenshots: `/media/help/en/series-1.png` … `-7.png`.

### Inferences
- Treatment → script is "progressive disclosure" of one tree: Act > Sequence > Scene > Beat > text. This matches Authorled's skeleton map → episode outline → scene beat maps → drafts chain closely. An integration could write Authorled's scene beat maps as STARC BeatHeading paragraphs inside SceneHeading groups.

### Gaps
- No help page describes the Cards view UI: card fields, grouping by acts, or colour usage. Details are known only from pricing and release notes. The Cards/Timeline plugins are closed source.
- The "showrunner tools" and "series plan" screens are not documented in help.

---

## 4. Drafts/versions, revisions, comparison, comments, review mode

### Takeaway
STARC has per-document **drafts**: a first draft plus any number of named drafts, each lockable, creatable from an external file, exportable and comparable. The review panel has three modes: **Review** (colour/highlight/comment marks), **Track changes** (additions in colour, removals in red, apply/cancel), and **Revision** (stars in the margin per edited line). Comments have replies, done/undone states and a right-side list.

### Cited Findings
- **Review mode:** click the marker icon at the top of the text. Select text and choose a tool: text colour (letter icon), highlight (fill icon), or comment (dialog icon), with a colour circle. A right-hand panel lists all marks, and clicking one jumps to the text. Right-clicking a note offers reply, resolve or delete. You can only edit notes you wrote. Co-authors with editor/commentator roles can add marks. **Co-authoring requires CREATOR**, and co-authors can be on FREE, PRO or CREATOR — [Help: Review mode](https://starc.app/help/review-mode/). Screenshots: `/media/help/en/review-mode-1.png` … `-6.png`.
- UI strings in `src/corelib/ui/modules/comments`: "Choose review mode": **Review mode / Track changes mode / Revision mode**. Also Add comment, Add reply, Discuss, Mark as done/undone, Mark added, Mark removed, Mark revisited, Apply change(s), Cancel change(s), Change text colour, Change highlight colour, and "Mark selected notes as done/undone".
- Release history: v0.7.5 (2024-10-15) added Review, Additions Tracking and Revisions modes ("star marks in the margin for each edited line") plus automatic highlighting of new draft text. v0.7.8 (2025-07-15) added Track Changes (additions in a chosen colour, deletions in red, apply/revert from the right panel) and export of a specific draft — [Releases](https://github.com/story-apps/starc/releases).
- **Drafts:** v0.7.4 (2024-09-17) added export of a specific draft. v0.7.7 made the draft list always visible. v0.8.0 (2025-12-09) added **Compare two documents or two drafts** and creating a draft by importing an external file. v0.8.1 (2026-03-03) redesigned drafts as "first draft and all the others" with no "current" draft, so you create a named draft when a stage is complete — [Releases](https://github.com/story-apps/starc/releases); [Blog 2026-03-03](https://starc.app/blog/2026-03-03).
- Create-draft dialog (`src/core/ui/project/create_draft_dialog.cpp`): "Create document draft" / "Edit document draft", **Draft name**, **Based on** (which draft), **Lock draft text editing**, **Draft from external file**, and the hint "Store actual draft as a separate document to keep your progress." Navigator context menu (`project_manager.cpp`): "Create draft", "Compare drafts", and "Compare documents" when two documents of the same type are selected. Drafts apply to text items: screenplay text, treatment, novel, plays and texts.
- A document version-control tool was first worked on in v0.2.2 (2022) — [Blog 2022-07-13](https://starc.app/blog/2022-07-13).

### Inferences
- The draft model ("first draft → named drafts, lock old ones, compare any two") is a ready pattern for Authorled's scene drafts → final text stage.
- Revision mode with margin stars mirrors industry production revisions. I saw no evidence of coloured revision pages (blue/pink pages); see Gaps.

### Gaps
- No help article on drafts or comparison UI. Behaviour is reconstructed from release notes and source strings.
- I found no source for coloured production revision sets (WGA colour sequence) or "locked pages". Page-number locking is "planned for 2026" on CREATOR — [Pricing](https://starc.app/pricing/).
- Plan gating for drafts and compare is not stated on the pricing page. The features appear in the open-source core, so they are likely FREE, but this is unconfirmed.

---

## 5. Characters, locations, worlds, research/notes/mind maps, images, folders

### Takeaway
Characters, locations and worlds each have a group view (relations map / locations map / worlds map, all PRO) and a per-item profile with an extended profile in PRO. Characters additionally have a **Dialogues** view and locations a **Scenes** view (PRO, "dialogues and scenes from all stories"). Research material is plain Text documents, Folders that are themselves text, Mind maps (PRO), Image galleries (PRO) and Presentations (PRO).

### Cited Findings
- **Relations map:** characters appear on a canvas. Alt+drag draws a relation. A side panel "Relations" section sets the main emotion. Clicking the arrow at a line's end opens both characters' viewpoints plus line type and colour. **Group frames** have a name, description, colour, line type and are resizable. Top bar: add character, focus on one character, create group frame, save map as image. A dice icon is the name generator. A basic profile (description + photo) sits in the side panel, and the extended profile opens via the name in the left panel — [Help: Characters relations](https://starc.app/help/characters-relations/). Screenshots: `/media/help/en/characters-relations-1.png` … `-10.png`.
- v0.8.3 (2026-09-22): the relations map can auto-arrange characters in circles by role and relationship. Mind maps gained multi-select/move and connections between cards and groups. Project settings now apply project-wide — [Releases](https://github.com/story-apps/starc/releases).
- v0.7.3 (2024-07-02): alphabetical sorting of characters/locations, multiline profile fields, and scene/word/character counters in the navigator for comics/plays/audio/text — [Releases](https://github.com/story-apps/starc/releases).
- Other character help: [Character photo](https://starc.app/help/character-photo/), [Character profile export](https://starc.app/help/character-profile-export/), [Name generator](https://starc.app/help/character-name-generator/). Not fetched in detail.
- Per-character views in code: Character editor + **Character dialogues**. Per-location: Location editor + **Location scenes**. Groups: Characters → relations map, Locations → locations map, Worlds → worlds map — `plugins_builder.cpp`.
- STARC vs KIT: STARC adds extended character profiles "for detailed backstories", location and world maps, session statistics, a poster builder, a writer timer, script breakdown and AI. KIT had cards, mind maps, image gallery, cloud and co-writing but one script per project — [Help: KIT Scenarist comparison](https://starc.app/help/kitscenarist/).
- AI can fill a character profile: in the profile, choose "Generate" in the right panel, describe the character and tick the sections to fill. AI can also rephrase/expand/generate mind-map ideas — [Help: AI assistant](https://starc.app/help/ai-assistant/). Screenshots: `/media/help/en/ai-assistant-7.png`, `-8.png`.

### Inferences
- The relations map (emotion per direction, line type/colour, group frames) is directly relevant to Authorled's psychological profiles and casting list. Character dialogues view (all lines of one character) is relevant to the "dialogue score" document.

### Gaps
- I could not see the extended character profile field list: the help does not list it, and `character_information` is a closed submodule. Same for location and world profile fields. Update 2026-10-27 (clone at commit c5bf39ff): the field lists are in the public `corelib` models (`character_model.h`, `location_model.h`, `world_model.h`); only the screens are closed. Also, Novel Outline is an alias of the Novel Text model (`project_models_facade.cpp`), not a separate model.
- The Mind map, Images gallery and Presentation screens are not documented in help beyond the pricing mention.

---

## 6. Statistics and reports

### Takeaway
Screenplay statistics combine a summary with several reports and plots, all exportable to PDF/Excel. Extended statistics are PRO; series-wide statistics are CREATOR. There are also session/writing statistics and sprints.

### Cited Findings
- **Summary:** timing, pages, words, characters. Text ratio (action/dialogue/other). Scenes by time of day. Interior/exterior ratio. Characters with more or fewer than 10 lines.
- **Reports:** Scene report (characters per scene, duration, first appearance marked, sortable), Location report, Cast report (lines, scenes per character), Dialogues report (filter by character), Gender analysis (+ **Bechdel test**).
- **Plots:** Story structure analysis (scene/action/dialogue duration vs character counts), Characters Activity.
- Export is PDF or Excel. Session stats: words today, most productive days.
- Sources: [Help: Text statistics](https://starc.app/help/text-statistics/). Screenshots: `/media/help/en/text-statistics-1.png` … `-10.png`.
- Writing sprints: a timer from the main menu, a progress bar at the top, and an end card with words written (shareable) — [Help: Writing sprints](https://starc.app/help/writing-sprints/). Screenshots: `/media/help/en/writing-sprint-1.png` … `-3.png`. See also [Writing statistics](https://starc.app/help/writing-statistics/) (not fetched).
- Gating: FREE has basic screenplay statistics, PRO extended statistics, CREATOR statistics across all episodes — [Pricing](https://starc.app/pricing/).

### Gaps
- The help does not specify which exact reports are "basic" (FREE) and which are "extended" (PRO).

---

## 7. Other story types: stage play, audio play, comic, novel

### Takeaway
These story types share the same shell: Information, Parameters, Title page, Synopsis, Text and Statistics. Only Novel has an outline with cards and a timeline.

### Cited Findings
- Paragraph types: audio play adds Sound, Music, Cue. Comic adds PageHeading, PanelHeading, Description. Novel uses ChapterHeading1–6 + Text, with Part/Chapter folders — `text_template.h`.
- Templates: Audio drama uses BBC (A4, Arial). Stage play uses American. Comics have 4 templates (line-by-line vs script-form dialogue). Novel has 2 page formats × 4 fonts — [Help: Document templates](https://starc.app/help/document-templates/).
- PDF export of split paragraphs (dual dialogue, comic lines, audio, stage) was improved in v0.8.1 — [Blog 2026-03-03](https://starc.app/blog/2026-03-03).
- AI "Generate novel" converts a script into a novel document in the same project, and the reverse also works — [Help: AI assistant](https://starc.app/help/ai-assistant/).
- Novel export: [Help: Novel exporting](https://starc.app/help/novel-exporting/) (not fetched).

### Gaps
- No help articles exist specifically on the stage play, audio play or comic editors.

---

## 8. Typical end-to-end screenwriter flow in STARC

### Takeaway
STARC's own docs imply this path: create a story → logline/poster/synopsis → characters, locations and worlds (with relations map) → treatment with scene headings and beats (cards to reorder) → write script text under the beats → review/track changes with co-authors → named drafts and comparison → statistics/reports → export.

### Cited Findings (assembled from the steps documented in each page)
1. **Create:** "+ Create story" → type → name. Optionally save to the cloud (CREATOR) — [Start writing](https://starc.app/help/start-writing/), [Cloud projects](https://starc.app/help/cloud-projects/).
2. **Idea:** logline generator, poster generator, synopsis document — [Logline generator](https://starc.app/help/logline-generator/), [Poster generator](https://starc.app/help/movie-poster-generator/), [Pricing](https://starc.app/pricing/).
3. **World and characters:** add characters, locations and worlds. Draw the relations map (PRO) — [Characters relations](https://starc.app/help/characters-relations/).
4. **Structure:** in Treatment, write scene headings + beats. Set colour, tags and story day per scene. Reorder in the navigator or in Cards (PRO) — [Beat sheet](https://starc.app/help/beat-sheet/).
5. **Draft:** in Screenplay, toggle beats visible and write the text inside the beats (Tab/Enter flow). Use scene isolation for focus. Use AI tools if needed — [Beat sheet](https://starc.app/help/beat-sheet/), [Scene isolation](https://starc.app/help/scene-isolation-mode/), [AI assistant](https://starc.app/help/ai-assistant/).
6. **Review:** use review/track-changes/revision modes. Co-authors take Editor/Commentator/Reader roles with per-document access — [Review mode](https://starc.app/help/review-mode/), [Cloud projects](https://starc.app/help/cloud-projects/).
7. **Iterate:** "Create draft" with a name, lock the old one, then "Compare drafts" — [Releases](https://github.com/story-apps/starc/releases), `create_draft_dialog.cpp`.
8. **Analyse and ship:** statistics/reports (PDF/Excel), then export the script to PDF/DOCX/FDX/Fountain — [Text statistics](https://starc.app/help/text-statistics/), [Screenplay exporting](https://starc.app/help/screenplay-exporting/).

**Collaboration details (CREATOR):** invite by email with the role Editor, Commentator or Reader. "Configure Access" sets per-document rights (for example per episode). A collaborator's capabilities depend on their own plan: FREE users edit only the text, while cards, gallery and maps need PRO and breakdown needs CREATOR. Projects can be moved between cloud and local storage from the start screen — [Help: Cloud projects](https://starc.app/help/cloud-projects/). Screenshots: `/media/help/en/cloud-project-1.png` … `-6.png`. Note: this page still says "CLOUD", the pre-v0.8.1 name of CREATOR.

### Inferences
- STARC has no guided methodology layer (theme, tone, genre, psychological profiles, dialogue score). Its "pre-writing" stops at logline, synopsis, characters/relations, mind maps and treatment beats. This is the gap Authorled's 22 documents + AI would fill. Integration points would be Text/Folder documents, character profiles, treatment beats and script text.

### Gaps
- No YouTube tutorial transcripts or Telegram posts were checked (out of tool budget). The help pages are sparse on Cards, Timeline, Breakdown, Series plan, Mind map and drafts UI, which would need hands-on app inspection or video review.
- Docs-vs-reality mismatches noted in sources:
  - The cloud-projects help still uses "CLOUD", while pricing and v0.8.1 use "CREATOR".
  - The beat-sheet article URL is `/help/beat-sheet/`, but its RU title is "Как составить поэпизодник" and its screenshots are named `treatment-*.png`. Beat sheet and treatment are effectively conflated in STARC's terminology.
