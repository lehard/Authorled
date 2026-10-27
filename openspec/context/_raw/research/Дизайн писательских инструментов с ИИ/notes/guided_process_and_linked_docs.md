# UX for guided multi-stage creative methodologies and linked knowledge (story bibles, dependency graphs, change impact)

Research date: 2026-10-27. Most sources are product docs, help centers, community forums and Ink & Switch research notes. Several sources are older (2017–2025), and each is marked as such. Some vendor feature claims could not be checked against a live app; where that happens it is said explicitly.

## 1. How methodology-driven story tools present process (stepper/wizard, roadmap, checklist, progress maps)

### Takeaway
Writing tools fall into three groups. The first is **linear cascades of fields** (Sudowrite Story Bible, the old Snowflake Pro), where each step feeds the next and AI generates the next step from the previous one. The second is **templates on a free canvas** (Plottr, LivingWriter, Campfire), which have no gating at all. The third is **question-driven structure engines** (Dramatica), which explicitly tell the writer not to answer every question. Per-unit element checklists (Fictionary) are the closest analogue to Authorled's "checklist closes the stage". None of the surveyed tools hard-gates the next stage on approval, so Authorled's gate is unusual in this category.

### Cited Findings
- **Sudowrite Story Bible** is a chained cascade: Braindump → Synopsis → Genre/Style → Characters → Worldbuilding → Outline → Scenes → Draft. Each field is generated from the upstream ones. Synopsis is generated from Braindump + Genre. Synopsis in turn drives Characters, Worldbuilding, Outline and Beats, and if Synopsis is empty these fall back to the Braindump. Braindump is manual only and "not influenced by any of the other fields". The docs call the Story Bible a "source of truth that both you and the AI can refer back to." ("Story Engine" is an older name.) — [Sudowrite docs: What is Story Bible](https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC); [Sudowrite blog: story bible template](https://sudowrite.com/blog/story-bible-template-how-to-build-one-and-how-sudowrite-does-it-for-you/)
- A Sudowrite guide recommends a messy braindump, because it is used as raw material later. It also says the 200–400-word AI synopsis should be rewritten by the author because "it will get things wrong". — [Sudowrite blog: complete workflow](https://sudowrite.com/blog/sudowrite-complete-workflow/)
- **Snowflake Pro** (Randy Ingermanson) was custom software that walked users step by step through the Snowflake Method. It also generated a book-proposal skeleton after the first 6 steps. The author said tens of thousands of novelists used it, then **discontinued** it. A forum post says it is now free for owners of an older copy or buyers of his book (not verified). The vendor now points to a Plottr Snowflake product. (Older info, roughly 2009–2021.) — [Advanced Fiction Writing: Snowflake Pro](https://www.advancedfictionwriting.com/product/snowflake-pro-software/); [Plottr Snowflake Method product](https://www.advancedfictionwriting.com/product/plottr-software-snowflake-method/); [MobileRead thread](https://www.mobileread.com/forums/showthread.php?p=4132850)
- **Plottr** applies methodologies as *timeline templates*. In the timeline you hover "+" and choose "Use Template", and you can save and edit your own templates. The official docs say Save the Cat is **not** currently a built-in template; users build it themselves. — [Plottr docs: Timeline starter templates](https://docs.plottr.com/article/214-timeline-starter-templates)
- **LivingWriter** ships several plot-structure templates. A ProWritingAid review lists Save the Cat as "27 Beat Chapter Plotting" (which conflicts with the canonical 15 beats). Choosing a template puts the outline into the editor as note cards. There is an "Elements Board" for characters and locations, plus an AI outline generator. Import from Word/Scrivener reads heading levels as chapter and scene breaks. (These are third-party reviews; no official docs were found.) — [ProWritingAid review of LivingWriter](https://prowritingaid.com/art/1599/review-of-livingwriter.aspx); [TCK Publishing review](https://www.tckpublishing.com/livingwriter-review/)
- **Dramatica** (current platform: Storyform + Subtxt + Narrova) follows "capture premise → shape the Storyform (throughlines, conflict, outcome) → build beats with Subtxt". Of "nearly 100 potential questions", answering **8–12** yields a storyform. The official advice is to answer what you know best first and to build 3–4 alternative storyforms to compare. — [Dramatica: How does the software work](https://dramatica.com/questions/how-does-the-dramatica-software-work); [Dramatica: "Correctly" answering questions](https://dramatica.com/questions/correctly-answering-dramatica-questions); [Dramatica docs: Use the platform](https://dramatica.com/docs/use)
- In older desktop Dramatica, community guides recommend open-ended "All Storytelling" or "Quick Story" question lists over multiple-choice StoryFORMING questions. The stated reason is that structural multiple-choice questions are hard to answer before you know what the story is. (Older.) — [Storymind: Dramatica software](https://www.storymind.com/dramatica/software/2.htm)
- **Fictionary StoryTeller** checks every scene against **38 story elements** (one blog says 39), grouped into Character / Plot / Setting. On the Evaluate page the scene text sits in the middle with the elements beside it, and some elements are **auto-filled**. Writers go through scene by scene in the order Characters → Plot → Setting. — [Fictionary: story elements](https://fictionary.co/journal/story-elements); [Fictionary help: Evaluate](https://fictionary.co/support/help-doc/evaluate/); [Fictionary StoryTeller](https://fictionary.co/products/storyteller-for-experienced-writers/)
- **Campfire** is modular, with about 18 modules (Characters, Timeline, Calendar, Relationships…). It offers a timeline with nested notes linked to the rest of the story, but no process stepper. One user feature request says timeline connections are not browsable from event details. — [Campfire story planner](https://www.campfirewriting.com/story-planner); [Campfire about](https://campfirewriting.com/about); [Campfire feature request](https://campfiretechnology.upvoty.com/b/feature-requests/timeline-connections-link-events)

### Inferences
- The Sudowrite and Snowflake "cascade" is the closest model to D1→D22. Sudowrite shows the useful pattern **"upstream fields are explicitly labeled as feeding downstream ones"**, and the docs even spell out the influence graph. Authorled can show "what this document feeds" and "what it depends on" on each document.
- Fictionary's "auto-filled elements next to the text" matches Authorled's split into formal auto-checked items and subjective author-ticked items. Put the checklist in a side panel next to the document, not in a modal at the end.
- Dramatica's "8–12 of ~100" and "answer what you know first" show that methodology-heavy tools keep their sense of freedom by **separating the minimum required set from the optional deepening**. Authorled's checklists should visibly separate "required to close" from "optional/recommended".
- Not one of the mainstream tools hard-blocks the next stage. Authorled's gate needs to be justified in the UI (for example "D12 depends on D4–D11; without them the AI cannot propose formats") or it will feel bureaucratic.

### Gaps
- No primary sources were found for Marlowe (Authors A.I.), Story Planner (mobile), Save the Cat! Story Structure Software or dedicated Hero's Journey apps; they were not covered.
- No hands-on screenshot review of Snowflake Pro's screens was found.
- Whether Campfire auto-links mentions in 2026 was not verified.

## 2. Non-writing analogues with stage gates and checklists: what keeps motivation and freedom

### Takeaway
NN/g's wizard guidance (2017) supports a sequential, gated flow only for unfamiliar, infrequent processes. It requires showing all steps, labelled back and next, and save-and-resume, and it warns that wizards limit control and creativity. Duolingo's 2022 forced path shows the backlash when skipping and choosing are removed, and Duolingo later had to support jumping ahead. TurboTax keeps a long interview tolerable through section-level navigation, setting expectations for what comes next, resume-where-you-left, and guided error correction.

### Cited Findings
- NN/g (Raluca Budiu, **June 2017**): use wizards "for novice users or infrequent processes". Wizards "limit the users' control and creativity", and they are a poor fit when steps benefit from any order or the process is repeated often. Show "a list or a diagram of the steps involved and highlighting the current step". Provide next and previous buttons labelled with what the step involves. Allow users to "exit the wizard midway and save state". — [NN/g: Wizards: Definition and Design Recommendations](https://www.nngroup.com/articles/wizards/)
- Microsoft's older UI guidelines say a wizard should *supplement, not replace* the user's direct ability to do a task, that experienced users find wizards inefficient, and that heavy reliance on wizards can signal an overly complex interface. (Older, MSDN archive.) — [Microsoft: User Assistance guidelines](https://learn.microsoft.com/en-us/previous-versions/ms997609(v=msdn.10))
- **Duolingo path (Oct 2022)**: long-time users called it the "worst update ever" and compared it to Candy Crush, left one-star reviews, and complained they could no longer choose which lesson to do next. A UX critique said the path made the app nearly unusable for deliberate learners. Duolingo staff later acknowledged that users need to go back to practise a level or jump ahead in the path. The CEO declined to revert, citing simplicity for new users. Duolingo's self-reported data claims better learning outcomes. — [PiunikaWeb](https://piunikaweb.com/2022/10/13/duolingo-app-update-with-path-ui-faces-backlash-from-users/); [UX Collective critique](https://uxdesign.cc/down-the-wrong-path-the-disaster-of-the-latest-duolingo-ui-update-a4cdd1e6ea1c); [NBC News interview with von Ahn](https://www.nbcnews.com/tech/tech-news/duolingos-update-redesign-luis-von-ahn-interview-rcna44655); [Duolingo blog: efficacy](https://blog.duolingo.com/results-duolingo-efficacy-studies)
- **TurboTax**: the top navigation underlines the current section (e.g. "Deductions & Credits") so users see how much remains. Screens tell users what comes next, progress is saved and users resume where they left off, and errors are flagged with guided correction so users know what to revisit. These come from secondary analyses, not Intuit docs. — [Appcues: TurboTax](https://appcues.com/blog/how-turbotax-makes-a-dreadful-user-experience-a-delightful-one); [UX Collective: TurboTax analysis](https://uxdesign.cc/https-medium-com-ux-ui-analysis-of-turbotax-171c86d80a41); [TBH Creative](https://www.tbhcreative.com/?p=1344)
- Fast Company reports that Intuit's design lead first made the experience coherent end to end, then improved it. A Stanford GSB case notes that local screen rewrites sometimes reduced clarity elsewhere. (Older, roughly 2016.) — [Fast Company](https://www.fastcompany.com/3056784/how-turbotax-used-design-to-win-the-tax-wars); [Stanford GSB case](https://gsbpreserve.stanford.edu/view/E381A)
- Onboarding-checklist guidance (vendor and secondary sources): a wizard should hold only what the product cannot work without, and teaching or optional tasks belong in a checklist. Show "3 of 6 complete" rather than "50%". Pre-check the first item. Progress bars that reset and unskippable tours are anti-patterns. — [Kompassify: onboarding wizard guide](https://kompassify.com/blog/onboarding-wizard-guide); [Flook: onboarding progress bar](https://flook.co/blog/onboarding-progress-bar); [ui-audit onboarding patterns](https://cdn.jsdelivr.net/npm/ui-audit@1.0.2/references/29-patterns-onboarding.md)

### Inferences
- Authorled's process is infrequent and unfamiliar, so a gated sequence suits it. But it is also creative, the exact case where NN/g says wizards restrict. The compromise:
  - Gate only *approval* (the "official" state of a document).
  - Never gate *reading*: all 22 documents stay visible.
  - Allow *drafting ahead*, with a "draft, not approved" label.
  - Always allow returning back.
- Show the full 22-step map with the current position, like TurboTax's section bar. Show counts ("12 of 22 approved", "4 of 6 items") rather than percentages. Group the documents into named phases so the map isn't a wall of 22 dots.
- Label "next" buttons with the destination ("К D13: …"), per NN/g.
- Duolingo's backlash suggests offering an explicit, explained way to skip optional stages or jump with justification. For example, an author importing a manuscript may already have material for D5–D9.
- Treat stage gates D18/D21 (integrity checks) like TurboTax's final review: list the specific problems with a "fix" link to each document. A generic "not ready" message is the wrong shape.

### Gaps
- Primary sources on Linear and Notion onboarding checklists, Coursera or Teachable lesson-locking UX, and regulated workflows (e.g. Veeva or MasterControl stage gates) were not retrieved; I did not search them due to the tool-call budget.
- No NN/g article on progress indicators or checklists was retrieved; only the 2017 wizard article was fetched.

## 3. Story bibles / worldbuilding wikis: linking, mentions, hover previews, graph views

### Takeaway
What works is cheap linking: auto-detected mentions, "@" linking, hover previews and "Mentioned in" backlink lists. Novelcrafter adds *time-aware* entries ("progressions"). Global graph views are widely seen as decorative. Local, per-node graphs and backlink lists are what people actually use.

### Cited Findings
- **Novelcrafter Codex**: entries are auto-detected in prose and fed to the AI. **Progressions** are addenda to an entry that the AI sees only when working on a scene at or after the point where the progression was added; use them for marriage, a new job or a tattoo. A **Series Codex** is shared across books. — [Novelcrafter: Codex feature](https://www.novelcrafter.com/features/codex); [Novelcrafter docs: Progression additions](https://docs.novelcrafter.com/en/articles/8675593-progression-additions); [Novelcrafter course: tracking previous books](https://www.novelcrafter.com/courses/codex-cookbook/tracking-previous-books)
- **LegendKeeper** (changelog 0.14): an inline autolinker detects link candidates as you type, alongside a bulk autolinker. Both avoid matching inside words and prefer the longest match. Hover previews appear with less delay and don't overlap content. Toggles and name exemptions are listed as planned. "@" plus a page name creates a link. — [LegendKeeper changelog 0.14.0.0](https://legendkeeper.com/changelog/legendkeeper-0-14-0-0); [groupfinder: LegendKeeper](https://groupfinder.eu/library/legendkeeper)
- **Kanka**: @mentions are the main linking mechanism. Designed relations are drawn as solid lines and mention-based connections as dotted lines. Each entity has a "Mentioned In" list collecting every journal and location where it appears. — [Kanka: Learn / living web](https://kanka.io/learn/living-web/_payload.json)
- **World Anvil**: hover "sneak-preview" for article links that use World Anvil's BBCode syntax; plain URL links get no preview. (Older community guide, likely outdated.) — [World Anvil community article](https://www.worldanvil.com/w/html-wanderpus-wanderpus/a/wanderresource3A-rp-forums-aka-discussion-boards-article)
- **Obsidian graph view**:
  - Forum users call the global graph a "pretty feature" with unstable layout between loads. Publish users say any node with more than 5 connections "gets messy in a hurry".
  - The local graph (one note plus neighbours) is consistently rated more useful.
  - Defenders use the global graph as a diagnostic for orphan notes and for watching areas grow. — [Obsidian forum: What's the point of the graph view?](https://forum.obsidian.md/t/whats-the-point-of-the-graph-view-how-are-you-using-it/71316); [Eleanor Konik: In defense of graph view](https://www.eleanorkonik.com/its-not-just-a-pretty-gimmick-in-defense-of-obsidians-graph-view); [Obsidian forum: local graphs in Publish](https://forum.obsidian.md/t/node-color-filtering-and-depth-for-local-graphs-in-obsidian-publish-mode/22490/15)
- **Sudowrite** treats the Story Bible as a single source of truth for both author and AI (see section 1). — [Sudowrite docs](https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC)

### Inferences
- Authorled's graph is small and fixed: 22 document types with known edges, defined by the methodology. A global force-directed graph would add little. Better options:
  - a **per-document "depends on / feeds into" panel**, which is a local graph;
  - a **fixed-layout matrix or swimlane map** of the 22 documents with status colours.
- Kanka's split between *designed relations* (solid) and *mentions* (dotted) maps onto Authorled's two link types: structural methodology edges, and content-level links such as a character from D4 mentioned in D15. Show them differently.
- Novelcrafter's progressions show an established pattern for time-aware context the AI must respect. That matters if Authorled's AI checks consistency of facts that change over the story.
- Hover previews of a linked document's relevant fragment are cheap and well liked. Show a preview of the quoted passage, not the whole document.

### Gaps
- No head-to-head study comparing linking UX across World Anvil, LegendKeeper and Kanka was found; the evidence is vendor changelogs and forums.
- Campfire's and Novelcrafter's 2026 graph and relationship-view details were not verified.

## 4. Dependency and impact UX: stale badges, dirty states, traceability, update notifications, review queues

### Takeaway
Mature patterns fall into three groups:
- **Jama suspect links**: a red flag on the downstream item, a project-wide suspect list, compare versions, then an explicit "clear".
- **Hex stale cells**: an orange squiggle when an upstream ancestor ran more recently, with run modes that choose whether stale cells are recomputed.
- **Figma library updates**: a badge, review with side-by-side or overlay compare, then accept per instance or all at once.

All three separate *detection* (automatic), *assessment* (a human compares versions) and *resolution* (update or explicitly dismiss). Authorled's "outdated vs contradicts" AI assessment with quotes is an added assessment layer none of them have.

### Cited Findings
- **Jama Connect suspect links**:
  - When an upstream item changes, the downstream link is flagged "suspect". Only fields configured by an admin per item type trigger it.
  - The flag shows as a red indicator in List and Single Item views, "Causing Suspect" status in the Relationships view, and a project-wide **Suspect Links** window.
  - Compare Versions shows a side-by-side diff. A reviewer then either confirms no impact or edits, and **clears** one link or all visible ones.
  - A community thread says flagging is downstream-only; Jama said other directions were out of scope (possibly dated). — [Jama help: Clear suspect links](https://help.jamasoftware.com/en/manage-content/coverage-and-traceability/relationships/clear-suspect-links.html); [Jama help: Find suspect links](https://help.jamasoftware.com/en/reference/quick-find/find-suspect-links.html); [Jama community: bi-directional traceability](https://community.jamasoftware.com/discussion/comment/7274/)
- **Hex**:
  - Cells become "stale" when an upstream ancestor has run more recently; the docs' example marks them with orange squiggles.
  - **Auto** mode updates downstream and stale cells, first re-running stale ancestors. "Cell + downstream" skips stale cells, and "Cell only" behaves like a classic notebook. — [Hex docs: Run modes and cell staleness](https://learn.hex.tech/docs/explore-data/projects/project-execution/run-modes-and-cell-staleness)
- **Figma**:
  - When a library publishes changes, a blue badge appears on the Libraries icon. Editors review old vs new **side by side or in overlay**, then update instances individually or all at once.
  - Forum threads report the prompt not appearing, changes not applying, and the prompt not reappearing until refresh unless you accept everything. This shows the risk when a notification is the only entry point. — [Figma help: Review and accept library updates](https://help.figma.com/hc/en-us/articles/360039234193); [Figma forum thread](https://forum.figma.com/t/library-updates-does-not-trigger-review-update-dialogog-box/60009)
- **Ink & Switch Patchwork** (2024): reviewers can see what changed and revert edits they disagree with, without the author approving each one. Reverting recent edits regardless of their time order was found especially useful. — [Ink & Switch: Patchwork notebook, 2024 version control](https://www.inkandswitch.com/patchwork/notebook/2024-version-control/)

### Inferences
- Map onto Authorled:
  - change in an approved document → automatic "suspect" flags on dependents (Jama, Hex);
  - AI assessment of each flagged document as "outdated" (soft, Hex-orange) or "contradicts" (hard, Jama-red), with quotes from both sides;
  - a single **review queue** listing affected documents (Jama's Suspect Links window);
  - per-document resolution: revise, or "confirm still valid" with an explicit clear (Jama).
- Offer Hex-like modes for the revision plan: "only this document", "this one and downstream", "everything stale". Order the queue by graph order.
- Use Figma's per-instance vs all-at-once accept as a model for granular acceptance of the AI's suggested edits within one affected document.
- Avoid Figma's failure mode: a stale state must be visible on the document itself and in the map, not only in a transient notification.
- Restrict triggering, as Jama does with configured fields. Typo fixes in an approved document should not flood the queue. Consider an author choice of "editorial change, don't recheck" versus "meaningful change". That choice must be explicit, not a silent fallback.

### Gaps
- No primary sources were fetched for Polarion's suspect links, Observable's reactive dataflow, spreadsheet dirty-state UX, Linear "related issues", or the Git/GitHub review flow. They are well-known patterns but uncited here.
- No user research was found on how writers perceive "your document is outdated" flags (emotional cost, alarm fatigue).

## 5. Version history and diff/compare UX for documents

### Takeaway
Google Docs offers per-version diffs against the predecessor, named versions and "Compare document" via copies. Ink & Switch's Upwelling (2023) and Patchwork (2024) give the most writer-specific research:
- always-on tracking that is shown on demand;
- named drafts as lightweight branches;
- deletions hidden behind hover markers;
- a change minibar;
- word or sentence counts instead of character counts;
- AI-generated summaries of each edit in a chat-like timeline, which the authors called a "remarkably useful way to understand writing edits at a high level".

### Cited Findings
- **Google Docs**: File → Version history. "Show changes" highlights edits vs the previous version. Up to **40 named versions** per document, with a "named versions only" filter. Comparing arbitrary versions requires copying the old version and using Tools → Compare documents. — [Google Docs Help: version history](https://support.google.com/docs/answer/190843?hl=en-GB); [Zapier: Google Docs revision history](https://zapier.com/blog/google-docs-revision-history/)
- **Upwelling** (Ink & Switch, March 2023):
  - Every edit happens in a *layer*; unmerged layers are *drafts* with purpose titles ("Copy edit", "Reworking the introduction"). The draft dropdown shows name, creator and number of changes.
  - A "Show Changes" toggle colours insertions per author. Deletions appear as a ➰ marker that reveals the deleted text on hover. Tracking is always on.
  - Merged layers form a read-only stack, and users can choose any earlier layer as the reference to diff against.
  - When another draft is merged, open drafts get a "Pending Changes" button so writers update when they choose.
  - Findings: heavy change highlighting hurts readability. Grouped edits (drafts) are more useful for review than per-edit suggestions. CRDT auto-merge still needs human review for semantic conflicts. — [Ink & Switch: Upwelling](https://www.inkandswitch.com/upwelling/); [Kleppmann: Upwelling](https://martin.kleppmann.com/2023/03/09/upwelling-version-control-for-writers.html)
- **Patchwork** (Ink & Switch, lab notebook Feb–Jul 2024):
  - Autosaved history with dynamic grouping (by author or time) plus manual milestones.
  - Margin hover reveals deletions and replacements. A "minibar" shows where changes are in a long document. Word and sentence counts work better than character counts for prose.
  - "Edit groups" use formality on demand: retroactive rationale and grouping.
  - Simple branching: branches can be created retroactively, named optionally, and are deleted after merge. This is lighter than Upwelling's mandatory draft layer.
  - AI bots edit on a branch so the author can accept all or part of the edits. Bot edits are labelled in history, and bots that leave rationale comments help decisions.
  - "History as chat": AI-generated edit summaries in a timeline, with merged branches shown as single items. — [Ink & Switch: Patchwork 2024 version control notebook](https://www.inkandswitch.com/patchwork/notebook/2024-version-control/)

### Inferences
- In Authorled every approval is a natural *named version* ("D7 — одобрено, вер. 3"). Diffs for change-impact review should compare the last approved version with the new one. That is Upwelling's "choose reference layer" applied to the approval point, rather than Google Docs' predecessor-only diff.
- AI revision proposals for affected documents should behave like Patchwork's bot branches:
  - shown as a proposal with a rationale and quotes;
  - accepted wholly or partly;
  - labelled as AI in history.
- An AI-written one-line summary of "what changed in D4 since approval" is a strong candidate for the head of the impact review. Patchwork found such summaries more useful than diff views.
- Hide deletions behind markers and show a minibar in long documents such as D22 (the final text), to keep diffs readable.

### Gaps
- Notion and Figma version-history details were not retrieved. Patchwork's 2025–2026 status (ongoing or productized) was not confirmed.

## 6. Importing existing manuscripts: mapping extracted entities for review

### Takeaway
Current tools stay shallow here. LivingWriter and Novelcrafter import DOCX, Markdown or HTML and split it into chapters or scenes by headings. Novelcrafter detects characters scene by scene and has no "detect all", and it cannot bulk-import codex entries; users work around this with an external AI plus its Extract feature. A whole-manuscript → structured-documents import with a review step is not served by the surveyed tools.

### Cited Findings
- Novelcrafter: "detect characters" lives in the scene action menu, and matches to existing entries are auto-linked. It is scene by scene; users ask for "detect all". An April 2024 help article said detection was GPT-only (dated). — [Novelcrafter docs: automatically add characters](https://docs.novelcrafter.com/en/articles/9184520-how-to-automatically-add-characters-to-the-codex); [Novelcrafter feedback: bulk create codex entries](https://feedback.novelcrafter.com/feedback/p/bulk-create-codex-entries-from-chat-file)
- The Novelcrafter FAQ (Jan 2025) says codex entries cannot be imported; they are added manually or via **Extract**, which turns chat responses or snippets into codex entries. Codices can be copied between books via templates. — [Novelcrafter FAQ: codex import](https://novelcrafter.com/help/faq/codex/codex-import); [Novelcrafter docs: Extract](https://novelcrafter.com/help/docs/organization/the-extract-feature)
- LivingWriter imports from Scrivener or any word processor and reads heading sizes as chapter and scene breaks (third-party review). — [TCK Publishing: LivingWriter review](https://www.tckpublishing.com/livingwriter-review/)
- A user request for importing character and location lists from text or JSON is still open in Novelcrafter's tracker. — [Novelcrafter feedback: import characters/locations](https://feedback.novelcrafter.com/feedback/p/import-characterslocations-into-codex-from-list-text-file-or-similar)

### Inferences
- Novelcrafter's Extract (AI output → user-confirmed entries) is the existing precedent for "AI proposes, author confirms". Authorled's import can generalize it:
  - parse DOCX or PDF into chapters (by headings, as LivingWriter does);
  - have the AI propose draft content for each of D1–D21 with source quotes and chapter references;
  - show a review screen grouped by document, with accept, edit or discard per proposed item.
- Imported documents should enter as *drafts*, never as approved, so the normal checklist and approval gate still applies. Missing material should appear as an explicit "not found in manuscript" state, not as filler, in line with "no silent fallbacks".
- Scene-level detection (Novelcrafter) is too slow for a whole manuscript. Batch extraction with a progress indicator and a resumable review queue is the gap to fill.

### Gaps
- No primary sources were found for Atticus, Scrivener, Dabble or Marlowe import-mapping UX, or for PDF-specific import handling in writing tools.
- No research was found on how authors react to AI-extracted summaries of their own manuscript (trust and accuracy perceptions).
