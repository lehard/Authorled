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
  with Agno; today the own routes are `/api/v1/me` and the story routes (stories, documents, texts,
  drafts, notes, comments, suggestions, saves, files, import).
- Check framework behavior against the Agno version pinned in `agno/pyproject.toml`.
  Do not bypass framework rejections or add compatibility adapters to this template.
- Keep the starter lean. Add abstractions, tests and infrastructure only for a concrete
  application need. Never print or commit credentials.

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
3. OpenSpec: the user runs `/opsx:propose`, `/opsx:update`, `/opsx:apply`, `/opsx:verify`
   and `/opsx:archive` themselves. Do not start them on your own; when a request
   needs code and no active change covers it, say so and point to the intent.
   Inside a command the user started, follow its skill; keep `/opsx:apply` within
   `tasks.md` and ask the user to run `/opsx:update` when the plan must change.
- Exempt: typos, formatting, comments, edits under `openspec/` itself, and read-only
  questions or investigation (`/opsx:explore`). If unsure whether a request is exempt, ask.

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
- `agno/app/api/`: own product routes (`me.py`; `stories.py`, `notes.py`, `review.py`, `saves.py`, `files.py` for stories) and their
  `application/problem+json` errors, handled only for the product's own exception types (`Problem`, `core/errors.py`).
  `body.py`: JSON body, `If-Match`, the caller and the project access check every story route does first.
- `agno/app/auth/` and `auth/`: the auth module. `agno/app/auth/` is the only code that reads JWT
  or claims (other code uses `Principal`, `current_principal`, `run_principal` for agent tools, `Identity`,
  `current_identity` and `can_access_project`; the core registers the project access source in `app/main.py`);
  `auth/` holds the Authentik blueprints, database init, key export and its services in
  `auth/compose.yaml`, which `compose.yaml` includes; Authentik runs as separate
  containers. `./scripts/check_auth_boundary.sh` (part of `validate.sh`) enforces the boundary
  and that the blueprint groups match `GROUP_SCOPES` (token contract in `openspec/specs/auth`).
- `agno/app/interfaces.py`: MCP OAuth, `agno` and built-in MCP tools.
- `agno/app/company.py`: Product and Source declarations. `agno/app/config.yaml`: component
  descriptions, quick prompts and optional additional Products.
- `agno/app/registry.py`: Studio palette, web tools, shared knowledge, learning and notes.
  `agno/app/settings.py`: application model factories.
- `agno/app/sandbox.py`: providers, repository URL/branch and checkpoint paths.
- `agno/agents/`: application agents, including the Claude engineer (Claude Code on DeepSeek) and the co-author
  with its tools (`coauthor_tools.py`: read the story of the conversation, propose an edit of the screenplay, and by
  the author's request change notes, documents and comments; in-process functions that call the core; every changing
  call pauses the run until the chat answers it, the author in the co-author mode `ask`, the chat itself in `auto`;
  the list is static, AgentOS 3.1.10 refuses tools built per run) and its hooks (`coauthor_usage.py`: the limit check before a run, the usage journal
  after it). The co-author never deletes, trashes or decides; the screenplay text changes only by suggestions.
  `agno/skills/<agent_id>/SKILL.md`: an agent's prompt as an Anthropic Agent Skill (`name` equals the id,
  the body is the prompt), loaded by `agents/prompts.py`; restart the API after editing it.
  `agno/teams/`: the place for the application's teams; the folder does not exist yet and appears with the first
  registered team (the routing exam builds its teams in `agno/evals/routing/` and does not register them).
