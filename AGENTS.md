# AgentOS your own Docker host template

This is a thin application over Agno. Keep application wiring and policy here;
generic manager behavior belongs in Agno. `CLAUDE.md` links to this file.

## Working rules

- Read the relevant source and inspect `git status` before editing. Preserve unrelated
  changes and keep work within the requested scope.
- Agno owns OS Manager (`os-manager-internal`), its members, source tools, Studio,
  Company Manager (`company-manager-internal`), authorization, durable execution and sandbox lifecycle.
  Configure `OSManager(root=REPO_ROOT)` in `agno/app/main.py`; do not recreate these components
  or add application-owned queues, lifecycle code or Company state machines.
- Application-owned HTTP routes are allowed only for product actions that do not call an LLM,
  under `/api/v1/`, added by `attach_api` to the app that `agent_os.get_app()` returns, before the
  MCP mount at the root (see `openspec/context/ADR/ADR-002-own-routes-via-base-app.md`). Do not pass
  `base_app`: with it Agno drops its error handlers for its own routes. Every other API surface stays
  with Agno; today the own routes are `/api/v1/me`, the story routes (stories, documents, texts,
  drafts, notes, comments, suggestions, saves, files, import, search), the writing statistics of a draft
  (`/api/v1/drafts/{id}/writing`) and the marks of the co-author's answers (`/api/v1/coauthor-feedback`).
- Check framework behavior against the Agno version pinned in `agno/pyproject.toml`.
  Do not bypass framework rejections or add compatibility adapters to this template.
- Keep the starter lean. Add abstractions, tests and infrastructure only for a concrete
  application need. Never print or commit credentials.

## Parallel sessions

`main` is the only long-lived branch; releases come only from it (openspec/specs/dev-workflow).

- The main checkout (the repository root, not a worktree) stays on `main` and is for reading and
  `git pull` only: do not edit or commit there.
- Every session works in its own worktree under `.claude/worktrees/`, created from `origin/main`, in a
  branch `claude/<change>`, and reaches `main` only through a pull request.
- Changes in `git status` that you did not make belong to another session: do not revert,
  format, stage or commit them.
- Never run `git stash`, `git reset --hard`, `git checkout -- <path>`, `git restore`, `git clean`,
  switch branches, `git add -A` or `git commit -a`. Stage and commit only your own files, by path.
- Do not run `./scripts/format.sh` in a shared checkout; format only the files you changed.
- Docker, the database and ports are shared: `dev.sh reset-db`, `docker compose down` and
  container restarts only with the user's approval.
- The local stand (Compose project `authorled`) belongs to the main checkout: only there `dev.sh up|db|stop|reset-db`
  start or stop it. From a worktree the other `dev.sh` commands use the running stand without starting, stopping or
  recreating it, and their own databases `ai_test_<worktree>` (`test`) and `ai_dev_<worktree>` (`migrate`, `api`,
  `seed`, `psql`); `.env` of a worktree is a link to the `.env` of the main checkout
  (`ln -sf <main checkout>/.env .env`). Do not run `docker compose up` for the stand from a worktree.
- One session works on one OpenSpec change, from apply to merge.
- Two hooks in `.claude/settings.json` remind of this flow and change nothing:
  `scripts/hook_session_start.sh` warns when a session starts in the main checkout or the main checkout is
  not on `main`; `scripts/hook_stop.sh` asks the session once to finish verify and archive when all tasks of
  a change its branch touched are checked and the change is not archived.

## OpenSpec is mandatory

Every change to code, configuration, agents, prompts, evals or behavior goes through an
OpenSpec change in `openspec/changes/`, even when the request is a plain "do X".

The flow from discussion to code:

1. Discuss: propose concrete solutions with a recommendation; the user approves or
   corrects them. Do not edit code during the discussion.
2. Business intent: once the user approves, write the agreed decisions to
   `business-intents/<slug>.md` in the format of the existing intents (status line,
   Why, What Changes, Scope, Non-goals, Constraints, Acceptance criteria, Risks,
   Open Questions, References), then stop.
