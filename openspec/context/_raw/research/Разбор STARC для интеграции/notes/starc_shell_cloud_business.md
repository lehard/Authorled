# STARC (Story Architect): app shell, cloud and collaboration, pricing, company and market

Research date: 2026-10-27. All pages were fetched on that date unless noted. STARC's own pages are vendor marketing, so their claims are not independently verified.

## Platforms, tech stack, onboarding, project list, navigator, settings, themes, languages

### Takeaway
STARC is a native desktop app built in C++/Qt for Windows, macOS and Linux, plus a younger Flutter mobile app for iOS, iPadOS and Android (v0.2.x). It has no web version. The shell has three parts: a start screen of project thumbnails, a "+ Create story" dialog (type, name, local or cloud, import) and a two-pane project window with a hierarchical navigator on the left and the workspace on the right.

### Cited Findings
- The site markets STARC as an "All-in-One Screenwriting App for Mac, Windows and iPhone". It shows the counters "5 platforms", "22,587 authors" and "63 releases", and its footer reads "Copyright © 2020-2026 Story Apps" — [starc.app](https://starc.app/)
- **Desktop downloads, v0.8.3:**
  - macOS: a Universal .dmg and a Qt5 build for macOS 10.13+. The page gives conflicting minimums, "macOS 13+" and "High Sierra 10.13".
  - Windows: Microsoft Store and a Win10+ .exe, plus Qt5 installers for Win7+ (32- and 64-bit) and a portable .zip.
  - Linux: AppImage, Flathub (`dev.storyapps.starc`) and AUR.
  - Unstable dev builds for all three systems.
  - Source: [starc.app/download](https://starc.app/download/)
- **Mobile, v0.2.0:** iOS/iPadOS 13+ ([App Store id6743486540](https://apps.apple.com/us/app/story-architect-mobile/id6743486540)) and Android 5.0+ ([Google Play dev.storyapps.story_architect](https://play.google.com/store/apps/details?id=dev.storyapps.story_architect)) — [starc.app/download](https://starc.app/download/)
- The help index has an article titled "How to install Story Architect on Windows, macOS, Linux, and ChromeOS". ChromeOS presumably runs it through the Linux build. The index also has an article on moving projects between desktop and mobile — [starc.app/help](https://starc.app/help/)
- No web app is listed anywhere on the download page — [starc.app/download](https://starc.app/download/)
- **Tech stack:**
  - Desktop: C++17, Qt (CI tests Qt5 and Qt6), qmake, Qt modules Core/GUI/Widgets/Concurrent/Multimedia/Network/SQL/XML, and Crashpad.
  - License: GPL-3.0.
  - Repository stats: 403 stars, 58 forks, 102 open issues, about 3,471 commits.
  - Some PDF submodules are private: a full recursive submodule update may request private repository access.
  - Source: [GitHub story-apps/starc](https://github.com/story-apps/starc)
- The team page lists a "Flutter developer", which suggests the mobile app is built in Flutter — [old.starc.app/ru/about-us](https://old.starc.app/ru/about-us)
- **Onboarding and first run:**
  - Signing in is optional. You open the burger menu at the top left of the start page, choose "Sign in", enter your email and then the one-time code sent to it. There is no password.
  - Projects can be created without an account.
  - Source: [help/start-writing](https://starc.app/help/start-writing/)
- **Start screen (project list):**
  - Projects appear as thumbnails. Left-clicking a thumbnail opens a menu with "Save to local file" and "Move to the cloud".
  - A cloud or computer icon on each thumbnail shows where the project is stored.
  - Source: [help/cloud-projects](https://starc.app/help/cloud-projects/)
  - The start page also shows the last-edit date. This was KIT Scenarist behaviour, recorded in its rc15 changelog, so it is unconfirmed for STARC — [kitscenarist.ru/history](https://kitscenarist.ru/history.html)
- **Creating a project:**
  - Two entry points: "+ Create story" in the left panel, or a button in the centre of the screen.
  - The dialog has a type drop-down (Screenplay, Comic book, Audio drama, Stageplay, Novel) and a name field.
  - A gear icon reveals the save location (device or cloud) and an import path.
  - Free and Pro save only to the device. Cloud saving needs the cloud tier.
  - Source: [help/start-writing](https://starc.app/help/start-writing/)
- **Project window:**
  - Navigation on the left, workspace on the right.
  - Project home: title, description and a poster generator.
  - The navigator holds the title page, synopsis, treatment and script text. Modules vary by story type.
  - "+ Add Document" at the bottom left adds documents of chosen types.
  - Source: [help/start-writing](https://starc.app/help/start-writing/)
- **Navigator levels:**
  - Level 1 holds project items: project info, locations, characters, series (episodes) and others. They can be reordered by drag-and-drop, and dragging one to the recycle bin deletes it.
  - Level 2 goes inside a document, for example an episode and then its Screenplay.
  - A scene level lists the scenes. Dragging a scene reorders the script text.
  - A top-left menu switches the screenplay view between Text, Cards, Timeline and Script breakdown, and all views stay in sync.
  - Source: [help/navigation](https://starc.app/help/navigation/)
- **Multi-episode projects:** a single project holds series and all their episodes. Screenplays, comics, plays and books share one project bible of characters, locations and worlds — [starc.app](https://starc.app/); [help/create-a-series-project](https://starc.app/help/)
- **Appearance and customisation:**
  - Dark, light and custom themes, plus a themes gallery.
  - Typewriter sounds, typewriter scrolling and full screen.
  - Interface and content scaling.
  - A document templates library and custom templates.
  - Scene isolation (focus) mode and review mode.
  - Sources: [starc.app](https://starc.app/); [help index](https://starc.app/help/)
- **Languages:**
  - The website is in English and Russian.
  - The app UI is translated through Transifex into "dozens" of languages, with RTL support.
  - KIT's changelog records Danish, Belarusian, Khmer, Croatian and Arabic translations.
  - The AI assistant works in any language.
  - Sources: [GitHub README](https://github.com/story-apps/starc); [kitscenarist.ru/history](https://kitscenarist.ru/history.html); [starc.app](https://starc.app/)

### Inferences
- Because the desktop app is native Qt/C++ and there is no web client, integrating with an Authorled web service would most likely go through files (.starc, FDX, Fountain, DOCX) or through STARC Cloud, not through embedding.
- The STARC shell maps cleanly onto Authorled concepts:
  - a start screen of story thumbnails,
  - a typed project-creation dialog,
  - one project bible shared across many documents,
  - a navigator tree with "+ Add document",
  - several synchronized views of the same text.

### Gaps
- The documentation has no settings screen description (only scaling and themes are covered), no accessibility features (screen reader support, keyboard-only use) and no first-run tutorial or wizard.
- The full default document set per story type was not found in the help.
- The exact current list of UI languages was not retrieved; Transifex was not checked.

## Import/export, printing, title pages

### Takeaway
STARC imports from KIT Scenarist, Final Draft, Celtx, Trelby, TXT, ODT, DOCX and Fountain. It exports screenplays to DOCX, PDF, FDX and Fountain, with scene selection, review marks, character highlighting and a PDF watermark. The title page is a navigator document. Print UI is not documented.

### Cited Findings
- **Import formats:** KIT Scenarist, Final Draft, Celtx, Trelby, .txt, .odt, .docx and .fountain — [help/screenplay-importing](https://starc.app/help/screenplay-importing/)
- **Two import flows:**
  1. As a new project: "+ Create Story", then the gear icon, then the import path.
  2. Into an existing project: burger menu "Import..." (Alt+I). A dialog lets you choose which parts to load, and the file arrives as a second script inside the same project.
  - Source: [help/screenplay-importing](https://starc.app/help/screenplay-importing/)
- **Export:**
  - Opened from burger menu "Export current document" (Alt+E).
  - Formats: DOCX, PDF, FDX (Final Draft) and Fountain.
  - Options: which parts to export, a scene number range, inclusion of review marks, highlighting of characters and dialogues, and a PDF watermark with text and colour.
  - Source: [help/screenplay-exporting](https://starc.app/help/screenplay-exporting/)
- Separate articles cover novel export and character profile export — [help index](https://starc.app/help/)
- **Title page:** the navigator contains a Title page document next to synopsis, treatment and script — [help/start-writing](https://starc.app/help/start-writing/)
- **Cover and poster:** the movie poster generator and cover generator are included in Free — [help/movie-poster-generator](https://starc.app/help/movie-poster-generator/); [pricing](https://starc.app/pricing)
- **Reports:** text statistics and generated reports — [help/text-statistics](https://starc.app/help/text-statistics/)
- **Mobile:** the iOS app has had export since early versions (v0.2.1 fixed iPadOS export). Users report exporting a PDF to move work to the phone — [App Store](https://apps.apple.com/us/app/story-architect-mobile/id6743486540)

### Inferences
- FDX and Fountain are the natural interchange formats for an Authorled to STARC handoff. The native `.starc` format is an alternative ([fileinfo .starc](https://fileinfo.com/extension/starc)), and its structure could be studied from the GPL source.

### Gaps
- The print dialog and title-page field set are not documented in the help.
- Export of non-screenplay documents (bible, cards) beyond character profiles is not covered.

## Cloud: sync, sharing, co-authoring, roles, comments, web version

### Takeaway
Cloud storage, sync and real-time collaboration belong to the top tier. The current pricing page names that tier "Creator"; older help pages call it "CLOUD". The owner invites collaborators by email with the role Editor, Commentator or Reader, and can limit access per document or episode. Each collaborator's own plan decides which modules they can edit. Mobile sync is still "in development", and there is no web client.

### Cited Findings
- **Creator tier cloud features:**
  - Cross-device sync on desktop. Mobile sync is "in development".
  - Real-time collaboration.
  - 5 GB cloud storage.
  - Co-authors can join on any plan, and their own plan limits what they can edit.
  - Source: [starc.app/pricing](https://starc.app/pricing)
- **Cloud help article:**
  - It names the tier "CLOUD subscription", which is an older name.
  - To create a cloud project, choose "Save story in the cloud" in the create dialog. Existing projects move with "Move to the cloud" or "Save to local file".
  - Source: [help/cloud-projects](https://starc.app/help/cloud-projects/)
- **Inviting collaborators:**
  1. Open the project information screen and click the silhouette icon. This opens the co-authoring settings.
  2. Enter the collaborator's email.
  3. Choose a role: Editor, Commentator or Reader.
  4. Optionally click "Configure Access" to give view, edit or comment rights to specific documents or episodes. The "Provide access to all documents" toggle gives access to everything.
  5. Click "Grant access".
  - Source: [help/cloud-projects](https://starc.app/help/cloud-projects/)
- **Collaborator capabilities by plan:**
  - FREE: script text and other Free modules. Paid modules are view-only.
  - PRO or CLOUD: cards, gallery and maps.
  - CLOUD only: script breakdown.
  - Source: [help/cloud-projects](https://starc.app/help/cloud-projects/)
- **Comments and review:** "How to review documents" covers review mode. Review marks can be exported to DOCX/PDF. Review mode reached mobile in v0.2.0 — [help/review-mode](https://starc.app/help/review-mode/); [help/screenplay-exporting](https://starc.app/help/screenplay-exporting/); [App Store](https://apps.apple.com/us/app/story-architect-mobile/id6743486540)
- **Roadmap:**
  - 0.9.X: document change history, a chat room and a support chat.
  - 1.0.X and later: deep integration of project files into the chat room, a common board for all series, interactive stories and contests.
  - Source: [starc.app](https://starc.app/)
- **Mobile sync:** App Store reviews complain that projects do not sync with the desktop. The developer replied that sync is in progress. Users currently move work by PDF or `.starc` transfer — [App Store](https://apps.apple.com/us/app/story-architect-mobile/id6743486540); [help/transfer-project](https://starc.app/help/transfer-project/)
- **Institutional licenses:** a "Studio & Campus licenses" section has an article on managing student access under a Campus license — [help/campus-license](https://starc.app/help/campus-license/)
- **KIT Scenarist history:** KIT already had a paid cloud with co-editing and a mobile app. Its cloud and mobile services were frozen in June 2023, and cloud subscriptions could be transferred to STARC until 31 July 2023 — [kitscenarist.ru/history](https://kitscenarist.ru/history.html)
- **Web version:** none was found. The download page lists only desktop and mobile apps — [starc.app/download](https://starc.app/download/)

### Inferences
- The Campus license and its student-access management are a ready channel for film schools, and a possible point of contact for Authorled's educational use.
- STARC has no public API and no web client. Real-time integration would require STARC's cooperation, for example a cloud API or an AI plugin.

### Gaps
- No public API or SDK documentation was found.
- Not documented:
  - the comment threading model,
  - offline behaviour,
  - conflict resolution,
  - where the servers are hosted (Russia or abroad).
- Campus and Studio license pricing was not retrieved.

## Pricing plans, prices in RUB/USD, payment, what each tier unlocks

### Takeaway
There are three tiers: Free, Pro and Creator, the last formerly called CLOUD. Both paid tiers are billed annually:

| Plan | RUB | USD | Lifetime |
|---|---|---|---|
| Free | 0 | 0 | no paid tier needed |
| Pro | 375 ₽/month (4,500 ₽/year) | $4.17/month (about $50/year) | 13,500 ₽ / $150 |
| Creator | 750 ₽/month (9,000 ₽/year) | $8.34/month (about $100/year) | none listed |

Both paid tiers have a 30-day trial. AI credits are sold in separate packs. Educational users get 50% off.

### Cited Findings
- **Free** ($0, "free forever"):
  - unlimited projects and documents, a cover generator and folders,
  - characters, locations and worlds,
  - screenplay, comic, audio drama, stageplay and novel modules,
  - import/export, basic statistics and scene-number locking,
  - no AI credits.
  - Source: [starc.app/pricing](https://starc.app/pricing)
- **Pro** ($4.17/month billed annually, lifetime $150, 30-day trial):
  - mind maps, image gallery, presentations,
  - character relations editor, location and world maps,
  - corkboard and timeline, extended statistics, cross-story dialogue and scene views,
  - AI credits: 5/month, 60/year or 120 with the lifetime purchase,
  - planned for 2026: image editor, web links, a beats editor and a comics pages/panels editor.
  - Source: [starc.app/pricing](https://starc.app/pricing)
- **Creator** ($8.34/month billed annually):
  - everything in Pro,
  - sync and real-time collaboration, 5 GB cloud storage,
  - script breakdown, showrunner tools, a series plan and statistics across all episodes,
  - AI credits: 10/month or 120/year,
  - planned for 2026: season-wide beats, cards and timelines, page-number locking and a storyboard.
  - Source: [starc.app/pricing](https://starc.app/pricing)
- **RUB prices:**
  - Pro 375 ₽/month billed annually, lifetime 13,500 ₽.
  - Creator 750 ₽/month billed annually.
  - Each new account can activate a free trial of any version once.
  - Source: [starc.app/ru/pricing](https://starc.app/ru/pricing/)
- **AI credits** (1 credit = 1,000 words or 10 images; credits never expire):

  | Pack | RUB | Per credit, RUB | USD |
  |---|---|---|---|
  | 50 | 900 ₽ | 18 ₽ | $10 |
  | 200 | 2,700 ₽ | 13.5 ₽ | $30 |
  | 500 | 5,400 ₽ | 10.8 ₽ | $60 |
  | 1,000 | 9,000 ₽ | 9 ₽ | $100 |

  - Sources: [ru/pricing](https://starc.app/ru/pricing/); [pricing](https://starc.app/pricing)
- **Education:** 50% off any plan. Verify by emailing edu@starc.app from an institution-domain address or with a student or academic ID photo. A personal code arrives in 1–3 business days — [ru/pricing](https://starc.app/ru/pricing/)
- **Payment:**
  - Subscriptions are bought from the in-app account, which redirects to a browser payment page. Credits are bought in the personal account.
  - Promo and gift codes are supported, and subscriptions can be gifted.
  - Payment providers are not named.
  - Sources: [ru/pricing](https://starc.app/ru/pricing/); [help/gifting](https://starc.app/help/gifting/)
- **Earlier pricing:** a third-party listing (SaaSHub, undated) shows Pro at about $3.34/month, which suggests prices have risen — [saashub](https://www.saashub.com/story-architect-starc-alternatives)
- **Mobile app:** free, and its App Store page lists no in-app purchases — [App Store](https://apps.apple.com/us/app/story-architect-mobile/id6743486540)

### Inferences
- The Russian prices are very low (about 4,500 ₽/year for Pro), which anchors what Russian writers expect to pay.
- STARC's AI is monetized by usage (credits), not by tier. An Authorled AI integration could plug into or complement that credit model.

### Gaps
- No monthly (non-annual) billing price was found.
- Studio and Campus prices were not found.
- The payment processor (YooKassa, Paddle or other) is not identified.
- The Russian page shows USD figures in its FAQ but RUB in its table. This is a small inconsistency.

## Company, people, history, users, market position, reviews

### Takeaway
STARC is made by Story Apps (storyapps.dev), a small team led by founder Dmitry "Dimka" Novikov, author of KIT Scenarist. Development ran from 2013 to 2014 (KIT), 2019 to 2021 (STARC start and release) and 2023 (KIT sunset). The site claims about 22.6k authors. Independent reviews are scarce, and the main public complaint is missing mobile/desktop sync.

### Cited Findings
- **Timeline:**
  - 2013: Dimka Novikov starts screenwriting software.
  - 2014: KIT Scenarist is released.
  - 2019: STARC begins.
  - 2021: STARC is released.
  - 2023: KIT support ends.
  - Sources: [help/kitscenarist](https://starc.app/help/kitscenarist/); [linuxlinks](https://www.linuxlinks.com/story-architect-reinventing-screenwriting/)
- **KIT end of support:** announced 6 June 2023, describing STARC as "KIT 2.0". KIT was free with a paid cloud subscription, and STARC's licensing changed to fund development — [kitscenarist.ru/history](https://kitscenarist.ru/history.html)
- **Team page (old site, Russian):**
  - Дмитрий Новиков, founder
  - Борис Малеев, co-founder
  - Михаил Галкин, web developer
  - Ирина Морозова, Flutter developer
  - Екатерина Пуль, designer
  - Полина Шляпужникова, content manager
  - Source: [old.starc.app/ru/about-us](https://old.starc.app/ru/about-us)
  - The App Store seller is "Dmitry Novikov" — [App Store](https://apps.apple.com/us/app/story-architect-mobile/id6743486540)
- **Company:** Story Apps also offers "Story Architect AI" (summarizes a screenplay in about 10 minutes) and "Logline Creator". Contact: hello@storyapps.dev — [storyapps.dev](https://storyapps.dev)
- **User numbers:**
  - The homepage counter shows 22,587 authors and 63 releases — [starc.app](https://starc.app/)
  - App Store: 4.2 out of 5 from 14 ratings — [App Store](https://apps.apple.com/us/app/story-architect-mobile/id6743486540)
  - GitHub: 403 stars — [GitHub](https://github.com/story-apps/starc)
- **App Store reviews:**
  - Praise: easier than other tools, and users are glad to have a mobile version.
  - Complaints: no project sync with desktop (users email PDFs), and no comics on mobile.
  - Source: [App Store](https://apps.apple.com/us/app/story-architect-mobile/id6743486540)
- **Russian mentions:**
  - A Threads post calls STARC the "наследник отечественной программы KIT Scenarist" and praises the timeline, characters and locations — [threads @sergames.life](https://www.threads.com/@sergames.life/post/DPkVD7SkTqe)
  - A 2022 review on freeloadsoft — [freeloadsoft.ru](https://freeloadsoft.ru/2022/05/30/story-architect-novoe-prilozhenie-dlya-sczenaristov/)
  - The Linux Mint catalogue has 0 reviews — [community.linuxmint.com](https://community.linuxmint.com/software/view/dev.storyapps.starc)
- **Competitor pages:** STARC publishes comparisons against Trelby, KIT Scenarist and MS Word — [help index](https://starc.app/help/); [ru/competitors/kitscenarist](https://starc.app/ru/competitors/kitscenarist)

### Inferences
- The six-person team and GPL codebase point to a small independent studio. The co-founder and a founder blog are the likely decision-makers for a partnership.
- The Campus license implies existing ties with educational institutions, but none are named publicly.

### Gaps
- No team location, legal entity or registration details were found. The location was not confirmed, and no reliable source ties Novikov to a city.
- No interviews were found on Habr or vc.ru.
- No named film-school or platform partnerships were found.
- No VK or Telegram discussion threads with complaints were collected.
- Google Play rating and download count could not be retrieved: the page content was truncated.
- The 22,587 "authors" counter is unverified vendor data, and its definition (registered accounts?) is unknown.

## Public channels and partnership contacts

### Takeaway
There is no dedicated partnership email. The best routes are hello@storyapps.dev (company), the starc.app contact form, the founder's Telegram blog and the Russian community channels.

### Cited Findings
- **starc.app/contacts:** a contact form (name, email, message, attachment). International channels: X [@starcapp_](https://twitter.com/starcapp_), [Discord](https://discord.gg/8Hjze3UYgQ), [Telegram t.me/starcapp](https://t.me/starcapp) and [Facebook](https://www.facebook.com/starc.application/). No emails are listed — [starc.app/contacts](https://starc.app/contacts/)
- **Russian channels:** [VK vk.com/starc_app](https://vk.com/starc_app), [Telegram t.me/starcapp_ru](https://t.me/starcapp_ru) and [Facebook RU](https://facebook.com/starc.application.ru). Personal blogs: Dmitry Novikov [t.me/dimkanovikov_blog](https://t.me/dimkanovikov_blog) and Polina Shlyapuzhnikova [t.me/polkaheynaya](https://t.me/polkaheynaya) — [old.starc.app/ru/about-us](https://old.starc.app/ru/about-us)
- **Emails:**
  - support@starc.app (support, per the README) — [GitHub](https://github.com/story-apps/starc)
  - edu@starc.app (education) — [ru/pricing](https://starc.app/ru/pricing/)
  - hello@storyapps.dev (company) — [storyapps.dev](https://storyapps.dev)
- **GitHub issues** are the public channel for features and bugs — [GitHub](https://github.com/story-apps/starc)

### Inferences
- For an integration proposal, the most direct entry point is hello@storyapps.dev together with the founder's Telegram blog. The Campus/edu channel (edu@starc.app) is relevant to the educational angle.

### Gaps
- No published partner program, affiliate program or API terms were found.