- `agno/db/`: cached OS database and distinct knowledge content adapters.
- `agno/core/`: the product core, independent of Agno: `connection.py` (database URL from `DB_*`),
  `tables.py` (tables of schema `authorled`: users and settings, stories, drafts, documents, texts, notes, snapshots and points, review, files,
  subscriptions and the usage journal),
  `engine.py` (the core's own connection pool), `users.py` (account operations), `projects.py`, `drafts.py`,
  `documents.py`, `fields.py`, `texts.py`, `notes.py`, `snapshots.py`, `saves.py`, `review.py`, `files.py`, `imports.py` and
  `importers/` (stories, their equal drafts and the documents of a draft, the editor text with revisions, notes of a story, snapshots
  of a document and points of a draft, comments and suggestions, uploads, manuscript import), `clamav.py` (antivirus
  client), `errors.py` (refusals the routes answer with), `plans.py` with the data files `plans.toml` and
  `model_prices.toml` (plans and model prices in rubles; a broken file or a co-author model without a price stops
  startup), `subscriptions.py` (one active subscription per user, its periods and renewal) and `usage.py` (the usage
  journal, the limit check and the report). `agno/migrations/` and `agno/alembic.ini`: Alembic for
  schema `authorled` only, forward-only, one head; never migrate Agno or Authentik schemas there.
  `agno/tests/`: pytest for the core on real PostgreSQL (`./scripts/dev.sh test`).
- `agno/evals/`: application cases and the Agno eval CLI entrypoint.
- `agno/demo/`: `python -m demo`, the loader of the demo stories through the core; `./scripts/dev.sh seed` runs it. Their
  content is `web/src/data/demo.json`, shared with the `fixtures` data source.
- `agno/admin/`: `python -m admin report|set-plan <e-mail> <plan>`, the administrator's commands over the core;
  `./scripts/usage.sh local|prod` runs them in the API container.
- `scripts/`: local setup, validation and builds. Deployment files: `compose.prod.yaml`, `deploy/` (the release
  script, the check of the frontend build and the Caddy configuration) and `.github/workflows/deploy.yml`.
- `web/`: the frontend (Vite + React + TypeScript, thin client without its own database, ADR-001/ADR-004).
  `web/src/design-system/`: tokens, themes, fonts and base components; screens use only its
  semantic tokens (`./web/scripts/check_web_tokens.sh` rejects raw colors). `web/src/components/ui/`:
  shadcn/ui components generated by its CLI.
  `web/src/data/`: the data of the screens through Refine — `apiProvider.ts` over `apiClient.ts` (source `api`,
  the routes `/api/v1` of the core with revisions for `If-Match`) or `fixturesProvider.ts` (sample data), chosen by
  `VITE_DATA_SOURCE`. `web/src/editor/`: the screenplay editor; it exports only, the core imports manuscripts;
  `anchors.ts` places co-author suggestions by scene `uid` and quote.
- `compose.yaml`: local PostgreSQL, the LiteLLM proxy, the antivirus ClamAV (`clamav`, required by the API through
  `CLAMAV_HOST` and `CLAMAV_PORT`) and development API. The API connects
  as the non-superuser role `agentos` (`AGENTOS_DB_PASSWORD`), prepared by `agentos-db-init`
  from `agno/db/init.sql` (schemas `ai` and `authorled`); the one-shot `agentos-migrate` then
  applies the core migrations, and the API starts only after it succeeds. `agno/litellm/config.yaml`:
  model aliases and provider keys of the proxy. `agno/Dockerfile`: shared API and sandbox dependencies.

## Local development

Run commands from the repository root. Copy `example.env` to `.env` only if absent,
fill its Required block (LiteLLM, DeepSeek, GigaChat and Cloud.ru keys, `EMBEDDINGS_MODEL`, `AGENTOS_DB_PASSWORD`, and the Authentik and `AUTH_*`
settings), check that the committed
`agno/litellm/certs/ca-bundle.pem` exists (rebuild: `./agno/scripts/build_ca_bundle.sh`), then use `docker compose up -d --build`. Compose exposes ports
on loopback; token checks are on in `dev` too, so API calls need a token from Authentik
(README, "Module auth"; `./scripts/auth_check.sh` checks the chain).

To run the API on the host with `--reload`, use `./scripts/dev.sh api` (Postgres, LiteLLM and
Authentik in Docker; it migrates the core schema and exports the Authentik keys before the API starts).
`./scripts/dev.sh migrate` applies the core migrations; `./scripts/dev.sh test` runs the core tests on a
fresh database `ai_test`, never on `ai`. New migration: `alembic revision --rev-id <NNNN>_<what> -m "..."` from `agno/`,
written by hand to match `agno/core/tables.py`.
`./scripts/dev.sh seed` loads the demo stories for the development users into `ai` after `auth-users`.
`./scripts/dev.sh db|stop|reset-db --yes|psql` manage the database (`reset-db` also wipes the
Authentik data);
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

`validate.sh` stops before any check unless `python`, `ruff`, `mypy` and `alembic` come from one project environment
(activate `agno/.venv`; CI uses the runner's Python). It also checks the frontend and fails while `web/node_modules` is missing. `web/package.json`
pins exact versions; commit `web/package-lock.json`.

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

`./scripts/validate.sh` checks formatting, lint and types, that the core migrations have one head,
and for `web/` also builds the app and checks design tokens and their contrast; CI uses the same command.
`./scripts/dev.sh test` runs pytest for the core on real PostgreSQL (not in CI yet).
Also run `git diff --check`. Keep evals in `agno/evals/__main__.py` and `agno/evals/cases.py`, using
Agno's `criteria` and `expected_tool_calls`. Do not add a bundled regression suite or
custom isolation, scorers or cleanup machinery by default. The exceptions are the routing exam
in `agno/evals/routing/` (its own case set and scoring, owner 2026-11-08,
`business-intents/coauthor-orchestrator-domains.md`) and the co-author measurement in `agno/evals/coauthor/`
(its own sample, demo case set, summary and code checks of the expected action and facts, Agno's judge; owner
2026-11-08, `business-intents/coauthor-quality-eval.md`).

- `python -m evals --tag smoke`: runs the three application cases and spends model calls.
  Uses the application's `.env`, database and workspace; sessions and results persist
  for the AgentOS UI. The CLI defaults to `dev` unless configured otherwise and does not
  start the API or scheduler. Even `--help` and `--list` require PostgreSQL because the
  application initializes knowledge storage on import.
- Inspect answers, tool results and judge reasons. Additional tool calls are allowed;
  these cases do not enforce read-only execution. Use owned fixtures for mutating cases.
- `python -m evals.routing --domains base|wide --split work|holdout --variant team|team-route|skills --model <alias>`
  (from `agno/`; `.env` gives it `LITELLM_URL=http://127.0.0.1:4000`): the routing exam of the orchestrator on
  domain stubs; spends model calls, needs the LiteLLM proxy but no database, writes its report to `tmp/routing/` (`agno/evals/routing/README.md`).
- `python -m evals.coauthor setup` (once) and `python -m evals.coauthor run --set wide | --set demo --part work|holdout`
  `--all | --sample N [--repeat K]` (from `agno/`, with the `DB_*` of `./scripts/dev.sh api`): the real co-author answers
  the sample of the routing exam's wide set or the own demo cases on demo stories of its own user, changes only
  proposed and rejected, judged by `claude-sonnet`; spends model calls, writes its report to `tmp/coauthor-eval/`.
  `python -m evals.coauthor compare <before.json> <after.json>` compares two reports without model calls
  (`agno/evals/coauthor/README.md`).
- `./scripts/mcp_check.sh`: initializes MCP and checks required tools without model calls.
  `--prompt` spends model calls. Set `MCP_CHECK_HOST=1` for the host API.
- Verify direct engineer execution, HTTP execution, team delegation and Company Task
  acceptance/completion separately. API startup does not establish these capabilities.

Record checks and limits in `tmp/VERIFY.md`, separating static, deterministic, model,
container and hosted results. Do not infer deployed readiness from local checks.
