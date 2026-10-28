# UX patterns for human–AI co-writing that keep the human as author

Research date: 2026-10-27. About 20 tool calls (search plus fetch). Most product details come from vendor pages and help centers. Items marked "[prior knowledge, unverified]" come from the researcher's training knowledge (cutoff mid-2026), not from a source fetched this session. Treat them as hypotheses to check.

## 1. How products present suggestions (inline, side panel, diff, cards) and how authors accept, reject and compare them

### Takeaway
By 2025–2026 mainstream editors (Google Docs Gemini, Word Copilot, ChatGPT Canvas, Lex) have converged on one model: an AI edit is a reviewable proposal (tracked change, highlight or comment) that the user accepts or rejects. Fiction tools (Sudowrite, Novelcrafter) are generator-first, and their trust comes from a structured story knowledge base (Story Bible, Codex) that the AI is grounded in. A redline, or a comment anchored to a fragment, is now the expected interaction, not a novelty.

### Cited Findings
- **Google Docs + Gemini:** The "Refine" button in the floating toolbar offers Rephrase, Shorten and More Formal. Suggestions are reported to appear as tracked changes and are not applied until approved. — [TechRepublic](https://www.techrepublic.com/article/news-how-to-use-gemini-google-docs/) (secondary source)
- **Microsoft Word + Copilot:** Copilot reportedly supports track changes and margin comments natively, so it edits text and explains each change in the margin. This was in preview (Frontier / Insiders Beta on Windows desktop; the two reports disagree on the channel). — [Collab365](https://spaces.collab365.com/posts/microsoft-adds-track-changes-to-copilot-in-word-eKAB39); [Collab365 (2)](https://spaces.collab365.com/posts/microsoft-word-integrates-copilot-with-track-chang-e7Bf9r). The Microsoft roadmap lists a Copilot Chat "Word agent mode", which edits from chat with in-canvas controls to review changes, as in development. — [M365 roadmap via mc.merill.net](https://mc.merill.net/message/RM543241)
- **ChatGPT Canvas:**
  - "Suggest edits" places inline suggestions as comment bubbles anchored to text.
  - The user can edit the flagged text and close the comment, or press "Apply" and have the AI write the fix.
  - "Show changes" shows additions and deletions between versions.
  - Version arrows let the user move back and forth through versions.
  - [OpenAI Help Center](https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt); [DataCamp](https://www.datacamp.com/blog/chatgpt-canvas)
- **Lex:**
  - "Checks" are line edits for brevity, grammar, readability and more. The user picks which checks to run, and the issues appear as pink highlights in the document.
  - A reviewer described Checks as deeper than Grammarly but "not in your face all the time".
  - "Ask Lex" works on a highlighted passage or in chat.
  - The user can tag the AI inside a comment thread to get feedback or a revision.
  - Other features: style guides, knowledge bases, a prompt library, and "Rewind" version history.
  - [Lex homepage](https://lex.page/); [Lex FAQ](https://lex.page/faq); [Lex comments announcement](https://buttondown.com/lex/archive/new-in-lex-comments-ai-rewrite); [Anthropic customer story](https://anthropic.com/customers/lex); [AI Goes to College review](https://aigoestocollege.substack.com/p/quick-review-of-lexpage)
- **Sudowrite (Sep 2026 blog):**
  - Write, Draft, Expand and Chat consult the Story Bible before generating; Brainstorm does not.
  - Canvas is a visual planning whiteboard with four templates: Hero's Journey, Hollywood Beats, Story Circle and Romance Outline.
  - Muse is Sudowrite's own fiction-trained model and the default for Draft. Models from OpenAI, Anthropic, Google and others are also available.
  - "Chapter Continuity" links up to 25 chapter documents so the AI keeps context across them.
  - [Sudowrite, How Sudowrite Works (updated 2026-09-03)](https://sudowrite.com/blog/how-sudowrite-works/)
- **Sudowrite feature descriptions (third-party reviews):**
  - Write "generates the next 300 words in your voice".
  - Describe produces sensory details (sight, sound, smell, touch) and metaphors from a short prompt, such as a single word.
  - The Story Bible holds genre, style, synopsis, characters and worldbuilding.
  - [eesel review](https://www.eesel.ai/blog/sudowrite-review); [Reedsy](https://blog.reedsy.com/guide/book-writing-software/sudowrite)
- **Novelcrafter:**
  - Mentioning a Codex entry's name or alias in chat pulls the whole entry into the AI's context. Nested references come along with it.
  - The user can also add an entry to the context by hand.
  - Each entry's "Tracking" tab controls whether and when it is included.
  - Codex categories are for human organization only and are not sent to the AI.
  - [Novelcrafter docs: codex tracking](https://www.novelcrafter.com/help/docs/codex/codex-tracking); [chat interface](https://novelcrafter.com/help/docs/chat/the-chat-interface) (last updated Nov 2024, older); [course: codex and chat](https://www.novelcrafter.com/courses/ultimate-beginners-guide/codex-and-chat)
- **Grammarly Authorship:**
  - Labels text as human-written, AI-generated, AI-modified, AI-edited or pasted.
  - Replays the writing process keystroke by keystroke, with markers.
  - Works in Word, Google Docs and the Grammarly editor.
  - Is positioned against AI detectors, which "don't keep track of document history".
  - [Grammarly Authorship](https://grammarly.com/authorship); [Grammarly launch blog](https://www.grammarly.com/blog/company/grammarly-launches-grammarly-authorship/); [BusinessWire, Aug 2024](https://www.businesswire.com/news/home/20240814851435/en)
- **Shape of AI pattern library (Emily Campbell)**, relevant pattern names:
  - Inline action
  - Inpainting (regenerate only a targeted area)
  - Regenerate
  - Restyle
  - Variations (compare several results)
  - Branches (iterate while keeping the link to the original)
  - Citations
  - References (show and manage the sources the AI uses)
  - Action plan (show the steps before running them)
  - Verification (confirm before proceeding)
  - Controls (pause mid-stream)
  - Memory
  - Footprints (trace the steps from prompt to result)
  - Disclosure (mark AI content)
  - Watermark
  - Caveat
  - Voice and tone, Saved styles
  - Follow up (ask for detail when the prompt is unclear)
  - Templates
  - Color and Iconography as AI identifiers
  - [shapeof.ai](https://www.shapeof.ai/)
- PatternBase builds React components (including shadcn/ui) for 54 patterns from the Shape of AI taxonomy. — [Stackademic](https://blog.stackademic.com/patternbase-54-ai-ux-patterns-for-react-developers-7a26b3707c10)

### Inferences
- The proposal model ("every AI edit is a proposal") matches the industry baseline set by Docs, Word, Canvas and Lex. Authorled's differentiator is not the redline itself. It is (a) the AI never applying a change without an explicit accept, unlike Canvas "Apply", which lets the AI rewrite, and (b) checking against other documents of the project.
- Canvas's "comment first, then Apply" is a useful two-step pattern. The AI flags the problem as a comment, and the author either fixes it by hand or asks for a proposal. That keeps the critique separate from the rewrite.
- Lex's "pick which checks to run" plus unobtrusive highlights is a good model for a consistency check the author starts on demand, rather than an always-on linter.
- Novelcrafter's "mention = context" plus per-entry tracking is the clearest pattern for making AI context visible and editable. It maps well to CopilotKit readable context with chips the user can remove.

### Gaps
- **Sudowrite generated-text UI** [prior knowledge, unverified]: the right-hand history of result cards, the "Insert" action, purple highlighting of AI text that persists until edited, and the heart/keep action. Not confirmed in sources fetched this session.
- **Cursor and GitHub Copilot** [prior knowledge, unverified]: ghost text accepted with Tab, inline red/green diffs with per-hunk Accept/Reject, and Cmd+K inline edit. Not fetched.
- **Notion AI, NovelAI, Type.ai, Wordtune, Claude artifacts:** no sources gathered. Wordtune's side card list of 5–10 rewrites per sentence and NovelAI's colored text by origin (AI vs. user vs. edited) are [prior knowledge, unverified].
- Exact current GA status of Word Copilot track changes and Gemini-in-Docs tracked suggestions was not confirmed from first-party Microsoft or Google docs.

## 2. Multiple-options UX and Socratic/question-first assistants vs. generators

### Takeaway
Pattern libraries name Variations, Branches, Regenerate and Follow up as the main ways to keep the human choosing. HCI evidence suggests that "guided exploration" (the AI offers options) and "structured guidance" (the AI coaches) protect ownership better than "active co-writing" (the AI drafts). Yet creative-writing systems most often use active co-writing.

### Cited Findings
- **Systematic review of 109 HCI papers (2018–2024), 62 systems coded:**
  - Active Co-Writing (AI drafts substantial content): 37.1%
  - Structured Guidance (AI coaches): 30.6%
  - Guided Exploration (AI offers options): 17.7%
  - Critical Feedback (AI evaluates the text): 14.5%
  - Creative-writing systems favor Active Co-Writing (50%), which the authors call the strategy most likely to threaten ownership.
  - [Co-Writing with AI, on Human Terms, arXiv 2504.12488](https://arxiv.org/html/2504.12488v1)
- **Same paper, interviews with 15 writers:** suggestions that can be accepted, rejected or modified preserved ownership; direct insertion or overwriting did not. Writers wanted the final say even on low-stakes tasks. — [arXiv 2504.12488](https://arxiv.org/html/2504.12488v1)
- **Dramatron study (15 theatre professionals):** writers valued the structure-first, hierarchical approach (logline, characters, scenes, dialogue). They treated outputs as "provocations" rather than finished text, and ownership was low. — [the-decoder summary](https://the-decoder.com/ai-language-tools-for-professional-writers-how-useful-are-they/); see also [TombWriter, arXiv 2605.19681](https://arxiv.org/pdf/2605.19681) (2026, beat-level interaction for co-writing; not read in full)
- **Wordcraft (Google, 13 published writers, 8 weeks):** most useful for brainstorming, story details, worldbuilding and research. The AI struggled to keep the author's style and voice and lacked deep understanding of the story. — [Ippolito et al., arXiv 2211.05030](https://arxiv.org/pdf/2211.05030) (2022, older)
- **Longitudinal playwright study (7 months):** writers felt the creative effort remained their own, but most ultimately rejected the tool as unsuitable for real playwriting. — reported via [TombWriter related work, arXiv 2605.19681](https://arxiv.org/pdf/2605.19681) (secondary mention; original paper not fetched)
- **Shape of AI patterns:**
  - "Variations": compare multiple results and pick one.
  - "Branches": iterate while keeping a link to the original.
  - "Follow up": the AI asks for more detail when the prompt is unclear.
  - "Sample response": confirm intent with a sample before complex work.
  - [shapeof.ai](https://www.shapeof.ai/)

### Inferences
- Authorled's "questions + 3–5 options" approach sits in the Guided Exploration and Structured Guidance quadrants. Those are under-served in creative tools and are the quadrants the evidence links to retained ownership. This is a defensible positioning claim.
- Dramatron's "provocations" framing suggests labeling options as options or prompts for thinking ("варианты для размышления"), not as drafts. That lowers the risk that the author pastes AI text wholesale.
- Branches with a link to the original fit "the author closes the document": each option card should keep its source fragment and its question.

### Gaps
- No controlled study found that directly compares "3 options" with "1 suggestion" with "5+ options" for ownership or choice overload in fiction writing.
- No product evidence found on question-first (Socratic) fiction assistants at scale.

## 3. Provenance, authorship marking, citations and consistency/continuity checkers

### Takeaway
Provenance cues work best at the point of decision (for example, gray preview text that turns black only on accept) and as persistent history (Grammarly Authorship's per-sentence origin labels and replay). Commercial fiction "story checkers" (ProWritingAid Manuscript Analysis, AutoCrit, Marlowe) report issues by severity and location. No source confirmed that any of them shows contradictions with verbatim quotes from other documents, which leaves that open for Authorled.

### Cited Findings
- **"Who Owns the Text?" (N=176, within-subjects, GPT-4o one-sentence suggestions capped at 30 tokens, accepted explicitly):**
  - Generic AI suggestions lowered psychological ownership by −1.03 on a 7-point scale (p<.001).
  - Persona coaching lowered it by −0.85 (p<.001).
  - Style personalization from the writer's own sample raised it by +0.43 (p<.01).
  - Cognitive load fell by about 0.9.
  - Writers incorporated about 28–30% of AI text.
  - Proposed patterns: on-demand initiation; micro-suggestions over takeovers; voice anchoring; persona as an audience scaffold rather than an author; provenance cues at the point of decision (gray previews that become black only when accepted).
  - Future work: persistent provenance indicators, a "hold my voice" control, a "rephrase in my voice" action.
  - [arXiv 2601.10236](https://arxiv.org/html/2601.10236v1) (Jan 2026)
- **"Where Do I 'Add the Egg'?" (18 writers):** interface metaphors change where writers expect control to sit. Agentic metaphors make AI conceptual contributions count against the author's ownership. The paper offers a taxonomy of ownership types: stylistic, conceptual and effort-based. — [arXiv 2509.15440](https://arxiv.org/html/2509.15440v1)
- **Glassman Lab, CHI '26:** works on a framework of ownership tailored to creative practice for HCI research. Only fragments were seen; title and findings not confirmed. — [PDF](https://glassmanlab.seas.harvard.edu/papers/ownershipCHI26.pdf)
- **Content- vs. form-focused writers:** content-focused writers want control over planning and ideas. Form-focused (literary) writers want control over sentence-level revision and deliberate style-breaking. Local toggles help them keep intentional stylistic choices the AI might otherwise "correct". Several writers rejected AI being trained on their style. — [arXiv 2504.12488](https://arxiv.org/html/2504.12488v1). Note the tension with the +0.43 personalization result above.
- **Grammarly Authorship:** per-sentence origin labels (human, AI-generated, AI-modified, AI-edited, pasted) and a process replay that can be shared with teachers. — [Grammarly](https://grammarly.com/authorship)
- **ProWritingAid Manuscript Analysis / Story Checker:**
  - Analyzes manuscripts up to 300,000 words, on a credit system.
  - Covers plot holes, continuity (timeline jumps, anachronisms), character consistency, motivation and relationships, worldbuilding inconsistencies, pacing, dialogue and more.
  - Issues are ranked by how critical they are and come with suggested fixes; the page says you can "see exactly where they are".
  - Also lists Chapter Critique and a Virtual Beta Reader.
  - [ProWritingAid Story Checker](https://prowritingaid.com/story-checker)
- **AutoCrit and Marlowe:** AutoCrit is positioned as a fiction-focused studio (vendor source). Marlowe (Authors A.I.) is listed for high-level structural feedback and beta reading, not detailed continuity. — [AutoCrit vs ProWritingAid](https://www.autocrit.com/autocrit-vs-prowritingaid/); [Vox Ghostwriting](https://www.voxghostwriting.com/blog/ai-editing-tools-for-fiction-authors/)
- **Sudowrite "Chapter Continuity":** links up to 25 chapters for cross-chapter context. It is grounding for generation, not an issue report. — [Sudowrite](https://sudowrite.com/blog/how-sudowrite-works/)
- **Shape of AI trust patterns:**
  - "Citations": inline source annotations.
  - "References": show and manage the sources the AI uses.
  - "Footprints": trace from prompt to result.
  - "Disclosure": mark AI content.
  - "Stream of Thought": expose reasoning for auditing.
  - [shapeof.ai](https://www.shapeof.ai/)
- **Microsoft Guidelines for Human-AI Interaction:** 18 guidelines (Amershi et al., CHI 2019), validated with 49 practitioners against 20 products. — [Microsoft Research](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/); [HAX Design Library](https://www.microsoft.com/en-us/haxtoolkit/library/example,guideline/all/63/56/123/). The guideline wording below was not fetched; it is [prior knowledge, unverified] but well known. Most relevant ones:
  - G1: Make clear what the system can do.
  - G2: Make clear how well it can do it.
  - G9: Support efficient correction.
  - G10: Scope services when in doubt.
  - G11: Make clear why the system did what it did.
  - G16: Convey the consequences of user actions.
  - G17: Provide global controls.

### Inferences
- A contradiction card in Authorled should carry three elements:
  1. A verbatim quote with a link to the location in source document A.
  2. A verbatim quote with a link to the location in document B.
  3. The AI's one-line explanation, kept visibly separate from the quotes.

  This applies Citations/References together with HAX G11. Verbatim quotes the author can click are the trust mechanism. Paraphrased issues, the ProWritingAid style as far as the sources show, are weaker.
- Show proposed AI text in a visually distinct preview state (gray, or a suggestion decoration) that becomes normal author text only after an explicit accept. This is the evidence-backed pattern from arXiv 2601.10236.
- A persistent provenance view, Grammarly-style ("which fragments came from accepted AI proposals"), could serve writers as protection against "AI wrote my book" accusations and as evidence for Human Authored-type certification (see section 5). It must stay private to the author by default.
- Style personalization raises ownership in one study, but some literary writers reject training on their style. Make it opt-in.

### Gaps
- No source confirmed a commercial fiction tool that shows contradictions with direct quotes from two locations. This needs hands-on product checks (Novelcrafter, Sudowrite, AutoCrit, Marlowe, ProWritingAid).
- No study found on how confidence indicators affect writers in continuity checking.
- Google PAIR Guidebook content was not fetched ([pair.withgoogle.com/guidebook](https://pair.withgoogle.com/guidebook), URL from prior knowledge).

## 4. Chat vs. embedded actions: where the AI lives and how context is shown and edited

### Takeaway
Current products combine three surfaces:
- a side chat for open-ended work (Lex Ask Lex, Canvas, Novelcrafter chat, Sudowrite Chat);
- selection-anchored inline actions (Gemini Refine floating toolbar, Ask Lex on a highlight, Shape of AI "Inline action");
- comment threads where the AI is a participant (Lex, Canvas Suggest edits, Word Copilot margin comments).

Context visibility is strongest where context comes from explicit, user-curated entries (Novelcrafter Codex mentions and tracking, Sudowrite Story Bible).

### Cited Findings
- **Gemini in Docs:** a floating toolbar on the selection ("Refine"). — [TechRepublic](https://www.techrepublic.com/article/news-how-to-use-gemini-google-docs/)
- **Lex:** chat about the whole draft, plus "Ask Lex" on a highlighted passage, plus tagging the AI in comments. — [Lex](https://lex.page/); [Anthropic customer story](https://anthropic.com/customers/lex)
- **Word:** a planned "agent mode" that edits from chat, with review controls in the document canvas. — [mc.merill.net roadmap](https://mc.merill.net/message/RM543241)
- **Novelcrafter:**
  - The AI context can include codex entries, snippets, scene summaries and full scenes.
  - The user controls it by mention, by manual add, and with per-entry tracking rules.
  - Categories stay private to the human.
  - [Novelcrafter tracking docs](https://www.novelcrafter.com/help/docs/codex/codex-tracking); [glossary](https://docs.novelcrafter.com/en/articles/9329937-glossary-of-novelcrafter-terms)
- **Sudowrite:** Brainstorm deliberately does not consult the Story Bible; the drafting tools do. Different tools ground on different context. — [Sudowrite](https://sudowrite.com/blog/how-sudowrite-works/)
- **Writers' toggles:** writers valued global AI toggles for staying in flow, and local toggles to protect intentional style. — [arXiv 2504.12488](https://arxiv.org/html/2504.12488v1)
- **On-demand initiation:** suggestions appear only when the writer asks, as an authorship-preserving pattern. — [arXiv 2601.10236](https://arxiv.org/html/2601.10236v1)
- **Shape of AI patterns:** "Attachments", "References", "Connectors" and "Memory" are the ways to show and edit context. — [shapeof.ai](https://www.shapeof.ai/)

### Inferences
- For Authorled, a reasonable layout is:
  - side chat (CopilotKit) for questions and options;
  - selection-anchored inline actions that always create comments or suggestion decorations, never direct edits;
  - a visible context bar in chat listing which documents and fragments are in context, removable like Novelcrafter mentions.
- Default to no unsolicited AI (on-demand initiation), with a global "ИИ молчит" toggle.

### Gaps
- No usage data found comparing chat, inline and comment surfaces for fiction writers.
- CopilotKit/AG-UI specifics are outside this note's scope.

## 5. Writer community attitudes toward AI (2024–2026) and what triggers backlash

### Takeaway
Backlash concentrates on generation that replaces authorship and on institutions that appear to endorse it. The NaNoWriMo 2024 statement led to board resignations and lost sponsors, and the nonprofit shut down in 2025. The Authors Guild's "Human Authored" certification (expanded to all US authors in 2026) draws the accepted line explicitly: AI for spelling and grammar, research, brainstorming and outlining is allowed; AI-written text is not.

### Cited Findings
- **NaNoWriMo statement (Sep 2024):**
  - NaNoWriMo said it neither condemned nor endorsed AI and suggested that blanket opposition ignored "classist and ableist issues".
  - Board members resigned, and sponsor Ellipsus withdrew.
  - Critics linked the stance to NaNoWriMo's sponsorship by ProWritingAid.
  - [CBC](https://www.cbc.ca/lite/story/1.7314090); [Plagiarism Today](https://www.plagiarismtoday.com/2024/09/04/nanowrimos-massive-ai-blunder)
- **NaNoWriMo shutdown (2025):** the nonprofit closed after turmoil that included AI and moderation disputes plus financial problems. The organization said these controversies were not the direct cause. — [Publishers Weekly, Apr 2025](https://publishersweekly.com/pw/print/20250407/97466-nanowrimo-nonprofit-shutters.html)
- **Authors Guild "Human Authored" certification:**
  - Open to all authors published in the US: $10 per title, free for members, with identity verification and a license agreement.
  - A work qualifies if the text was written by humans. AI spelling and grammar tools are an explicit exception, and AI use for research, brainstorming, outlining, tables of contents and indexes does not disqualify a title.
  - More than 3,000 authors had certified about 5,000 titles. Another source gives over 6,000 writers, so the figures conflict.
  - Critics note it is an honor system.
  - [Authors Guild](https://authorsguild.org/news/human-authored-certification-expands-to-all-authors/); [Publishers Weekly, Mar 2026](https://www.publishersweekly.com/pw/print/20260309/99836-authors-guild-opens-human-authored-certification-to-all-u-s-authors-and-publishers.html); [Poets & Writers](https://www.pw.org/content/the_authors_guild_confronts_ai)
- **Unfiltered model:** Sudowrite's own blog says its Muse model is "unfiltered" and fiction-trained. It is a generator-first product positioning. — [Sudowrite](https://sudowrite.com/blog/how-sudowrite-works/)

### Inferences
- The Authors Guild line (AI may help think, research, outline and fix grammar, but must not write the text) closely matches Authorled's rule, "AI helps go through a document; the author closes it". Authorled could say explicitly in its positioning that its workflow stays inside these criteria, and could offer the author an exportable record of which accepted proposals were AI-originated.
- Backlash triggers to avoid:
  - "Write the next 300 words" defaults.
  - Implied endorsement of AI-authored books.
  - Opaque training on writers' text.
  - Dismissive framing of AI critics.

### Gaps
- No Reddit or community sentiment data was gathered this session (r/writing, r/screenwriting, r/fantasywriters rules on AI posts). Prior knowledge suggests many writing subreddits ban AI-generated content [unverified].
- WGA 2023 contract AI provisions (relevant for screenwriters) were not researched this session [prior knowledge: AI cannot be credited as a writer, and AI-generated material is not "literary material"; unverified here].
- No Russian-language writer community data was gathered.
