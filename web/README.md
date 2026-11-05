# Authorled web

Frontend of Authorled: React + TypeScript on Vite, Refine with React Router, shadcn/ui on
Tailwind CSS (ADR-001, ADR-004). The writer's workspace follows mockup v2
(`openspec/context/_raw/design/kabinet-starc/`); rules: `openspec/specs/web/workspace`.

```sh
npm ci            # Node.js from .nvmrc
npm run dev       # open http://localhost:5173 (not 127.0.0.1: sign-in returns to localhost)
```

Settings come from the repository `.env` (see `example.env`): `AUTH_ISSUER`,
`AUTH_FRONTEND_CLIENT_ID` and `AUTH_FRONTEND_REDIRECT_URI` for sign-in with Authentik
(`docker compose up -d`), and `VITE_DATA_SOURCE`. A missing setting stops the app with its name.
The design-system showcase is at `/showcase`.

`VITE_DATA_SOURCE` picks the data of the screens (`openspec/specs/web/workspace`, «Источник данных»):

- `api` — the stories of the signed-in user in the core: the routes `/api/v1` of AgentOS
  (`openspec/specs/api/stories`, `api/review`, `api/files`, `api/story-import`) on `/os/` with the
  user's token. Needs the API and ClamAV running (`docker compose up -d`). `src/data/apiProvider.ts`
  translates the resources of the screens into the routes and keeps the revisions for `If-Match`;
  a refused save of an older revision (`409`) shows «История изменилась в другой вкладке».
  Import of manuscripts (Fountain, FDX, STARC, DOCX, TXT) and files in the chat go to the core.
- `fixtures` — sample data of mockup v2 in page memory, reset on reload, for the showcase and
  development; import and chat files answer that they need `api`.

The chat column talks to the co-author agent (`coauthor`) of AgentOS over AG-UI with CopilotKit
v2 (core and hooks only; the chat UI is ours, `src/screens/project/chat/`). The browser reaches
AgentOS on its own origin under `/os/`: the dev server proxies it to `AGENTOS_URL` from the
repository `.env` and refuses to start without it; production needs the same path on the
reverse proxy. Conversations are Agno sessions of the user, one story each
(`<story id>:<uuid>`). The CopilotKit dev console and inspector are off: the inspector loads
third-party fonts and assets.

- `src/app/` — settings, Refine root, routes. `src/auth/` — OIDC sign-in (oidc-client-ts).
- `src/data/` — model, data providers (`api`: `apiProvider.ts` over `apiClient.ts`; `fixtures`:
  `fixturesProvider.ts` over sample data), file operations (`files.ts`), profile fields.
- `src/screens/` — shelf, story trash, story window (navigator, documents, chat column).
- `src/design-system/` — tokens (`tokens.css`), fonts, type scale, paper, decorations and base
  components. Screens import from `@/design-system`. Rules: `openspec/specs/web/design-system`.
- `src/components/ui/` — shadcn/ui components, added with `npx shadcn@4.22.2 add <name>`; the
  overlays of dialog, alert-dialog and sheet use `bg-background/60` instead of a raw colour.
- `src/editor/` — the screenplay editor: a fork of `@plotwell/editor` on ProseMirror with the
  paragraph types and keys of STARC (`ORIGIN.md`, `openspec/specs/web/screenplay-editor`);
  `ScreenplayEditor.tsx` is its React wrapper. It only exports (Fountain, FDX, print); the core
  imports manuscripts. `anchors.ts` puts co-author suggestions in the text by their anchor (scene
  `uid` and the exact words); `plugins/sceneUids.ts` gives every scene heading a lasting `uid`.
- `scripts/check-contrast.ts` — WCAG contrast of token pairs in every theme.
- `scripts/check-editor.ts` — Tab/Enter, type keys, colour marks, scene `uid`s and suggestion anchors
  of the editor; the export samples the core import tests read (`agno/tests/fixtures/import/all-types.*`)
  must equal the current export. `npm run samples:export` (`scripts/samples.ts`) writes them again.
- `scripts/check-native-ui.ts` — no native tooltips, checkboxes, radio buttons or selects.

Checks run from the repository root with `./scripts/validate.sh`.

## Font licenses

Bundled from Fontsource packages, all under the SIL Open Font License 1.1:

- Golos Text — `@fontsource-variable/golos-text`
- Literata — `@fontsource-variable/literata`
- Cousine — `@fontsource/cousine`