3. OpenSpec: the user runs `/opsx:propose`, `/opsx:update` and `/opsx:apply` themselves.
   Do not start them on your own; when a request needs code and no active change covers it,
   say so and point to the intent. Inside a command the user started, follow its skill; keep
   `/opsx:apply` within `tasks.md` and ask the user to run `/opsx:update` when the plan must change.
4. Finish in the same session, without a separate command of the user, once every task of
   `tasks.md` is checked. This rule is the user's standing permission to commit, push and merge
   in this step:
   1. Verify (skill `openspec-verify-change`). On any CRITICAL issue stop and show the issues.
   2. Archive (skill `openspec-archive-change`, specs synced) in the same branch; name the
      WARNING and SUGGESTION issues in the report.
   3. Merge `origin/main` into the branch (`git merge`, not rebase); on a conflict stop and ask.
   4. Run `./scripts/validate.sh`, `git diff --check` and the tests the change needs; on a failure
      stop and name the failed check.
   5. Commit your own files by path, push, open the pull request into `main`, wait for its checks
      with `gh pr checks <PR> --watch --fail-fast` and merge it with `gh pr merge <PR> --merge`.
   Do not create a release unless the user asks. The server check after a release goes in a small
   pull request of its own from a fresh `origin/main`; no `-archive` or `-close` branches.
- Exempt: typos, formatting, comments, edits under `openspec/` itself, and read-only
  questions or investigation (`/opsx:explore`). If unsure whether a request is exempt, ask.
- Also exempt: texts and images of the product site in `site/` (owner, 2026-11-08). New pages,
  forms, the build of `site/` and anything that touches the core go through OpenSpec; a doubtful edit too.

## Workflows

Read the relevant local skill before starting. Slash commands refer to coding-agent
workflows in `.agents/skills/`; `.claude/skills` links to that directory.

| Task | Skill |
| --- | --- |
| First local setup | [setup-platform](.agents/skills/setup-platform/SKILL.md) |
| Add an agent | [create-agent](.agents/skills/create-agent/SKILL.md) |
| Change an agent or add a Studio capability | [extend-agent](.agents/skills/extend-agent/SKILL.md) |
| Add behavioral coverage | [create-evals](.agents/skills/create-evals/SKILL.md) |
| Repair evals or explore and improve agent behavior | [eval-and-improve](.agents/skills/eval-and-improve/SKILL.md) |
| Review repository consistency and public readiness | [review-and-improve](.agents/skills/review-and-improve/SKILL.md) |
| Deploy or change production configuration | [deploy-platform](.agents/skills/deploy-platform/SKILL.md) |

## Where changes belong

