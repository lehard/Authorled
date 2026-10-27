# Authorled web

Frontend of Authorled: React + TypeScript on Vite, shadcn/ui on Tailwind CSS (ADR-001, ADR-004).
For now it holds the design system and its showcase.

```sh
npm ci            # Node.js from .nvmrc
npm run dev       # showcase at http://127.0.0.1:5173
```

- `src/design-system/` — tokens (`tokens.css`), fonts, type scale, paper, decorations and base
  components. Screens import from `@/design-system`. Rules: `openspec/specs/web/design-system`.
- `src/components/ui/` — shadcn/ui components, added with `npx shadcn@4.22.2 add <name>`.
- `scripts/check-contrast.ts` — WCAG contrast of token pairs in every theme.

Checks run from the repository root with `./scripts/validate.sh`.

## Font licenses

Bundled from Fontsource packages, all under the SIL Open Font License 1.1:

- Golos Text — `@fontsource-variable/golos-text`
- Literata — `@fontsource-variable/literata`
- Cousine — `@fontsource/cousine`
