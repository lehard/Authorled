# UI/UX of modern screenwriting and playwriting tools (state as of Oct 2026)

Method note: ~17 searches/fetches. Primary sources (vendor sites, help centers) were preferred; several comparison blogs are affiliate or competitor-owned (Laper, Greenlight Coverage, ScriptReaderPro) and are flagged. Reddit r/Screenwriting threads did not surface in search results, so direct Reddit sentiment is a gap; forum sentiment comes from Stage 32 and G2 instead.

## 1. How the tools structure the workspace

### Takeaway
The dominant layout is "script page in the center + structure pane beside it" (Navigator / Plot Board / Beat Board / corkboard), with the outline living in the same window as the script and linked to it. Newer tools (Arc Studio, STARC) add a project-level "bible" (characters, locations, world) from which several formats are produced; Causality is the outlier that puts a cause-and-effect timeline at the center.

### Cited Findings
- **Final Draft 13** (current version): planning is a trio of Beat Board + Outline Editor + Structure Lines; also tracked revisions, built-in commenting, automatic version saving, auto pagination/formatting. — [Final Draft product page](https://www.finaldraft.com/products/final-draft/)
- Final Draft 13 strengthened the link "Beat Board -> Outline Editor -> Pages": outline content can be sent to script pages; beats can show title, body, or both. — [Final Draft KB: How can I outline a script](https://kb.finaldraft.com/hc/en-us/articles/15573792158996-How-can-I-outline-a-script-in-Final-Draft); [Final Draft blog: Beat Board](https://www.finaldraft.com/blog/how-to-use-a-beat-board-for-pretty-much-everything-in-your-script)
- Final Draft Beat Board ships structure templates incl. Save the Cat! (Blake Snyder) and Dan Harmon's Story Circle. — [Final Draft blog: Beat Board](https://www.finaldraft.com/blog/how-to-use-a-beat-board-for-pretty-much-everything-in-your-script)
- Final Draft "Story Map" (page-level overview of the script) is an older feature documented for FD11; not featured in FD13 marketing. — [Final Draft KB features section](https://kb.finaldraft.com/hc/en-us/sections/15997553946772-Features?page=1); [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/)
- **Arc Studio Pro**: the "Plot Board" is a digital whiteboard integrated into the editor; acts are columns, beats are cards (title + expandable description); beats are visible in the same window while writing scenes. — [Arc Studio help: The Plot Board](https://help.arcstudiopro.com/guides/the-plot-board)
- Arc Studio: notes on characters, storylines and locations; beats tagged with color-coded elements; "Outline view" shows the structure as paragraphs; Cmd+K command palette ("Quick Reference Guide") searches actions and shows shortcuts; Focus Mode (Cmd+D); sprint timer with a "Nag me when I don't write" toggle; Shift-click opens a second window. — [Arc Studio help: switching for experienced screenwriters](https://help.arcstudiopro.com/guides/switching-to-arc-studio-for-experienced-screenwriters)
- Arc Studio for TV: outline a whole season and auto-convert each episode outline into its own script file with beats included. — [Arc Studio blog: story building](https://arcstudiopro.com/blog/story-building-with-arc-studio-pro)
- **STARC / Story Architect** (successor of KIT Scenarist, Russian-origin, Russian UI available): one project holds multiple series/episodes; screenplays, comics, plays and books are created from a single project bible (characters, locations, world); home screen for projects; mind map; corkboard; character relations map; free version with unlimited projects; 63 releases, ~22.6k authors (site counter). Roadmap: 0.8.X showrunner tools/series plan/writing goals; 0.9.X history mode, beats editor, chat room; 1.0+ common board for all series, interactive stories. — [starc.app](https://starc.app/)
- KIT Scenarist development frozen; replaced by STARC since ~2020; KIT had corkboard, mind maps, image gallery, basic character/location profiles, stats, cloud sync, real-time co-writing. — [starc.app/help/kitscenarist](https://starc.app/help/kitscenarist/); [KIT Scenarist 2.0 beta announcement](https://kitscenarist.ru/en/history/2020-04-29.html); [AlternativeTo](https://alternativeto.net/software/kitscenarist/about)
- **Highland Pro** (Mac/iPad/iPhone): Navigator = road map of sections, scenes, synopses and notes; Snippets (side bin for cut text); Comments; To Do checklist; Goals (page/word/character); Sprints; Title Page Builder; Cast and Location lists; "/Lookup" slash command for definitions/rhymes in-editor. — [Highland 2 site](https://quoteunquoteapps.com/highland-2/)
- **Causality** (Hollywood Camera Work): three panes — hierarchical timeline, a "story logic" flowchart-like pane, and a writing pane; explicit set-up/pay-off links; positioned for serialized TV, mystery, ensemble. Older (2018) review. — [outlinersoftware.com review](https://outlinersoftware.com/topics/viewt/8339); [Causality testimonials](https://www.hollywoodcamerawork.com/causality-testimonials.html)
- **Celtx**: writing plus production in one platform; script content pre-populates budgeting and scheduling modules; "Script Insights" graphical breakdowns and writing goals. — [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/); [Greenlight Coverage, Jul 2026](https://glcoverage.com/blog/best-ai-tools-for-screenwriters/)
- **Movie Magic Screenwriter**: NaviDoc sidebar (show/hide/move outline elements), up to 30 outline levels. **Script Studio**: step outlining by sequence, PowerView color-coded acts with templates (Hero's Journey). — [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/)
- **Saga** (writeonsaga.com): web app combining screenplay editor with inline scene rewriting, coverage chat, 40-beat feature and 25-beat TV structures, then AI storyboards/previz. — [Saga](https://writeonsaga.com/home); [itechguides](https://www.itechguides.com/products/saga/)

### Inferences
- Common denominator: a persistent left/right structure panel (navigator of scenes / beats) next to the page, with drag-reorder that changes the script. Borrow: a side panel in Authorled listing the 22 documents plus, inside the screenplay doc, a scene navigator.
- The "project bible feeds multiple formats" model (STARC) maps directly onto Authorled's pipeline (world/characters -> scene drafts -> screenplay/play/prose output).
- Arc Studio's "outline season -> auto-generate episode script files with beats" is the closest analogue to Authorled's "episode outline -> scene beat maps -> drafts" handoff.

### Gaps
- Save the Cat! software, Logline, Scriptation's writing features, Drafty, StudioBinder's editor and Fade In's workspace layout were not verified from primary sources in this pass (only Save the Cat as a Final Draft template, Fade In via ScriptReaderPro). Scriptation appears only as a PDF annotation app with revision-color layers ([Scriptation help](https://help.scriptation.com/en/article/how-do-i-add-revision-colors-to-my-script-c9l9k1/)).
- No habr/vc.ru articles on Russian tools were retrieved; "Celtx in Russia" status not found.

## 2. Script element formatting UX, autocomplete, page count, navigator

### Takeaway
The Tab/Enter element state machine (Action <-> Character -> Dialogue/Parenthetical) is a de facto standard inherited from Final Draft and copied by everyone; secondary affordances are a margin element menu, single-letter element shortcuts, and autocomplete of remembered character names and scene headings.

### Cited Findings
- Arc Studio flow: Tab in empty Action -> Character, Tab in empty Character -> Action; after Character name, Return -> Dialogue, Tab -> Parenthetical; from Dialogue, Tab -> Parenthetical, Return -> Character; typing "int.", "ext.", "i/e." converts Action into Scene Heading; flow is user-configurable. — [Arc Studio help](https://help.arcstudiopro.com/guides/switching-to-arc-studio-for-experienced-screenwriters)
- Arc Studio alternatives to keys: click element icon in left margin -> "Change element"; keyboard shortcuts; "element mode letter shortcuts" (Return on empty element then a letter, e.g. A = Action); custom elements; TV template adds "Start of Act"/"End of Act" elements. — [Arc Studio help](https://help.arcstudiopro.com/guides/switching-to-arc-studio-for-experienced-screenwriters)
- Arc Studio auto-completer offers previously written Scene Headings and Character names. — [Arc Studio help](https://help.arcstudiopro.com/guides/switching-to-arc-studio-for-experienced-screenwriters)
- Final Draft's tab behavior and macros are what other programs follow. — [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/)
- Movie Magic autocompletes character names and locations and auto-adds MORE/CONT'D, page and scene numbers. — [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/)
- STARC: industry-standard formatting, Tab and Enter switch paragraph formats. — [starc.app](https://starc.app/)
- Page-count fidelity is a trust issue: a Stage 32 user found Celtx margins drifted so page count changed after import into Final Draft. — [Stage 32 lounge](https://www.stage32.com/lounge/screenwriting/Final-Draft-vs-Celtx-vs-Arc-Studio-I-have-questions)
- Final Draft revision page colors are only visible in Page View, i.e. paginated view is a distinct mode. — [Final Draft KB: Revision Mode](https://kb.finaldraft.com/hc/en-us/articles/27813588722708-How-do-I-use-Revision-Mode)

### Inferences
- For a Russian-language screenplay/play editor, keep the same Tab/Enter state machine (writers' muscle memory), add a visible element indicator in the margin plus a Cmd+K palette. Russian scene headings ("ИНТ."/"НАТ.") need their own triggers — STARC is the reference for Russian conventions.
- Page count ~ screen time is the core metric writers watch; it must be computed from exact layout, otherwise trust is lost (Celtx complaint).

### Gaps
- No primary source retrieved on timing estimates (e.g. Final Draft/Fade In script timing), Russian screenplay formatting standards, or play (stage) element flows.

## 3. Outlining: beat boards, cards, color threads, timelines, templates, outline <-> script link

### Takeaway
Cards on a board (acts as columns) with colored storyline tags, plus a linear outline view of the same data, plus templates (Save the Cat, Story Circle, Hero's Journey), all bidirectionally tied to the script, is the standard; Causality's set-up/pay-off links and STARC's two-way card<->text sync are the advanced variants.

### Cited Findings
- Final Draft: Beat Board (freeform index-card canvas) -> Outline Editor -> pages; Structure Lines; templates Save the Cat!, Story Circle. — [Final Draft KB](https://kb.finaldraft.com/hc/en-us/articles/15573792158996-How-can-I-outline-a-script-in-Final-Draft); [Final Draft blog](https://www.finaldraft.com/blog/how-to-use-a-beat-board-for-pretty-much-everything-in-your-script)
- Arc Studio Plot Board: acts = columns, beats = cards, color-coded storyline/character/location tags, drag-and-drop; Outline view as paragraphs; beats shown beside script. — [Arc Studio help: Plot Board](https://help.arcstudiopro.com/guides/the-plot-board); [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/)
- STARC corkboard: cards in sequence or columns, color tags, notes, grouping by act; changes sync with script text in both directions; beats editor planned (0.9.X); timeline and statistics screens shown. — [starc.app](https://starc.app/)
- Causality: timeline + story-logic graph + writing pane, set-up/pay-off associations, cause-and-effect links connected to the script. — [outlinersoftware.com](https://outlinersoftware.com/topics/viewt/8339); [Hollywood Camera Work](https://www.hollywoodcamerawork.com/causality-testimonials.html)
- Saga: 40-beat feature and 25-beat TV structure scaffolds. — [itechguides](https://www.itechguides.com/products/saga/)
- Script Studio: PowerView color-coded acts, templates; FeelFactor 1-10 engagement charts. — [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/)
- Greenlight Coverage notes Final Draft's beat/structure tools are templates, not generative AI. — [Greenlight Coverage](https://glcoverage.com/blog/best-ai-tools-for-screenwriters/)

### Inferences
- Borrow for Authorled's "skeleton map" and "episode outline": board view (acts/episodes as columns, beats as cards) + list/outline view of the same data + colored thread tags (plotlines/characters). Bidirectional sync matters: editing a beat in the scene draft should reflect back, or at least flag drift.
- Causality's set-up/pay-off links are a strong pattern for an AI checker ("this set-up has no pay-off").

### Gaps
- Save the Cat! software's own "Beat Sheet/Board" UI and Plottr-style timelines not verified here.

## 4. Revision tracking: colors, locked pages, change marks, snapshots, comparison

### Takeaway
Two distinct models coexist: writer-phase "Track Changes" (inline add/delete marks with hover Accept/Reject, Accept All) and production-phase "Revision Mode" (locked pages, colored revision sets, margin asterisks, A-pages). Cloud tools add infinite history, per-line revert, and a "graveyard" of cut text.

### Cited Findings
- Final Draft Track Changes (since FD12): additions/deletions shown inline; hover -> Accept/Reject; Accept All/Reject All; per-user name and markup color; works with online collaboration. Revision Mode: lock pages, numbered colored sets (first usually blue, then pink), each page with a change marked revised; up to 20-30 sets. (Article dated 5 Sep 2025.) — [Final Draft blog: Track Changes vs Revision Mode](https://www.finaldraft.com/blog/tech-tips-track-changes-vs.-revision-mode)
- Final Draft: new text gets a margin mark; with Show Page Colors, revised pages get the set color in the margin; locking pushes overflow to A-pages without affecting following page numbers; advise not to lock before pre-production. — [Final Draft KB: Revision Mode](https://kb.finaldraft.com/hc/en-us/articles/27813588722708-How-do-I-use-Revision-Mode); [Final Draft KB: locking](https://kb.finaldraft.com/hc/en-us/articles/27817054455828-How-do-I-lock-or-unlock-script-pages-and-use-the-locking-tools)
- Final Draft alternate dialogue: store multiple versions of a line and swap. — [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/)
- WriterDuet: revision history by date, writer, tagged revision and individual line; see added/removed text; revert a single line; search history for a deleted line and view whole script at that time. — [WriterDuet blog](https://www.writerduet.com/blog/writerduet-is-better-than-final-draft-html/)
- WriterDuet: line alternates; "The Graveyard" holds cut content; accept/reject collaborator edits; color-coded edits. — [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/)
- Fade In: scene versions and alternates for all elements, not just dialogue. — [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/)
- Arc Studio: drafts one click away, see what changed between drafts, restore work cut from earlier drafts, background change tracking. — [Arc Studio help](https://help.arcstudiopro.com/guides/switching-to-arc-studio-for-experienced-screenwriters)
- Highland: Revision Mode tracks changes in different colors with margin stars. — [Highland 2](https://quoteunquoteapps.com/highland-2/)
- STARC: document history mode still on roadmap (0.9.X). — [starc.app](https://starc.app/)

### Inferences
- Authorled's "author approves each document" maps naturally onto Track Changes semantics: AI proposals shown as inline insert/delete marks with per-change Accept/Reject and Accept All; approved document = locked "set" (with color/number), later changes create a new set. Alternates (WriterDuet/Fade In) are a good pattern for showing 2-3 AI options for a line/beat without overwriting the author's text. A "graveyard" of rejected/cut material preserves author ownership.

### Gaps
- No primary detail found on side-by-side Script Compare UIs (Final Draft compare, Highland compare).

## 5. Character/location reports and dialogue distribution

### Takeaway
Reports are mostly lists (cast, locations, scenes) plus a few analytics: dialogue-per-character views, gender of speaking parts, and engagement charts.

### Cited Findings
- Fade In "Dialogue Tuner": all of one character's dialogue in one place for voice consistency edits. — [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/)
- Highland "Gender Analysis": gender breakdown of speaking parts; auto Cast and Location Lists. — [Highland 2](https://quoteunquoteapps.com/highland-2/)
- Final Draft: cast reports exist (help articles about names missing from cast report); praised for production reporting. — [Final Draft KB Production section](https://kb.finaldraft.com/hc/en-us/sections/15877856011796-Production); [Greenlight Coverage](https://glcoverage.com/blog/best-ai-tools-for-screenwriters/)
- Celtx Script Insights: graphical breakdowns of script content. — [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/)
- Arc Studio described as having "excellent analytics, not generative" (competitor-authored guide). — [Laper 2026 guide](https://laper.ai/blog/2026-05-15-best-script-writing-tools-2026/)
- STARC: character profiles with relationships, biographies, visual references; relations map; statistics screen. — [starc.app](https://starc.app/)

### Inferences
- Dialogue Tuner is directly relevant to Authorled's "dialogue score" and "psychological profiles": a per-character view of all lines, where AI flags out-of-voice lines against the profile, is a natural extension.

### Gaps
- No retrieved source detailed dialogue-share charts (lines/words per character per scene) in a specific tool.

## 6. AI features 2024-2026 and how suggestions avoid taking over authorship

### Takeaway
Incumbent pro tools are cautious: Final Draft has no native generative AI (as of mid-2026 reviews), WriterDuet relies on an add-on proofreader, Arc Studio offers bounded assistive AI (Table Read voices, character images, research assistant) on paid credits. Generative drafting lives in newer tools (Saga, Squibler, STARC's assistant) as text operations on selections. The WGA 2023 MBA frame (AI cannot write literary material or get credit) shapes positioning.

### Cited Findings
- Greenlight Coverage (13 Jul 2026): Arc Studio Pro AI = Table Read, Character Images, Research Assistant; AI costs extra credits even on Pro. Final Draft = no native generative AI. WriterDuet = limited native AI, main offering ScreenplayProof add-on. Fade In = none. Celtx = no AI described. WGA 2023 MBA: AI "cannot write or rewrite literary material and cannot receive writing credit." — [Greenlight Coverage](https://glcoverage.com/blog/best-ai-tools-for-screenwriters/)
- A competitor-authored 2025 guide calls Final Draft's AI "disappointing" and "stubbornly single-player"; a 2026 one says FD13's "AI Beat Board" is structured templates, not LLMs. (Biased source: Laper sells an AI tool.) — [Laper 2025](https://laper.ai/recent-highlights/2025-09-20-best-ai-screenplay-software/); [Laper 2026](https://laper.ai/blog/2026-05-15-best-script-writing-tools-2026/)
- Unverified third-party claim of a "Script Notes AI" in Final Draft; Final Draft's own ScriptNotes are non-AI annotations. — [aitoolscoop](https://aitoolscoop.com/tool/final-draft/); [Script Mag FD13 launch](https://scriptmag.com/news/final-draft-13-launches-today-in-surprise-drop)
- STARC AI Assistant (ChatGPT-based, any language, paid add-on): paraphrase/summarize, expand/shorten, insert text between two paragraphs, generate text on demand — i.e. operations on selected text. — [starc.app](https://starc.app/)
- Saga: inline scene rewriting, script review and coverage chat, then AI storyboards/previz; free tier, paid from ~$19.99/mo. — [itechguides](https://www.itechguides.com/products/saga/); [Saga](https://writeonsaga.com/home)
- Squibler: generates books/scripts from prompts or outlines; scene expansion, tone consistency, character/world builders; from ~$29/mo. — [callin.io](https://callin.io/ai-tools/squibler); [techjockey](https://www.techjockey.com/ae/detail/squibler)
- WriterDuet ReadAloud text-to-speech (Premium). — [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/)
- Coverage services stress scripts "will not be used to train any AI model" as a trust signal. — [Greenlight Coverage](https://glcoverage.com/blog/best-ai-tools-for-screenwriters/)

### Inferences
- Pro-tool AI that writers tolerate is analytic or sensory (table read, coverage/notes, research, proofreading), not ghost-writing. Authorled's "AI asks questions, proposes options, author approves" sits on the acceptable side if it presents options as alternates/track-changes, never silently writes into the approved document, and states a no-training policy prominently.
- STARC's selection-scoped operations (expand/shorten/bridge two paragraphs) are a compact, borrowable menu for the scene-draft stage.

### Gaps
- Arc Studio's AI page returned 404; no primary description of its suggestion UI. No primary info on Final Draft 13.x AI, WriterDuet AI beyond add-on, Celtx AI, or Logline/Drafty.

## 7. Writer praise and complaints

### Takeaway
Praise centers on reliable industry formatting (Final Draft), modern UI and collaboration (Arc Studio, WriterDuet), stability and one-time price (Fade In); complaints center on dated UI, price, paid AI credits, weak iPad apps, page-count/format drift, and production-focused bloat (Celtx).

### Cited Findings
- Stage 32: one user calls Final Draft the best program; another "very poor writing software by today's standards"; Arc Studio praised for interface (used for Greek script); Celtx margins drifted affecting page count. — [Stage 32](https://www.stage32.com/lounge/screenwriting/Final-Draft-vs-Celtx-vs-Arc-Studio-I-have-questions)
- Arc Studio cons: steeper learning curve, Mac slowness/crashes, iPad app lacks key editing, watermarked free exports; AI credits extra. — [G2 free screenwriting](https://learn.g2.com/free-screenwriting-software); [Greenlight Coverage](https://glcoverage.com/blog/best-ai-tools-for-screenwriters/)
- WriterDuet: Ed Solomon quoted "most intuitive, most user-friendly"; G2 users report dashboard glitches. — [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/); [Greenlight Coverage](https://glcoverage.com/blog/best-ai-tools-for-screenwriters/)
- Celtx: "functional but dated", writers stay because production companies use it; reader comments call it flaky. — [Laper 2025](https://laper.ai/recent-highlights/2025-09-20-best-ai-screenplay-software/); [ScriptReaderPro](https://www.scriptreaderpro.com/screenwriting-software/)
- Final Draft price $249.99 one-time; Fade In $79.95 one-time; Arc Studio $69-99/yr; WriterDuet $9.99-13.99/mo (mid-2026). — [Greenlight Coverage](https://glcoverage.com/blog/best-ai-tools-for-screenwriters/)

### Inferences
- Must-haves for credibility: exact formatting/pagination and clean FDX/PDF/Fountain export (Authorled final text must survive import into Final Draft). Nice-to-haves that drive love: focus mode, sprints/goals, command palette, frictionless collaboration.

### Gaps
- Direct r/Screenwriting threads not retrieved; sentiment here is from Stage 32, G2 and blogs (several biased). No Russian user reviews (habr/vc.ru) on STARC retrieved.