- `agno/app/main.py`: AgentOS registration, shared database, OS Manager, Company and queue.
- `agno/app/api/`: own product routes (`me.py`; `stories.py`, `notes.py`, `review.py`, `saves.py`, `files.py`, `search.py` for stories;
  `writing.py` for the writing statistics of a draft; `feedback.py` for the marks «Полезно» and «Не то» of the
  co-author's answers) and their
  `application/problem+json` errors, handled only for the product's own exception types (`Problem`, `core/errors.py`).
  `body.py`: JSON body, `If-Match`, the caller and the project access check every story route does first.
- `agno/app/auth/` and `auth/`: the auth module. `agno/app/auth/` is the only code that reads JWT
  or claims (other code uses `Principal`, `current_principal`, `run_principal` for agent tools, `Identity`,
  `current_identity`, `can_access_project` and, for the co-author eval on the local stand, `dev_writer_caller`; the core registers the project access source in `app/main.py`);
  `auth/` holds the Authentik blueprints, database init, key export and its services in
  `auth/compose.yaml`, which `compose.yaml` includes; Authentik runs as separate
  containers. `./scripts/check_auth_boundary.sh` (part of `validate.sh`) enforces the boundary
  and that the blueprint groups match `GROUP_SCOPES` (token contract in `openspec/specs/auth`).
- `agno/app/interfaces.py`: MCP OAuth, `agno` and built-in MCP tools.
- `agno/app/tracing.py`: the journal of agent runs (openspec/specs/agent-tracing): an own, non-global TracerProvider
  with Agno's instrumentor sends spans without text to Phoenix (`PHOENIX_URL`, required, checked at startup); Agno's trace
  tables are not written. A lost batch is logged as an error and the run goes on (owner, 2026-11-09).
- `agno/app/company.py`: Product and Source declarations. `agno/app/config.yaml`: component
  descriptions, quick prompts and optional additional Products.
- `agno/app/registry.py`: Studio palette, web tools, shared knowledge, learning and notes.
  `agno/app/settings.py`: application model factories.
- `agno/app/sandbox.py`: providers, repository URL/branch and checkpoint paths.
- `agno/agents/`: application agents, including the Claude engineer (Claude Code on DeepSeek) and the co-author
  with its tools (`coauthor_tools.py`: read and search the story of the conversation, propose an edit of the screenplay, and by
  the author's request change notes (also save a file of the conversation as a note, and write a research brief for an
  outside Deep Research), documents and comments;
  long notes are read in parts of 20 000 characters; in-process functions that call the core; every changing
  call pauses the run until the chat answers it, the author in the co-author mode `ask`, the chat itself in `auto`;
  the list is static, AgentOS 3.1.10 refuses tools built per run; the document tools type profile fields as strings
  and list the fields of each kind from `FIELD_HINTS` in `core/fields.py`) and its hooks (`coauthor_usage.py`: the limit check before a run, the usage journal
  after it). The co-author never deletes, trashes or decides; the screenplay text changes only by suggestions.
  `agno/skills/<agent_id>/SKILL.md`: an agent's prompt as an Anthropic Agent Skill (`name` equals the id,
  the body is the prompt), loaded by `agents/prompts.py`; restart the API after editing it. The co-author's prompt holds
  a short help about the service (section «О сервисе «Соавтор»»): a change to a screen it describes updates it too.
  `agno/teams/`: the place for the application's teams; the folder does not exist yet and appears with the first
  registered team (the routing exam builds its teams in `agno/evals/routing/` and does not register them).
