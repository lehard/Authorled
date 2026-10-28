# Visual language and design system for a long-form writing product (shadcn/ui + Tailwind v4, Russian UI)

Scope note: research done 2026-10-27 with a limited budget (~18 tool calls). Items marked "[prior knowledge]" come from the researcher's training data (cutoff mid-2026) and were NOT re-verified by a fetched source in this session; the report writer should treat them as plausible but unconfirmed and keep them out of hard claims unless verified.

## 1. Visual identity of respected writing/reading products

### Takeaway
The respected writing tools converge on: one reading column of roughly 60–75 characters, generous line height, typography as the main brand element (iA Writer built its whole identity on custom fonts), minimal chrome that recedes during writing, and light/dark (often sepia) reading modes. Exact per-product measures are mostly undocumented by vendors.

### Cited Findings
- iA Writer's Mono, Duo and Quattro fonts were built on IBM Plex; iA later removed IBM-typical features and unified the family (square dots, reworked curves) — [MacStories, iA Writer 5.2](https://www.macstories.net/ios/ia-writer-5-2-better-typography-and-external-library-locations/); [iA: A Typographic Christmas](https://ia.net/topics/a-typographic-christmas)
- iA's newer variable fonts adjust weight by size, device and background colour, and adjust line height/spacing depending on column width and type size — [iA blog](https://ia.net/topics/a-typographic-christmas)
- iA Writer for Mac scales font size with window width, keeping typographic proportions instead of reflowing text ("responsive" text editor) — [iA: Bringing responsiveness to the app world](https://ia.net/topics/bringing-responsiveness-the-app-world)
- iA Mono's equal-width rhythm and wide word spacing deliberately give drafts an "unfinished" look (draft vs. finished text as a visual signal) — [MacStories](https://www.macstories.net/ios/ia-writer-5-2-better-typography-and-external-library-locations/); [Fontsource iA Writer Mono](https://fontsource.org/fonts/ia-writer-mono/about)
- Printed-text consensus: 45–75 characters per line, ideal ~66 cpl; narrower fonts → shorter lines — [Wikipedia: Line length](https://en.wikipedia.org/wiki/Line_length)

### Inferences
- [prior knowledge] Notion, Craft, Bear, Ulysses and Medium all use a single centred text column (~650–750 px at 16–21 px body), sans or serif body with line-height ~1.5–1.7, and hide sidebars/toolbars while typing ("focus"/"typewriter" modes in iA Writer and Ulysses). Medium/Substack use serif body text for reading; Notion and Linear use neutral sans UI with low-chroma greys. Readwise Reader and Kindle offer light/sepia/dark themes and user-adjustable font, size, line spacing and width.
- [prior knowledge] Screenwriting tools (Highland, Arc Studio, Final Draft) use Courier-family mono on a page-shaped canvas, because page count ≈ screen time; prose tools use a flowing column without pages.
- Recommendation for Authorled: two distinct "surfaces" — (a) calm app chrome (neutral sans, low-chroma warm-neutral greys, Linear-like density) and (b) a "paper" editor column with serif text, max-width ~65ch (`max-w-[65ch]`), line-height 1.6–1.7, user-selectable themes Light / Sepia / Dark. Treat the editor typography as the brand, as iA does.
- Use iA's draft-vs-final idea: visually distinguish stage status (e.g. draft text slightly different texture) — but only as a secondary cue.

### Gaps
- No vendor-published measure/line-height values found for Ulysses, Bear, Craft, Notion, Medium, Substack, Reedsy, Arc Studio, Highland, Readwise Reader, Kindle in this session. Needs direct inspection (DevTools on web apps) if exact numbers are wanted.

## 2. Cyrillic typography for long text

### Takeaway
Strong free (OFL) Cyrillic options exist: Literata (variable, optical size, award-winning Cyrillic) for the reading/writing serif; Golos (Paratype, OFL) or Inter/Onest for UI; Courier-family mono for screenplays. Russian rules («ёлочки», „лапки“, nbsp, em dash) need an automatic typographer layer; `hyphens: auto` requires `lang="ru"` and a browser dictionary, and Chrome support for Russian is uncertain — test.

### Cited Findings
- Literata 3 was rebuilt as a variable font; two files (roman, italic); supports Greek, Cyrillic, PinYin, Vietnamese; aim: comfortably read a full novel on any screen and size — [TypeTogether Literata](https://www.type-together.com/literata)
- Literata Cyrillic by Vera Evstafieva and Elena Novoselova; won Modern Cyrillic 2021 and GOLD Indigo Awards 2021 — [Google Fonts: Literata about](https://fonts.google.com/specimen/Literata/about)
- Fontsource variable build has `opsz` and `wght` axes; licence OFL — [Fontsource Literata](https://fontsource.org/fonts/literata/about); [googlefonts/literata](https://github.com/googlefonts/literata)
- Golos (Golos Text / Golos UI) released by Paratype in 2019 under SIL OFL 1.1, designers Alexandra Korolkova and Vitaly Kuzmin, full Cyrillic — [googlefonts/golos-text](https://github.com/googlefonts/golos-text); [Pimp my Type: Golos](https://pimpmytype.com/font/golos/); [RightFont: Golos Text](https://rightfontapp.com/family/golos+text)
- Onest is listed as free with Cyrillic support, designed by Dmitri Voloshin; licence type not confirmed by the found sources — [Pimp my Type](https://pimpmytype.com/?p=12116)
- PT fonts (PT Sans/Serif/Mono) are distributed by Paratype as free fonts (packaged in Linux repos) — [SlackBuilds ttf-paratype-pt-fonts](https://slackbuilds.org/repository/15.0/system/ttf-paratype-pt-fonts/)
- `hyphens: auto` only works when `lang` is set and the browser has a dictionary for that language; property is Baseline since Sept 2023 — [MDN hyphens](https://developer.mozilla.org/en-US/docs/Web/CSS/hyphens)
- Chrome implemented `hyphens` from v55 — [Chrome Developers blog](https://developer.chrome.com/blog/css-hyphens?hl=ru); a Vivaldi/Chromium-111 forum thread reports no Russian hyphenation dictionary on desktop Chromium — [Vivaldi forum](https://forum.vivaldi.net/topic/82881/no-russian-hyphen-data); Habr Q&A reports differ — [qna.habr.com](https://qna.habr.com/q/1338170). Conflicting, likely version-dependent.
- Russian quotation rules: primary «ёлочки», nested „лапки“ (e.g. «Он сказал: „Поехали!“»); period/comma/colon/dash go after the closing quote — [ИВГПУ правила типографики (PDF)](https://ivgpu.ru/images/docs/sotrudniku/rabota-s-sajtom/pravila-tipografiki.pdf); [Sostav blog](https://www.sostav.ru/blogs/261637/35460)
- Russian screenplay format: Courier New 12 pt commonly named as standard in Russia, A4 paper, margins ~2.5 cm (vary), 1 page ≈ 1 minute of screen time, page numbers from page 2 top-right without a dot — [TechInsider](https://www.techinsider.ru/popmem/1690225-kak-pravilno-pisat-i-oformlyat-scenarii-uznaite-glavnye-pravila-v-istoriyah-gollivuda/); [Dzen article](https://dzen.ru/a/aCIinx8AugyhGFcE). US sources: Courier 12 is the standard; some advise against Courier New because it changes page count — [StudioBinder](https://www.studiobinder.com/blog/screenplay-font/); [Industrial Scripts](https://industrialscripts.com/?p=224102)

### Inferences
- Recommended stack: editor serif **Literata** (opsz axis lets one family serve body and headings); UI sans **Golos UI/Text** (Russian-made, OFL, designed for interfaces) or **Inter** [prior knowledge: Inter has full Cyrillic, OFL]; screenplay mono **a Courier-metric font with Cyrillic** — [prior knowledge] Courier Prime has Cyrillic in later versions (verify) and PT Mono is an OFL Cyrillic mono; but page-count fidelity requires Courier-metric widths (10 cpi), so pick one with 600-unit advance like Courier and lock it.
- Self-host fonts via Fontsource (`@fontsource-variable/literata`) rather than Google Fonts CDN — better privacy/latency for a Russian audience [inference].
- Implement typography as a server/editor-side "типограф" (replace straight quotes with «», nested „“, `--`/` - ` with em dash with nbsp before it, nbsp after short prepositions/conjunctions, nbsp in initials «А. С. Пушкин», numbers+units). [prior knowledge] Bureau Gorbunov's «Ководство» and Artemy Lebedev's typograph cover these rules; also the "Типографика и вёрстка" Habr article ([habr.com/p/277933](https://habr.com/p/277933)) was surfaced but not read.
- Hyphenation: set `<html lang="ru">`, use `hyphens: auto` with `hyphenate-limit-chars: 6 3 3` [prior knowledge, verify support]; since Chrome Russian dictionary is uncertain, test on Chrome/Firefox/Safari, and do NOT add a silent JS hyphenation fallback without a product decision (project rule: no fallbacks). Left-aligned ragged text is safer than justified on screen.
- Screenplay mode should render on an A4 page model with fixed margins so "1 page ≈ 1 minute" holds; offer export settings matching Russian norms (A4, Courier New 12).

### Gaps
- Bureau Gorbunov «Ководство» content not retrieved (searched; not found by search engine). Exact nbsp/dash rules uncited.
- Onest licence and Courier Prime Cyrillic coverage not verified.
- Current Chrome/Safari Russian hyphenation status (late 2026) not verified; MDN compat table unread.

## 3. Design tokens and theming for shadcn/ui on Tailwind v4

### Takeaway
shadcn/ui's model is: semantic CSS variables in OKLCH on `:root` and `.dark`, mapped to Tailwind utilities with `@theme inline`; extend by adding new semantic pairs (`--status-approved`, `--status-approved-foreground`, …) the same way, and distribute the whole system (tokens, fonts, components, rules) via a shadcn registry. Use tweakcn/Radix scales to generate palettes.

### Cited Findings
- Default shadcn token set: `--background/--foreground`, `--card(-foreground)`, `--popover(-foreground)`, `--primary/--secondary/--muted/--accent` (+ `-foreground`), `--destructive`, `--border`, `--input`, `--ring`, `--chart-1..5`, `--sidebar`, `--sidebar-foreground/-primary/-primary-foreground/-accent/-accent-foreground/-border/-ring`, `--radius`; values in OKLCH (e.g. `oklch(0.205 0 0)`) — [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- Base colours available: Neutral, Stone, Zinc, Mauve, Olive, Mist, Taupe (`tailwind.baseColor`) — [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- `@theme inline` maps `--color-background: var(--background)` etc.; radius scale `--radius-sm`…`--radius-4xl` derived from `--radius` (default 0.625rem) — [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- New colour: define var under `:root` and `.dark`, expose as `--color-warning` in `@theme inline` → `bg-warning`, `text-warning-foreground` — [shadcn/ui Theming](https://ui.shadcn.com/docs/theming); [ui-v4.shadcn.com theming](https://ui-v4.shadcn.com/docs/theming)
- Dark-mode flash: set `.dark` class via inline head script before first paint — [21st.dev](https://21st.dev/blog/shadcn-theming-css-variables)
- OKLCH is perceptually uniform: same lightness value means same perceived lightness across hues, so palettes can rotate hue at fixed L/C — [21st.dev](https://21st.dev/blog/shadcn-theming-css-variables)
- `registry.json` is the registry entry point; items follow registry-item schema (name, type, files, dependencies, `cssVars`); registries can ship components, hooks, tokens, fonts, whole design systems, conventions and AI-agent instructions; built with `shadcn build` to `public/r/[name].json`; consumers add a namespace in `components.json` and run `npx shadcn@latest add @acme/header` — [shadcn registry-item.json](https://ui.shadcn.com/docs/registry/registry-item-json); [v0 Design systems](https://logo.v0.build/docs/design-systems); [mew.is-a.dev](https://mew.is-a.dev/articles/shadcn-registry-a-better-way-to-manage-your-ui-components)
- A registry can feed v0 so generated prototypes match the system — [v0 Design systems](https://logo.v0.build/docs/design-systems)
- tweakcn: visual theme editor for shadcn/ui and Tailwind (v3 and v4), outputs CSS — [bestofjs tweakcn](https://bestofjs.org/projects/tweakcn); community theme picker with 43+ OKLCH themes incl. fonts and light/dark — [tweakcn theme picker](https://www.mintlify.com/BankkRoll/tweakcn-theme-picker)
- Radix Colors 12-step roles: 1–2 app/subtle backgrounds, 3–5 component backgrounds (rest/hover/selected), 6–8 borders/focus rings, 9–10 solid fills, 11 low-contrast text, 12 high-contrast text; step 9 designed for white text — [Radix Colors (pub.dev mirror)](https://pub.dev/documentation/radix_colors/latest/); [Radix Themes color](https://radix-ui.com/themes/docs/theme/color)
- Supabase publishes colour-usage guidance for its shadcn-based system — [Supabase design system: color usage](https://supabase.com/design-system/docs/color-usage)
- Vercel AI Elements: shadcn/ui-based component library for AI interfaces (conversation, message, reasoning, code block, prompt input…), installs via its CLI or shadcn CLI, requires Tailwind CSS-variables mode; UI layer for AI SDK `useChat` — [Vercel blog: Introducing AI Elements](https://vercel.com/blog/introducing-ai-elements); [LogRocket](https://blog.logrocket.com/vercel-ai-elements/). Component count varies by source (12 vs 48) — [21st.dev](https://21st.dev/@vercel/library/ai-elements)
- prompt-kit (Julien Thibeaut / ibelick): shadcn-based AI components incl. Prompt Input, Markdown, Response Stream, Prompt Suggestion — [21st.dev prompt-kit](https://21st.dev/@ibelick/library/prompt-kit.md)

### Inferences
- Token architecture for Authorled (three layers): (1) primitive scales in OKLCH (Radix-style 12 steps for neutral-warm, accent, and each status hue); (2) shadcn semantic tokens (keep names intact so all shadcn/registry components work); (3) product semantic tokens: `--paper`, `--paper-foreground`, `--editor-measure`, `--status-{draft|in-progress|approved|revision|conflict}` (+ `-foreground`, `-subtle`, `-border`), `--deco-{ai|suggestion-insert|suggestion-delete|comment|conflict}`, `--ai`, `--ai-foreground`.
- Themes: `.light`, `.dark`, `.sepia` (editor-only or app-wide) as separate selectors redefining the same tokens; a `data-theme` attribute scales better than a single `.dark` class once there are 3+ themes. Pick Stone/Taupe/Olive base for warm-neutral calm (vs. Zinc's cool grey).
- Since CopilotKit is decided, AI Elements/prompt-kit are reference designs for message/suggestion/reasoning patterns, not necessarily dependencies; [prior knowledge] assistant-ui is another shadcn-styled chat primitive library (Radix-like composable primitives) — not verified in this session.
- Distribute the Authorled system as a private shadcn registry (tokens as `registry:theme`/`cssVars`, fonts, editor decoration styles, status badge, AI label) — lets future apps and AI coding agents pull consistent components.

### Gaps
- Did not fetch Vercel Geist, Origin UI, Kibo UI or assistant-ui pages; their specifics are not cited.
- tweakcn official docs (export formats) not read.

## 4. Status/semantic colours for workflow states and editor decorations

### Takeaway
Use colour + icon + text label for every status (never colour alone), mark AI-originated content with a dedicated, consistent "AI" signal that also opens an explanation (Carbon's AI label pattern), and pick hues distinguishable under common colour-vision deficiencies.

### Cited Findings
- Carbon for AI: an extension giving AI features a distinct visual identity; styling should identify AI usage, not decorate; uses a light-based "glow" to highlight AI-generated/recommended content — [Carbon for AI](https://carbondesignsystem.com/guidelines/carbon-for-ai/)
- Carbon AI label (formerly "AI slug") marks every place AI is involved and is the trigger for an explainability popover; default and inline variants — [Carbon AI label usage](https://carbondesignsystem.com/components/ai-label/usage/)
- AI label accessibility: keyboard-focusable; Enter/Space toggles popover; Esc closes and returns focus — [Carbon AI label accessibility](https://carbondesignsystem.com/components/ai-label/accessibility/)
- Third-party review: Carbon's AI glow is blue with gradient; 12 components have AI variants — [AI First Designer](https://adplist.substack.com/p/how-to-design-clear-ai-interactions)
- Survey of AI guidelines across design systems — [Supernova: Top 6 examples of AI guidelines](https://www.supernova.io/blog/top-6-examples-of-ai-guidelines-in-design-systems)
- WCAG 2.2 adds 2.4.11 Focus Not Obscured (AA), 2.5.7 Dragging Movements (AA), 2.5.8 Target Size 24×24 (AA), 3.2.6 Consistent Help (A), 3.3.7 Redundant Entry (A), 3.3.8 Accessible Authentication (AA), plus AAA 2.4.12/2.4.13/3.3.9; 4.1.1 Parsing removed — [W3C: What's new in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)

### Inferences
- Proposed status mapping (hue + icon + label + shape):
  - Черновик (draft): neutral grey, dashed outline / empty circle icon.
  - В работе (in progress): blue, half-filled circle.
  - Утверждено (approved): green (shift toward teal for deuteranopia separation from red), check icon.
  - Нужна доработка (needs revision): amber, pencil/return icon.
  - Противоречие (contradiction): red/magenta, warning triangle; should also appear in a list/panel, not only inline.
  Red vs. green pairs are the classic CVD failure, hence shape/icon redundancy is mandatory (WCAG 1.4.1 Use of Color [prior knowledge]).
- Editor decorations: insertions = underline + tint; deletions = strikethrough + tint; comments = background highlight + margin marker; AI-originated text = distinct AI hue (avoid using same hue as "in progress" blue if Carbon-style blue is chosen) + left margin bar or subtle dotted underline + AI label that opens provenance popover; conflicts = wavy underline (like spellcheck) + icon in gutter. Text styles (underline/strike/wavy) carry meaning without colour.
- Decoration tints must keep body text ≥4.5:1 contrast on the tinted background in all three themes (Light/Sepia/Dark) — define `-subtle` decoration tokens per theme, not alpha overlays alone.
- WCAG 2.2 relevance: 2.4.11 — sticky toolbars/chat panel must not cover the focused caret/element; 2.5.8 — 24px minimum for inline decoration hit-targets (accept/reject buttons); 2.5.7 — any drag-reorder of stages/blocks needs a non-drag alternative.

### Gaps
- No colour-blindness simulation data or specific palette values verified; Primer/Atlassian status-colour docs not fetched.

## 5. Reference design systems, documentation tooling, governance

### Takeaway
Gravity UI (Yandex, MIT, React) is the closest Russian-language reference: fixed named type scale, light/dark plus contrast themes, CSS-variable overrides. Carbon for AI is the best AI-labelling reference. For a small team: Storybook (or lighter Ladle) on top of the shadcn registry, with tokens as the single source of truth.

### Cited Findings
- Gravity UI: Yandex Cloud open-sourced it; `@gravity-ui/uikit` React library, MIT; themes light, dark and their contrast variants via `ThemeProvider` — [Habr (Yandex Cloud)](https://habr.com/en/companies/yandex_cloud_and_infra/articles/773870); [Yarn @gravity-ui/uikit](https://classic.yarnpkg.com/en/package/@gravity-ui/uikit)
- Gravity UI typography: fixed variants display-1..4, header-1..2, subheader-1..3, body-1/2/3/body-short, caption-1/2, code-1..3, code-inline-1..3; exposed as `--g-text-{variant}-font-size/-line-height`, weights per group; render via `Text` component, not raw tags; override on `.g-root` — [Gravity UI typography guide](https://cdn.jsdelivr.net/npm/@gravity-ui/uikit@7.46.0/build/docs/guides/typography.md)

### Inferences
- Take from Gravity UI: contrast theme variants (useful for long sessions and low vision), named type-scale variants (`text-body`, `text-caption`) instead of raw Tailwind sizes, Russian-native product context.
- Take from Carbon for AI: AI label + explainability popover pattern. From Primer/Atlassian [prior knowledge]: status "Label"/"Lozenge" component with subtle/bold variants and explicit content-design (voice and tone) guidance. From Material 3 [prior knowledge]: tonal palettes and motion easing tokens. From Apple HIG [prior knowledge]: reduced motion and dynamic type respect.
- [prior knowledge] Storybook 8/9 supports Tailwind/shadcn and addon-a11y (axe); Ladle is a lighter Vite-based alternative with Storybook-compatible stories. For a small team, one stories file per product component (status badge, AI label, decorations, editor themes) plus a tokens page is enough; registry is the distribution unit.
- Governance for small team: tokens in one CSS file, changes only via PR with visual review; lint rule forbidding raw colour utilities (e.g. `bg-red-500`) in product code so only semantic tokens are used.

### Gaps
- Gravity UI default font sizes/fonts not retrieved (docs page lists variables only). Atlassian, Primer, Material 3, Apple HIG, Storybook, Ladle pages not fetched in this session.

## 6. Motion, density, calm technology, accessibility, Russian microcopy

### Takeaway
Calm, text-focused tools keep motion minimal and functional, chrome low-density around the editor and denser in management views, honour reduced-motion and WCAG 2.2 AA; Russian microcopy should be respectful, plain and writer-oriented. Little of this was source-verified in this session.

### Cited Findings
- WCAG 2.2 new AA criteria relevant to an editor with side panels: Focus Not Obscured, Target Size (24×24), Dragging Movements — [W3C](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- iA's approach: text proportions preserved by scaling, not reflowing, as window changes (stability over motion) — [iA](https://ia.net/topics/bringing-responsiveness-the-app-world)

### Inferences
- [prior knowledge] Calm technology principles (Amber Case): technology should require minimal attention, inform without overburdening, live in the periphery. Apply: AI suggestions appear as quiet decorations, never modal; chat panel collapsible; notifications batched.
- Motion: 150–200 ms ease-out for UI transitions, no motion on text in the editor column; respect `prefers-reduced-motion` (Tailwind `motion-safe:`/`motion-reduce:`). Streaming AI text should not move the user's caret or scroll position.
- Density: two density levels via tokens (`--density` spacing scale) — comfortable for editor, compact for stage lists/tables.
- Russian microcopy: use «вы» (lower-case in UI) consistently; verbs in infinitive for buttons («Сохранить», «Принять правку»); avoid anglicisms where Russian is natural («предложение ИИ», not «саджест»); typographic rules apply to UI strings too (« », —, nbsp); plural forms via ICU `plural` (one/few/many/other) — Russian needs three forms [prior knowledge]; error messages say what happened and what to do, without blaming the author.

### Gaps
- NN/g articles, Russian UX-writing guides (e.g. Yandex/Tinkoff/«Пиши, сокращай»), and calm-technology primary sources were not fetched; all items in Inferences for this section are unverified.
