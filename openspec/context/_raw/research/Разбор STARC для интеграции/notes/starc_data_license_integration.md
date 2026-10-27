# STARC (Story Architect): data format, license and integration surface (as of 2026-10-27)

Method: read-only inspection of the public GitHub repo `story-apps/starc` (default branch `master`) through the GitHub API and raw.githubusercontent.com, plus starc.app help and pricing pages. Nothing was cloned, built or run. Raw source URLs below use `https://raw.githubusercontent.com/story-apps/starc/master/...`; commit hashes were not pinned, so line contents may drift.

## 1. Repository: license, open vs closed parts, contribution policy, activity, stack

### Takeaway
The desktop client is GPL-3.0 C++/Qt and is very active (release v0.8.4 on 2026-10-27). The cloud client/server integration (`src/cloud` -> private `starcloud` repo) and about 25 PRO/CREATOR feature plugins are private git submodules. External contributions are accepted, but maintainers keep control of the roadmap.

### Cited Findings
- License: the GitHub API reports `GPL-3.0`. The LICENSE file is the GNU GPL v3 (29 June 2007). The README's License section says the app is distributed under GPL v3 and that third-party components and optional modules may have their own license terms. — [GitHub API repo](https://api.github.com/repos/story-apps/starc), [LICENSE](https://raw.githubusercontent.com/story-apps/starc/master/LICENSE), [README](https://github.com/story-apps/starc/blob/master/README.md)
- Sampled source files (`text_template.cpp`, `document_mapper.cpp`) have no per-file license header, so "GPL-3.0-only" vs "or later" is not stated per file. The repo-level SPDX id is `GPL-3.0`. — [text_template.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/business_layer/templates/text_template.cpp)
- Languages (GitHub API, bytes): C++ 13.6M, QMake 121K, Shell 31K, NSIS 20K, C 1.4K. The build needs C++17 and Qt 5 or Qt 6 (Core, GUI, Widgets, Concurrent, Multimedia, Network, SQL, XML) with qmake. — [languages API](https://api.github.com/repos/story-apps/starc/languages), [README](https://github.com/story-apps/starc/blob/master/README.md)
- Closed parts: `.gitmodules` maps `src/cloud` to `git@github.com:story-apps/starcloud` (private, SSH). It also maps these feature plugins to private `story-apps/starc-*-plugin` repos: character_information, location_information, world_information, screenplay/comic_book/audioplay/stageplay/novel/screenplay_series statistics, characters_relations, locations_map, worlds_map, project_collaborators, screenplay_cards, novel_cards, images_gallery, character_dialogues, screenplay_breakdown (+_structure), mind_map, location_scenes, screenplay_timeline, novel_timeline, screenplay_series_plan, presentation. The public submodules are only the PDF libs (`story-apps/PDF-Writer`, `story-apps/pdf-text-extraction`). — [.gitmodules](https://github.com/story-apps/starc/blob/master/.gitmodules)
- The README says the repo "references private cloud and commercial-feature submodules" and that a plain recursive submodule init "may request access you do not have". — [README](https://github.com/story-apps/starc/blob/master/README.md)
- Issue #77 (2022): a contributor reported the app could not be built because of the closed plugins. The maintainer (dimkanovikov) fixed the open-source part so that it "should build and work without … proprietary plugins". — [issue #77](https://github.com/story-apps/starc/issues/77)
- Contribution policy (README): contributions are welcome, but the README says "Story Architect has an established product vision and development roadmap" and changes outside it may not be accepted. Large features need an issue first, and C++ must follow `src/.clang-format`. No CONTRIBUTING.md exists (404), and no CLA is mentioned. — [README](https://github.com/story-apps/starc/blob/master/README.md)
- Activity: releases v0.8.4 (2026-10-27), v0.8.3 (2026-09-22), v0.8.2 (2026-06-08), v0.8.1 (2026-03-03), v0.8.0 (2025-12-09), v0.7.8 (2025-07-15), v0.7.7 (2025-03-10). The last commits are on 2026-10-26 (for example, "Add timeline to the screenplay cards module"). The repo has 403 stars, 58 forks and about 106 open issues+PRs, with Discussions disabled. Merged PRs in 2026 are mostly by the maintainer dimkanovikov, plus some external ones (for example, #327 "Fix PDF import" by iljukhaput). — [releases API](https://api.github.com/repos/story-apps/starc/releases), [commits API](https://api.github.com/repos/story-apps/starc/commits), [repo](https://github.com/story-apps/starc)
- Note: a WebFetch of the GitHub HTML page said the "Releases" section was empty. That conflicts with the releases API, which lists tagged releases. Trust the API.

### Inferences
- The project is effectively single-maintainer led (the Story Apps company and Dmitry Novikov, also the author of the predecessor KIT Scenarist). This is inferred from the PR authorship pattern. An official partnership would be negotiated with a small team.
- The monetized parts sit outside GPL code: cloud sync/collaboration and PRO modules. The business model is "open core plus closed plugins plus SaaS".

### Gaps
- The license of the private `starcloud` and plugin repos is unknown (presumably proprietary, not verifiable).
- It is unknown whether the copyright holder would dual-license corelib for proprietary use. Ask them.

## 2. Project file format (.starc)

### Takeaway
A `.starc` file is a single SQLite database with 3 tables. The project is a flat set of "documents" (UUID, integer type, content BLOB). Most content blobs are UTF-8 XML (`<document mime-type="application/x-starc/document/..." version="1.0">`). History is stored as diff-match-patch undo/redo patches, which are zlib-compressed with qCompress. The document tree is itself an XML document of type `Structure`. Drafts/versions are entries in that structure XML. Comments are inline review marks inside the text XML.

### Cited Findings
- Container: the freedesktop MIME definition registers `application/x-starc` with `<sub-class-of type="application/x-sqlite3"/>` and glob `*.starc`. — [dev.storyapps.starc.mime.xml](https://raw.githubusercontent.com/story-apps/starc/master/build/linux/flathub/share/mime/packages/dev.storyapps.starc.mime.xml)
- The DB driver is `QSQLITE`. The schema (`Database::createTables`) is:
  - `system_variables(variable TEXT PRIMARY KEY ON CONFLICT REPLACE, value TEXT NOT NULL)`
  - `documents(id INTEGER PK AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, type INTEGER NOT NULL DEFAULT 0, content BLOB, synced_at TEXT)`
  - `documents_changes(id INTEGER PK AUTOINCREMENT, fk_document_uuid TEXT NOT NULL, uuid TEXT UNIQUE NOT NULL, undo_patch BLOB NOT NULL, redo_patch BLOB NOT NULL, date_time TEXT NOT NULL /* yyyy.mm.dd.hh.mm.ss.zzz */, user_name TEXT NOT NULL, user_email TEXT, is_synced INTEGER NOT NULL DEFAULT 0)`
  - plus indexes on `documents_changes(fk_document_uuid)` and `(date_time)`.

  — [database.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/data_layer/database.cpp)
- Versioning gate: `system_variables` holds `application-version`. If a file was saved by a newer app version, `canOpenFile` refuses it with "Project was modified in a newer version. Update to the latest version to open it." An older version triggers migrations (`OldVersionFlag`). — [database.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/data_layer/database.cpp)
- `documents.content` is written as-is by `DocumentMapper` (no compression). `DocumentChangeMapper` writes `qCompress(undoPatch)` / `qCompress(redoPatch)` and reads with `qUncompress`. — [document_mapper.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/data_layer/mapper/document_mapper.cpp), [document_change_mapper.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/data_layer/mapper/document_change_mapper.cpp)
- Patches come from a bundled diff-match-patch (`src/corelib/utils/diff_match_patch/diff_match_patch_controller.h`). `StructureModel::applyPatch` calls `dmpController().applyPatch(toXml(), _patch)`, so changes are text patches over the document's XML. — [structure_model.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/business_layer/model/structure/structure_model.cpp)
- Document type IDs (`Domain::DocumentObjectType`) — [document_object.h](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/domain/document_object.h):
  - Service and raw: Structure=1, ImageData=101, BinaryData=102.
  - Project=10000, RecycleBin=10001.
  - Screenplay=10100, ScreenplayTitlePage=10101, ScreenplaySynopsis=10102, ScreenplayTreatment=10103, ScreenplayText=10104, ScreenplayDictionaries=10105, ScreenplayStatistics=10106.
  - ScreenplaySeries=10110, with Episodes/TitlePage/Synopsis/Treatment/Text/Statistics at 10111–10116.
  - ComicBook=10200 (TitlePage 10201, Synopsis 10202, Text 10203, Dictionaries 10204, Statistics 10205).
  - Audioplay=10300 (10301–10305); Stageplay=10400 (10401–10405).
  - Novel=10500 (TitlePage 10501, Synopsis 10502, Outline 10503, Text 10504, Dictionaries 10505, Statistics 10506); GameScript=10600.
  - Plots=20000/Plot=20001; Characters=30000/Character=30001; Locations=40000/Location=40001; Worlds=50000/World=50001.
  - Folder=100001, SimpleText=100002, MindMap=100003, Image=100004, ImagesGallery=100005, Presentation=100006, Link=100007.
- Each type maps to a MIME string used inside the XML, for example `application/x-starc/document/screenplay/text`, `.../novel/outline`, `.../character`, `.../location`, `.../world`, `.../text` (SimpleText), `.../mind-map`. — [document_object.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/domain/document_object.cpp)
- Document tree (Structure document): XML `<?xml version="1.0"?><document mime-type="application/x-starc/document/structure" version="1.0">` containing nested `<item uuid=".." type="<mime>" name=".." color=".." visible="true|false" ...>`. Drafts are child `<draft uuid name color readonly [comparison]>` elements. The older `<version>` tag is still read for compatibility and is marked "TODO: remove in 0.9". — [structure_model.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/business_layer/model/structure/structure_model.cpp)
- The generic XML root for content documents is `<document mime-type=".." version="..">`, with `<content>` for grouping children. — [abstract_model_xml.h](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/business_layer/model/abstract_model_xml.h), [text_model.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/business_layer/model/text/text_model.cpp)
- Text model serialization. A group element is named by group type, with `uuid` and other attributes. It holds optional `<number value custom eat fixed/>`, `<color>`, `<title>`, `<story_day>`, `<start_date_time>`, `<description>`, `<stamp>`, `<tags><tag ..>`, `<planned_duration>` and `<resources>` (all CDATA), then `<content>…</content>`. — [text_model_group_item.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/business_layer/model/text/text_model_group_item.cpp), [text_model_xml.h](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/business_layer/model/text/text_model_xml.h)
  - Folder types: root, act, sequence, part, chapter.
  - Group types: scene, beat, page, panel, chapter1..chapter6.
- A paragraph is an element named by its paragraph type, containing:
  - `<params align ifc/>`, `<bm color><![CDATA[..]]></bm>` (bookmark) and `<v><![CDATA[text]]></v>` (value);
  - `<rms><rm from length color bgcolor done><c author email date e r add rem><![CDATA[comment]]></c></rm></rms>` (review marks/comments, including revision-mode add/remove flags);
  - `<fms><fm from length bold italic underline strikethrough fontf fonts/></fms>` (inline formats);
  - `<rss><rs ../></rss>` (resource marks).

  — [text_model_text_item.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/business_layer/model/text/text_model_text_item.cpp)
- Paragraph type names (the XML tag names, from `text_template.cpp`) — [text_template.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/business_layer/templates/text_template.cpp):
  - General: undefined, unformatted_text, inline_note, act_heading/act_footer, sequence_heading/sequence_footer, part_heading/part_footer, chapter_heading/chapter_footer, page_splitter.
  - Screenplay: scene_heading, scene_characters, beat_heading, action, character, parenthetical, dialogue, lyrics, transition, shot.
  - Audioplay: sound, music, cue.
  - Comics: page_heading, panel_heading, description.
  - Prose: heading_1..heading_6, text.
- Text templates (page and paragraph styles) are separate XML (`<style id default modified_at name page_format page_margins …>` with per-block attributes such as font_family, font_size, alignment, margins and lines_before). Template files use extension `starct`. — [text_template.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/business_layer/templates/text_template.cpp), [extension_helper.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/utils/helpers/extension_helper.cpp)
- Images are stored as separate documents (ImageData=101) and referenced by UUID (`DocumentImage{uuid, image}`); a raw data storage exists as well. — [document_object.h](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/domain/document_object.h), [storage headers](https://github.com/story-apps/starc/tree/master/src/corelib/data_layer/storage)

### Inferences
- Reconstructed shape of a screenplay text blob: `<document mime-type="application/x-starc/document/screenplay/text" version="1.0"><scene uuid="{..}"><content><scene_heading><v><![CDATA[INT. ROOM - DAY]]></v></scene_heading><action><v><![CDATA[..]]></v></action><character><v>..</v></character><dialogue><v>..</v></dialogue></content></scene>…</document>`. The pieces were verified individually; the exact whitespace and attribute order is unverified. Test it against a real file before relying on it.
- Reading `.starc` from Python is straightforward: `sqlite3`, find the Structure document (type=1), walk items by UUID, then parse each content blob as XML.
- Writing `.starc` is riskier, for several reasons:
  - The app gates on `application-version` and runs migrations.
  - Structure and document XML must stay consistent with each other.
  - Change-history rows (if written) are dmp patches with compression, and `synced_at`/`is_synced` interact with cloud sync.
  - The XML schema is undocumented and changes between versions (see the "remove in 0.9" TODOs).
  - The safest write path is to generate a fresh project with an empty `documents_changes` table and a pinned `application-version`, then test it against each STARC release.
- Mapping to Authorled D1–D22 is rich: Characters/Locations/Worlds docs, Synopsis, Treatment (outline), Novel Outline, beats (`beat_heading`, group `beat`), scene-level `description`/`tags`/`story_day`, drafts, and comments with author and date.

### Gaps
- Inner XML of Character/Location/World/Project/TitlePage documents was not inspected (several are in closed plugins: `character_information`, `location_information`, `world_information`). The model code may still be in public corelib (`business_layer/model/characters/...`, not fetched). Update 2026-10-27 (clone at commit c5bf39ff): the models are public in `src/corelib/business_layer/model/{characters,locations,worlds}` (77, 19 and 50 setters); only the profile screens are closed plugins. XML tag names are still not checked.
- No official format spec or documentation of `.starc` was found.
- It was not verified how drafts store their text: a separate document UUID per draft is likely, since the draft has its own UUID.

## 3. Import/export formats and Fountain round-trip

### Takeaway
STARC imports many screenplay formats (KIT Scenarist, FDX/FDXT, Trelby, Celtx, DOCX/ODT/RTF, Fountain, Markdown, TXT, PDF). Export is narrower: PDF, DOCX, FDX (screenplay only), Fountain (screenplay, stageplay, audioplay, comic book) and Markdown (novel, simple text). Fountain is the only open, bidirectional, text-based route for scripts. It loses STARC-specific metadata, and title-page import/export has a long-open bug.

### Cited Findings
- Importers in public corelib:
  - Screenplay: Celtx, DOCX, FDX, Fountain, KIT Scenarist, PDF, Trelby.
  - Stageplay, Audioplay, ComicBook: Fountain.
  - Novel: Markdown.
  - Simple text: DOCX, Markdown, PDF.

  — [tree: business_layer/import](https://github.com/story-apps/starc/tree/master/src/corelib/business_layer/import)
- Accepted import extensions (`ImportManager`): kitsp, fdx, fdxt, trelby, rtf, docx, odt, fountain, celtx, md, txt, pdf. A `.doc` (binary MS Office) file is handled as a special unsupported case. — [import_manager.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/core/management_layer/content/import/import_manager.cpp), [extension_helper.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/utils/helpers/extension_helper.cpp)
- Exporters (`ExportFileFormat`: Pdf, Docx, Fdx, Fountain, Markdown) — [export dir](https://github.com/story-apps/starc/tree/master/src/corelib/business_layer/export), [export_manager.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/core/management_layer/content/export/export_manager.cpp):
  - screenplay: PDF/DOCX/FDX/Fountain
  - stageplay, audioplay, comic book: PDF/DOCX/Fountain
  - novel: PDF/DOCX/Markdown
  - simple text: PDF/DOCX/Markdown
  - characters, locations, worlds: PDF/DOCX only
- Official help lists import of KIT Scenarist, Final Draft, Celtx and Trelby, plus .txt, .odt, .docx and .fountain. It states no fidelity limits. — [starc.app help: screenplay importing](https://starc.app/help/screenplay-importing)
- Release notes for 0.7.3 (via search snippet) say that import of novels, comics, plays and audio plays is limited to Markdown and Fountain. — [starc.app blog 2024-07-02](https://starc.app/blog/2024-07-02)
- Fountain mapping in the screenplay Fountain exporter:
  - Comments are written as `[[...]]` and inline notes as `/* ... */`.
  - Acts and sequences become `#` sections, and beat headings become `= ` synopses.
  - Lyrics use `~ `, transitions `> `, and all-caps action is forced with `!`.

  — [screenplay_fountain_exporter.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/business_layer/export/screenplay/screenplay_fountain_exporter.cpp)
- The Fountain importer handles `[[ ]]` notes, `=` synopses/beats, `#` scene numbers and title-page keys (a `Title` -> `name` mapping). — [abstract_fountain_importer.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/business_layer/import/abstract_fountain_importer.cpp)
- Known Fountain issues:
  - #200 (open since 2023-10-25): title page info (author, notes) is not imported, and a commenter says it is "also not exported from STARC". — [issue #200](https://github.com/story-apps/starc/issues/200)
  - #297 (open, 2025-03): boneyard `/* */` is imported as a strange right-aligned element, and the reporter asks for full Fountain-spec parity. — [issue #297](https://github.com/story-apps/starc/issues/297)
  - Fixed PRs: #304 (2025-06, action formatting on Fountain export) and #275 (2024-10, parenthetical import). — [issue search](https://github.com/story-apps/starc/issues?q=fountain)
- A 2022 blog post (via search snippet) says STARC can open non-STARC files directly since 0.2.1, but that character, location and project data are lost when saving in another format. — [starc.app blog 2022-07-01](https://starc.app/blog/2022-07-01)

### Inferences
- Fountain round-trip is viable for scene text (scene headings, action, character, dialogue, parenthetical, transitions, lyrics, beats/synopses, sections, notes). It is lossy for:
  - Characters, locations and worlds documents.
  - Scene metadata (color, tags, story_day, stamp, planned_duration).
  - Review marks with author/date (exported as `[[ ]]` only).
  - Inline formatting ranges, drafts, the title page (bug #200), and STARC-only elements such as `shot`/`scene_characters`. How these map was not verified; they may degrade to action.
- Stable UUIDs do not survive a Fountain round-trip. Authorled fragment/version identity therefore cannot rely on Fountain; a diff/merge on text is needed.
- FDX is export+import for screenplays only. It is useful for the Final Draft ecosystem but adds nothing over Fountain for a STARC exchange.
- For loss-free exchange, read (and possibly write) `.starc` directly.

### Gaps
- Exact element-by-element fidelity for FDX and DOCX was not measured. A test corpus round-trip is recommended.
- Whether `shot`, `scene_characters` and `inline_note` survive Fountain import was not verified.

## 4. Cloud, API, plugins, scripting, deep links

### Takeaway
There is no public API, webhook, scripting or third-party plugin SDK. Cloud sync (CREATOR plan) is implemented in a private `starcloud` submodule against a closed server. "Plugins" are internal compile-time Qt modules, many of them closed. The only integration precedents are a 2021 internal "Starc API service" PR and an open 2026 third-party PR embedding a Codex assistant.

### Cited Findings
- `src/cloud` is a submodule pointing to private `story-apps/starcloud`. — [.gitmodules](https://github.com/story-apps/starc/blob/master/.gitmodules)
- The public domain header `starcloud_api.h` defines only client-side DTOs, with no endpoints:
  - `SubscriptionType`: Free, ProMonthly/Lifetime, CreatorMonthly/Lifetime, Studio, Campus, plus feature add-ons ScreenplayBreakdown/SeriesPlan/SeriesStatistics.
  - Also `NotificationType`, `PaymentOption`, `AccountInfo` (cloudStorageSize, credits, sessions), `TeamInfo`/`TeamMemberInfo` (roles, review notifications).

  — [starcloud_api.h](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/domain/starcloud_api.h)
- Sync data model: each document has `synced_at`, and each change has `is_synced` plus author name/email. This points to sync by uploading per-document dmp patches. — [database.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/data_layer/database.cpp)
- Pricing (2026): FREE; PRO ($4.17/mo annual or $150 lifetime, 5 AI credits/mo); CREATOR ($8.34/mo annual) with "Seamless sync across all your devices (desktop; mobile sync in development)", "Real-time collaboration" and 5 GB storage. No API, integrations or plugins are mentioned. AI credits: 1 credit = 1,000 words or 10 images, sold in packs. — [starc.app/pricing](https://starc.app/pricing)
- STARC has a built-in AI assistant: `src/corelib/ui/modules/ai_assistant/*` in the public repo, and an AI-tokens help page. — [repo tree](https://github.com/story-apps/starc/tree/master/src/corelib/ui/modules/ai_assistant), [help: AI tokens](https://starc.app/help/ai-tokens-purchasing)
- Plugins are qmake sub-projects under `src/core/management_layer/plugins/*` (e.g. `audioplay_text/audioplay_text.pro`) loaded by the app. No external plugin SDK or docs were found. — [repo tree](https://github.com/story-apps/starc/tree/master/src/core/management_layer/plugins)
- PRs #55 "Implemented base version of the Starc API" and #57 "Implemented Starc api service" (2021, by the maintainer, empty descriptions) are internal cloud-client work, not a public API. — [PR #55](https://github.com/story-apps/starc/pull/55), [PR #57](https://github.com/story-apps/starc/pull/57)
- PR #332 (open, 2026-08-12, external author jeffkimkimo) is "Integrate Codex story assistant". It embeds a local Codex app server behind STARC's screenplay assistant and sends screenplay, synopsis, character and location context. It previews edits and applies them with "native Fountain formatting". No maintainer acceptance is visible. — [PR #332](https://github.com/story-apps/starc/pull/332)
- Pricing page: a CREATOR owner can share projects with co-authors on any plan, and the co-author's plan determines their editing rights. — [starc.app/pricing](https://starc.app/pricing)

### Inferences
- A third party cannot programmatically access STARC cloud projects without reverse-engineering a closed, undocumented protocol. That would be fragile and likely a ToS problem, so it is not recommended.
- STARC already sells AI credits and has an AI assistant. An Authorled AI is a potential competitor to their revenue line, which shapes partnership talks. An "Authorled inside STARC" plugin would have to be accepted upstream (roadmap gate) or shipped as a GPL fork.
- PR #332 shows the shape of an in-app AI integration (context → proposal → Fountain-formatted apply). Its fate signals the maintainers' openness to third-party AI.

### Gaps
- No URL scheme or deep-link handler (`starc://`) was confirmed. GitHub code search returned no results, possibly because of index limitations, so this is unknown, not "absent".
- Server endpoints and transport (REST/WebSocket) are unknown because the code is private.
- STARC's terms of service were not reviewed.
- The maintainers' stance on PR #332 was not visible.

## 5. Legal implications (fact vs inference; not legal advice)

### Takeaway
GPL-3.0 restricts reuse of STARC's code, not interoperability with its file format. Reading and writing `.starc` with an independent Python implementation is generally fine. Copying their C++ code into a distributed product triggers GPL obligations. Authorled is a web service, and GPL-3.0 (not AGPL) has no network-use clause. Closed plugins and the cloud are not available under GPL at all.

### Cited Findings
- The license is GPL-3.0, and the README says optional modules may have their own terms. — [README](https://github.com/story-apps/starc/blob/master/README.md), [LICENSE](https://raw.githubusercontent.com/story-apps/starc/master/LICENSE)
- Cloud and feature plugins are private repos. — [.gitmodules](https://github.com/story-apps/starc/blob/master/.gitmodules)

### Inferences
These are general GPL understanding, not legal advice; verify with counsel.
- **Reading/writing .starc in our backend.** Implementing a reader/writer from observation of the format (SQLite schema plus XML tags) is interoperability work. File formats and schema facts are generally not protected by the code license. A clean-room implementation that does not copy code is low risk. Copying the tag-name list as data is likely fine, but keep our implementation independent.
- **Reusing their code** (porting the C++ Fountain parser, or copying XML writer logic into Python):
  - A derivative work is GPL-3.0. If we distribute it (desktop companion app, on-prem package, client-side JS), the source must be released under GPL-3.0.
  - Running modified GPL code only on our servers, without distribution, triggers no source disclosure under GPL-3.0 (unlike AGPL). This is still a risk if we later ship a desktop or on-prem build.
  - Keeping our proprietary code free of GPL code is the safe default.
- **Running STARC's code as a separate program** (for example, invoking a STARC binary for conversion) is "mere aggregation" or arm's-length use and generally does not infect our code. STARC has no headless/CLI converter, though.
- **Copying UI flows.** GPL covers code and assets, not ideas or workflows. Copying icons, images, texts or translations (copyrighted assets in the repo) would be covered by the GPL or by their own terms. Trademarks "Story Architect"/"STARC" are separate from the copyright license; we may describe compatibility ("imports .starc") but should not imply endorsement.
- **Contributing to upstream.** No CLA was found. Code we contribute stays GPL-3.0 and could be used in their commercial builds only because it links into their app under their own copyright arrangement. Clarify this if a partnership is negotiated.
- **Cloud.** There is no license to the protocol or server. Reverse-engineering the cloud for a commercial integration likely conflicts with their ToS (not reviewed).

### Gaps
- STARC's terms of use and EULA for the PRO/CREATOR binaries were not reviewed.
- Russian copyright-law specifics (for example, GK RF art. 1280 on decompilation for interoperability) were not researched and need counsel.

## 6. Realistic integration options, ranked

### Takeaway
Rank: (1) `.starc` import (read-only) plus Fountain/FDX export from Authorled; (2) `.starc` export (write) behind a version-pinned compatibility test; (3) a local companion or watch-folder flow; (4) a partnership for an official cloud/API or an "Open in Authorled" entry; (5) an AI plugin inside STARC (upstream PR or GPL fork). Cloud protocol reverse-engineering is not recommended.

### Cited Findings
- `.starc` is SQLite+XML with documented-in-code types. — [database.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/data_layer/database.cpp), [document_object.h](https://raw.githubusercontent.com/story-apps/starc/master/src/corelib/domain/document_object.h)
- STARC imports Fountain, FDX, DOCX, Markdown and more, and exports Fountain/FDX/DOCX/PDF/Markdown. — [import_manager.cpp](https://raw.githubusercontent.com/story-apps/starc/master/src/core/management_layer/content/import/import_manager.cpp), [export dir](https://github.com/story-apps/starc/tree/master/src/corelib/business_layer/export)
- There is no public API, and the cloud is private. — [.gitmodules](https://github.com/story-apps/starc/blob/master/.gitmodules), [pricing](https://starc.app/pricing)
- There is an external AI-integration PR precedent. — [PR #332](https://github.com/story-apps/starc/pull/332)

### Inferences
1. **File level, Authorled to/from STARC through open formats (fastest, lowest risk).**
   - Import: accept a `.starc` upload, read it with Python `sqlite3`, and map structure items, scenes/beats/paragraphs, Characters/Locations/Worlds, synopsis/treatment/outline and comments to D1–D22 fragments. Keep STARC UUIDs as external IDs for re-import diffing.
   - Export: generate Fountain (screenplay, stageplay, audioplay, comic) and Markdown (novel) that STARC imports. FDX is an option for screenplays.
   - Effort is low to medium. The risk is schema drift across STARC versions, mitigated by fixture files per release.
2. **Native `.starc` export.**
   - Writing a valid project gives loss-free hand-off: characters, scene metadata, beats and comments with authors.
   - It requires matching `application-version`, consistent Structure XML and an empty change history. Test with every STARC release (they ship about every 1–3 months).
   - Effort is medium. Breakage risk is real because the format is undocumented and in flux (0.9 cleanups are planned).
3. **Local companion (desktop helper or watch folder).**
   - Syncs a local `.starc` with Authorled by reading the SQLite DB and pushing diffs.
   - It must not write while STARC has the file open (SQLite locking and the in-memory app state).
   - Medium to high effort for limited gain over option 1. If distributed and built from STARC code, it falls under GPL.
4. **Partnership.** Ask Story Apps for any of:
   - (a) a documented `.starc` schema and stability guarantees;
   - (b) an "Export to / Open in Authorled" action or URL scheme in STARC;
   - (c) cloud API access for CREATOR users (OAuth, project read/write, webhooks);
   - (d) an Authorled AI as a provider behind their `ai_assistant` module.

   Their AI-credits revenue may make (d) a conflict; (a) and (b) are cheaper asks. A Russian-speaking maintainer (the code comments are Russian) eases communication.
5. **AI plugin inside STARC.**
   - Upstream it via a PR modeled on #332, which is gated by their roadmap.
   - Alternatively, ship a GPL-3.0 fork that bundles Authorled's client. The fork's code would be GPL and could not use the closed plugins or cloud. This splits users and is a weak option.
6. **Not recommended:** reverse-engineering the starcloud protocol, which is closed, ToS-uncertain and fragile.

### Gaps
- The user base size, the share of Russian-speaking users, and whether STARC users actually request external AI/web services were not researched (out of scope).
- The maintainers' openness to partnerships is not documented publicly. A direct inquiry is needed.