- `agno/db/`: cached OS database and distinct knowledge content adapters.
- `agno/core/`: the product core, independent of Agno: `connection.py` (database URL from `DB_*`),
  `tables.py` (tables of schema `authorled`: users and settings, stories, drafts, documents, texts, notes, snapshots and points, review, files,
  requests for the beta and the journal of written words),
  `engine.py` (the core's own connection pool), `users.py` (account operations), `projects.py`, `drafts.py`,
  `documents.py`, `fields.py`, `texts.py`, `notes.py`, `snapshots.py`, `saves.py`, `review.py`, `files.py`, `search.py`, `imports.py` and
  `importers/` (stories, their equal drafts and the documents of a draft, the editor text with revisions, notes of a story, snapshots
  of a document and points of a draft, comments and suggestions, uploads, search of a draft and its story, manuscript import;
  a note made from a file keeps it as its original, purpose `note`, counted against the place of the user's plan), `clamav.py` (antivirus
  client), `errors.py` (refusals the routes answer with), `writing.py` (words of the screenplay by one rule shared with
  `web/src/editor/wordCount.cases.json`, the words the author's saves add by period of 15 minutes, days in the reader's
  time zone, the daily goal and the goal of a story), `feedback.py` (the author's marks of the co-author's
  answers by run, the report of the marks; the route gives it the conversation of the run from billing) and `prose.py`
  (the Markdown of the synopsis on `markdown-it-py`: a heading deeper than the second level is refused, the search reads
  the text without markup; examples shared with `web/src/editor/prose/markdown.cases.json`). The core
  never calls billing. `agno/migrations/` and
  `agno/alembic.ini`: Alembic for schema `authorled` only, forward-only, one head; never migrate Agno or Authentik
  schemas there.
  `agno/tests/`: pytest for the core and billing on real PostgreSQL (`./scripts/dev.sh test`).
- `agno/billing/`: the billing module (openspec/specs/billing/module), kept apart to become a service later. Its only
  entrance is `billing/__init__.py`: operations with plain values, each in its own transaction (`ensure_subscription`,
  `check_limit`, `storage_limit`, `record_runs`, `recorded_run_ids`, `run_session`, `report`, `set_plan`, prices). Inside:
  `plans.py` with the data files `plans.toml` and `model_prices.toml` (plans with the coauthor's limit in rubles and the
  place for originals of notes `storage_mb`, model prices in rubles; a broken file or a co-author
  model without a price stops startup), `subscriptions.py` (one active subscription per user, its periods and renewal),
  `usage.py` (the usage journal, the limit check and the report), `tables.py` (schema `billing`, a user kept by value,
  no keys to other schemas), `connection.py` and `engine.py` (its own pool from the same `DB_*`). `billing/migrations/`
  and `billing/alembic.ini`: its own Alembic chain, run after the core; `b0001_from_core` moved the tables out of
  `authorled`. Billing imports nothing of the core, `app/`, `agents/`, the commands or Agno, and others import only
  `billing`; `./scripts/check_billing_boundary.sh` (part of `validate.sh`) enforces it. The application layer joins
  them: `GET /api/v1/me` gives the subscription, the co-author's hooks find the user of the core and call billing.
- `agno/evals/`: application cases and the Agno eval CLI entrypoint.
- `agno/demo/`: `python -m demo`, the loader of the demo stories through the core; `./scripts/dev.sh seed` runs it. Their
  content is `web/src/data/demo.json`, shared with the `fixtures` data source.
- `agno/admin/`: `python -m admin report|set-plan <e-mail> <plan>|coauthor-feedback`, the administrator's commands over billing and the
  core (it joins the spending of billing with the e-mails of the core);
  `./scripts/usage.sh local|prod` runs them in the API container.
- `scripts/`: local setup, validation and builds. Deployment files: `compose.prod.yaml`, `deploy/` (the release
  script, the checks of the frontend build, of the deployed site and of the admin interface, and the Caddy configuration;
  `scripts/admin_cert.sh` makes the owner's client certificate for `admin.soavtor.app`) and `.github/workflows/deploy.yml`.
- `web/`: the frontend (Vite + React + TypeScript, thin client without its own database, ADR-001/ADR-004).
  `web/src/design-system/`: tokens, themes, fonts and base components; screens use only its
  semantic tokens (`./web/scripts/check_web_tokens.sh` rejects raw colors). `web/src/components/ui/`:
  shadcn/ui components generated by its CLI.
  `web/src/data/`: the data of the screens through Refine — `apiProvider.ts` over `apiClient.ts` (source `api`,
  the routes `/api/v1` of the core with revisions for `If-Match`) or `fixturesProvider.ts` (sample data), chosen by
  `VITE_DATA_SOURCE`. `web/src/editor/`: the screenplay editor; it exports only, the core imports manuscripts;
  `anchors.ts` places co-author suggestions by scene `uid` and quote. `web/src/editor/prose/`: the prose editor of the
  synopsis (openspec/specs/web/prose-editor): ProseMirror with paragraphs, two levels of headings, bold and italic, kept
  as Markdown in the field `synopsis`; the toolbar, the count of A4 pages, the marks of page starts and the print all
  take one layout (`layout.ts`) in the font Tinos of the build.
- `site/`: the product site (openspec/specs/web/site): static pages prerendered to HTML (`scripts/prerender.mjs`,
  checked by `scripts/check-build.mjs`), no server and no data of its own. The documents of the service (offer,
  policy, pricing on `/legal/offer/`, `/legal/privacy/`, `/pricing/`) are rendered from `docs/legal/*.md`. It imports the tokens and fonts of
  `web/src/design-system` (so its build needs `web/node_modules`) and takes `SITE_ORIGIN` and `SITE_APP_URL` from
  `.env`. Its beta request form posts to `/os/api/v1/beta-requests` on its own origin: the route `app/api/beta.py`,
  the only product route without a token (`PUBLIC_ROUTES` in `app/auth/authorization.py`), stores requests in the
  core (`core/beta_requests.py`); `./scripts/usage.sh local|prod beta-requests` lists them. A release deploys it to
  `soavtor.app` (`deploy/Caddyfile`: static files, of the API only the beta request route; `deploy/check_site.sh`
  checks it); the sign-in screen of `web/` links to it through `SITE_ORIGIN`. Landing skills: `landing-page-design`, `copywriting`, `unslop`; motion — `design-to-motion` (existing frames), `stageshow` (faux UI); Russian copy — `chukovsky`.
- `compose.yaml`: local PostgreSQL, the LiteLLM proxy, the antivirus ClamAV (`clamav`, required by the API through
  `CLAMAV_HOST` and `CLAMAV_PORT`), Phoenix, the journal of agent runs (`phoenix` on `127.0.0.1:6006`, schema `phoenix`
  under its own role prepared by `phoenix-db-init` from `agno/phoenix/init.sql` with `PHOENIX_DB_PASSWORD`; the API waits
  for it, in production it is reached only through an SSH tunnel) and development API. The API connects
  as the non-superuser role `agentos` (`AGENTOS_DB_PASSWORD`), prepared by `agentos-db-init`
  from `agno/db/init.sql` (schemas `ai`, `authorled` and `billing`); the one-shot `agentos-migrate` then
  applies the core migrations and then those of billing, and the API starts only after it succeeds. `agno/litellm/config.yaml`:
  model aliases and provider keys of the proxy. `agno/Dockerfile`: shared API and sandbox dependencies.

## Local development

Run commands from the repository root. Copy `example.env` to `.env` only if absent,
fill its Required block (LiteLLM, DeepSeek, GigaChat and Cloud.ru keys, `EMBEDDINGS_MODEL`, `AGENTOS_DB_PASSWORD`, `PHOENIX_DB_PASSWORD`, and the Authentik and `AUTH_*`
settings), check that the committed
`agno/litellm/certs/ca-bundle.pem` exists (rebuild: `./agno/scripts/build_ca_bundle.sh`), then use `docker compose -p authorled up -d --build` (name the project: `compose.yaml` has no `name:`, so without `-p` Compose takes the folder name). Compose exposes ports
on loopback; token checks are on in `dev` too, so API calls need a token from Authentik
(README, "Module auth"; `./scripts/auth_check.sh` checks the chain).

To run the API on the host with `--reload`, start the stand in the main checkout with `./scripts/dev.sh up`
(Postgres, LiteLLM, ClamAV, Phoenix, Authentik and Mailpit in Docker, not the `agentos-api` container), then use
`./scripts/dev.sh api`: it needs port 8000 free (it never stops `agentos-api` itself), migrates the schemas of the core
and billing on the host and exports the Authentik keys before the API starts. `./scripts/dev.sh migrate` applies the
migrations of the core and billing on the host; `./scripts/dev.sh test` runs the core tests on a fresh test database, never
on `ai`. The main checkout uses `ai` and `ai_test`, a worktree `ai_dev_<worktree>` and `ai_test_<worktree>`; the
commands except `up` and `db` need the stand running and stop with a message otherwise. New migration: `alembic revision --rev-id <NNNN>_<what> -m "..."` from `agno/`,
written by hand to match `agno/core/tables.py`; a migration of billing: `alembic -c billing/alembic.ini revision
--rev-id b<NNNN>_<what> -m "..."`, written by hand to match `agno/billing/tables.py`.
`./scripts/dev.sh seed` loads the demo stories for the development users into the database of the checkout after
`auth-users` (and, in a worktree, `migrate`). `./scripts/dev.sh db|stop|reset-db --yes` manage the database in the
main checkout (`reset-db` also wipes the Authentik data); `./scripts/dev.sh psql` opens the database of the checkout;
`.env` is required for every command because `compose.yaml` interpolates the whole file.

For Python development:

```sh
./agno/scripts/venv_setup.sh
source agno/.venv/bin/activate
./scripts/format.sh
./scripts/validate.sh
```

For frontend development (Node.js from `web/.nvmrc`):

```sh
npm ci --prefix web
npm run dev --prefix web
```

The product site (needs `web/node_modules`, `SITE_ORIGIN`, `SITE_APP_URL` and, for the dev server, `AGENTOS_URL`
in `.env`; it serves on `127.0.0.1:5174`):

```sh
npm ci --prefix site
npm run dev --prefix site
```

`validate.sh` stops before any check unless `python`, `ruff`, `mypy` and `alembic` come from one project environment
(activate `agno/.venv`; CI uses the runner's Python). It also checks the frontend and the site and fails while `web/node_modules` or `site/node_modules` is missing. `web/package.json`
pins exact versions; commit `web/package-lock.json`; the same for `site/`.

`agno/pyproject.toml` declares dependencies. Regenerate `agno/requirements.txt` with
`./agno/scripts/generate_requirements.sh`; do not add `uv.lock`. Use `uv run --no-project`
outside the activated environment. Both Dockerfile targets install the same pinned
requirements; rebuild both after dependency changes.

## Agents and storage

Follow the Agent shape in `create-agent`: stable ID, explicit instructions/tools,
`default_model()`, shared DB, history and datetime. Register code agents and teams in
`agno/app/main.py`, their prompts in `agno/skills/<agent_id>/SKILL.md` and their descriptions and
quick prompts in `agno/app/config.yaml`. Put new Studio capabilities in `agno/app/registry.py`;
import shared resources from there.

OS, Company, queue, agents and teams must reuse `get_postgres_db()` with no arguments.
Knowledge content adapters need distinct IDs; never create a second adapter with the OS ID.

- `shared_knowledge`: operator documents.
- `shared_learning`: per-user profiles and memories; attach when an agent should remember users.
- `shared_notes.tools()`: a PostgreSQL notebook with read/write, append, replace, list,
  search and move tools. User scoping follows AgentOS user isolation.
- Company wiki: Company knowledge.
- Product agents: declare a separate knowledge base on demand; do not use operator
  documents or shared notes as their product knowledge.

Company Products contain Projects and Routines; Tasks belong to Projects. On the current
pin, Product metadata PATCH replaces the whole dictionary. Preserve existing metadata.
`agno/app/company.py` declares `agentos-maintenance` for every day at 09:00 UTC, executed by
Company Manager (`company-manager-internal`, executor type `agent`). It reviews Agno
releases and this codebase and proposes up to three Backlog Tasks, reusing existing
proposals. Its instructions prohibit accepting or executing work; `auto_accept=False`.
Scheduled reviews spend model calls. Verify the saved creator, schedule, authorization
and run history before relying on them; declarations do not overwrite saved edits.
On the current pin a Routine declared in `agno/app/company.py` has no owner and no saved
authority, and every run of it is refused with `403 Insufficient permissions for scheduled
target`. `scripts/routines_authorize.sh` (app password of the service account `sa-routines`,
group `routines`, on stdin) saves the authority of `sa-routines` in every declared Routine
through `PATCH /company/routines/{id}` with the same executor; instructions, cron and executor
stay. Run it after the first release with a new Routine and whenever a Routine is created
again; a change of `GROUP_SCOPES` needs no new run. To stop a Routine, pause it
(`POST /company/routines/{id}/pause`) with a token of `sa-routines`.

Company writes are governed by permission scopes, not record ownership; `user_id`
records the creator. Task run sessions retain their ownership checks. Manual triggers
for auto-accept Routines require the acceptance grantor.

The current pin permits Company Manager as a Routine executor; OS Manager and its
specialists remain excluded. Before adding a Routine, verify executor support and
the caller's authorization. Do not register internal manager members to bypass
executor restrictions.

## Engineers and sandboxes

Keep the engineer's stable ID and explicit model alias. `claude-engineer` is the only
engineer: Claude Code on `deepseek-thinking` through the LiteLLM proxy's Anthropic
endpoint, configured by `ClaudeAgentOptions(env=...)` in `agno/agents/engineers.py`; it needs
no Anthropic key. It runs in the absolute project root on the AgentOS server when no
sandbox is configured. A configured
sandbox owns its repository checkout; invalid configuration must fail rather than fall
back to server execution. Keep provider configuration in `agno/app/sandbox.py` and agent
declarations in `agno/agents/engineers.py`.

Select the provider by returning `None`, `docker_sandbox()`, or
`agentcore_sandbox("runtime-arn")` from `sandbox_provider()`. Sandbox selection, image
and runtime ARN are code settings, not environment switches. Supply optional Bedrock
settings or private-repository credentials explicitly through the provider's `env`;
never put credential values in source. In a sandbox, `LITELLM_URL` must be an address
of the proxy reachable from inside the sandbox (agno/docs/sandboxes.md).

For Docker engineering, run the API on the host using the [sandbox setup guide](agno/docs/sandboxes.md#local-docker-sandbox).
Build the sandbox with `docker build --target sandbox --load -t agno-sandbox:local -f agno/Dockerfile .`.
Development checkpoints use the absolute project `tmp/checkpoints` path. Production
AgentCore requires a persistent `/data` mount; provision its runtime with AWS tooling.
The deploy layer does not attach `/data` checkpoint storage by default; `compose.prod.yaml`
carries a commented `agentos-checkpoints` named volume for `/data`. Enable it and put AWS
credentials in `.env` before enabling AgentCore; otherwise leave it disabled. Compose passes
`.env` through unchanged, so `sk-***` placeholder lines must be filled or deleted.

`REPOSITORY` in `agno/app/sandbox.py` defaults to `None`. Set it to a `Repository` with
the user's URL and branch before enabling a sandbox; startup rejects a sandbox
without a repository. Direct server execution does not need one. Company always
declares the local readable Source and only declares a remote Git Source when
`REPOSITORY` is set. Company sandbox acceptance requires a saved Product Git Source
matching `REPOSITORY.url`; retain the local readable Source.
New Source declarations are seeded without replacing saved edits. The pinned framework
supports sandbox HTTP admission through the durable PostgreSQL queue with session ordering.

## Production and saved state

Use the deployment skill and [deployment instructions](README.md#deploy-in-production).
Deployment target: your own Docker host. Preserve its deploy layer and provider-specific
settings. Keep one API instance, persistent PostgreSQL and production token verification.
Use the production env file described in the README; never deploy `RUNTIME_ENV=dev`.
Review existing resources before provisioning and verify deployment after changes.

Before removing or renaming components in an existing deployment, inspect saved schedules
and Studio references. Removing a declaration does not remove persisted records. Preserve
historical sessions, notes and Company work; migrate saved references deliberately.

## Verification

`./scripts/validate.sh` checks formatting, lint and types, the boundaries of the modules `auth` and billing, that the
migrations of the core and of billing have one head each,
and for `web/` also builds the app and checks design tokens and their contrast; CI uses the same command.
`./scripts/dev.sh test` runs pytest for the core on real PostgreSQL (not in CI yet).
Also run `git diff --check`. Keep evals in `agno/evals/__main__.py` and `agno/evals/cases.py`, using
Agno's `criteria` and `expected_tool_calls`. Do not add a bundled regression suite or
custom isolation, scorers or cleanup machinery by default. The exceptions are the routing exam
in `agno/evals/routing/` (its own case set and scoring, owner 2026-11-08,
`business-intents/coauthor-orchestrator-domains.md`) and the co-author measurement in `agno/evals/coauthor/`
(its own sample, demo case set, summary and code checks of the expected action and facts, Agno's judge; owner
2026-11-08, `business-intents/coauthor-quality-eval.md`; its measurement of actions with code checks and no judge,
owner 2026-11-08, `business-intents/coauthor-tool-contracts.md`).

- `python -m evals --tag smoke`: runs the three application cases and spends model calls.
  Uses the application's `.env`, database and workspace; sessions and results persist
  for the AgentOS UI. The CLI requires `RUNTIME_ENV` (`dev` or `prd`, no default) and does not
  start the API or scheduler. Even `--help` and `--list` require PostgreSQL because the
  application initializes knowledge storage on import, and a running Phoenix with `PHOENIX_URL` because it sets up the
  journal of agent runs on import (the same for `python -m evals.coauthor`).
- `python -m evals --tag coauthor`: runs the co-author case as the verified development user `writer`
  (`agno/evals/caller.py` over `dev_writer_caller` of the auth module); on the host only, after
  `./scripts/dev.sh auth-users` with `AUTH_DEV_WRITER_TOKEN`. It spends the limit of `writer`.
- Inspect answers, tool results and judge reasons. Additional tool calls are allowed;
  these cases do not enforce read-only execution. Use owned fixtures for mutating cases.
- `python -m evals.routing --domains base|wide --split work|holdout --variant team|team-route|skills --model <alias>`
  (from `agno/`; `.env` gives it `LITELLM_URL=http://127.0.0.1:4000`): the routing exam of the orchestrator on
  domain stubs; spends model calls, needs the LiteLLM proxy but no database, writes its report to `tmp/routing/` (`agno/evals/routing/README.md`).
- `python -m evals.coauthor setup` (once) and `python -m evals.coauthor run --set wide | --set demo --part work|holdout|checks|docs`
  `--all | --sample N [--repeat K]` (from `agno/`, with the `DB_*` of `./scripts/dev.sh api`, in a worktree its
  `ai_dev_<worktree>`): the real co-author answers
  the sample of the routing exam's wide set or the own demo cases on demo stories of its own user, changes only
  proposed and rejected, judged by `claude-sonnet`; spends model calls, writes its report to `tmp/coauthor-eval/`.
  `python -m evals.coauthor compare <before.json> <after.json>` compares two reports without model calls;
  `python -m evals.coauthor rejudge <report.json> --domain <domain>` judges one domain again from the saved answers
  (`agno/evals/coauthor/README.md`).
- `python -m evals.coauthor actions-setup` (once) and `python -m evals.coauthor actions-run --all | --sample N` (from
  `agno/`, with the same `DB_*`): the measurement of actions — the real co-author runs the requests of
  `agno/evals/coauthor/actions.toml` on a fresh copy of a demo draft of its own user, every action confirmed and
  applied by the core, checked by code (refusals, attempts, fields, changes nobody asked for); spends model calls,
  writes its report to `tmp/coauthor-actions/`.
- `./scripts/mcp_check.sh`: initializes MCP and checks required tools without model calls.
  `--prompt` spends model calls. Set `MCP_CHECK_HOST=1` for the host API.
- Verify direct engineer execution, HTTP execution, team delegation and Company Task
  acceptance/completion separately. API startup does not establish these capabilities.

- The journal of agent runs: open Phoenix at `http://127.0.0.1:6006` (on the server through
  `ssh -L 6006:127.0.0.1:6006 authorled`); a run is one trace with the agent run as its root, without texts.

Record checks and limits in `tmp/VERIFY.md`, separating static, deterministic, model,
container and hosted results. Do not infer deployed readiness from local checks.
