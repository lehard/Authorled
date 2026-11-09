# AgentOS: The Agent Platform That Builds Itself

AgentOS is a durable agent runtime that serves agents over API and MCP.
Build agents for your product, your team, or yourself. Run them in your own cloud,
keep their data in your own database, and manage them from [AgentOS](https://os.agno.com).

Built with [Agno](https://github.com/agno-agi/agno), this template gives you a working
agent platform that you can run locally or deploy to your own Docker host.

**Three ways to build agents.**

1. **Use a coding agent.** Open the repo in Claude Code, Codex, or Cursor. The included
   skills help it create, test, and improve your agents.
2. **Describe what you need.** Chat with OS Manager, the built-in agent that helps you
   manage the platform and build new agents.
3. **Use Studio.** Build agents visually in [AgentOS Studio](https://os.agno.com).

**Two ways to use your agents.**

1. **In your product.** Call your agents through the REST API.
2. **In AI apps.** Connect apps such as Claude and ChatGPT through MCP.

The AgentOS UI lets you chat with your agents, review past conversations, and see
the steps an agent took. Your PostgreSQL database stores conversations, memories,
and Company work.

## Get started

Copy this prompt into your coding agent:

```text
Help me set up my agent platform and build my first agent.

Clone https://github.com/agno-agi/agentos-docker into a folder called agent-platform,
cd into it, and follow .agents/skills/setup-platform/SKILL.md.
```

It checks Docker, helps you add your API key, starts the platform, and walks you
through building your first agent. Already cloned the repo? Ask your coding agent
to follow [setup-platform](.agents/skills/setup-platform/SKILL.md) in that folder.

Prefer to set it up yourself? Follow the steps below.

## Run locally

You'll need Git, Docker with Compose, a DeepSeek API key, an embeddings provider key (Cloud.ru Foundation Models or GigaChat API credentials) and the choice of embedding model.
Make sure Docker is running.
Run the commands below in a terminal.

### 1. Start the platform

```sh
git clone https://github.com/agno-agi/agentos-docker agent-platform
cd agent-platform
cp example.env .env
```

Open `.env` and fill the Required block: `LITELLM_MASTER_KEY`, `LITELLM_API_KEY`,
`DEEPSEEK_API_KEY`, `GIGACHAT_CREDENTIALS`, `GIGACHAT_SCOPE`, `CLOUDRU_API_KEY`, `EMBEDDINGS_MODEL` and `AGENTOS_DB_PASSWORD` (password
of the database role `agentos` the API connects with), and the block of the
[auth module](#module-auth): `AUTHENTIK_SECRET_KEY`, `AUTHENTIK_DB_PASSWORD`,
`AUTHENTIK_BOOTSTRAP_EMAIL`, `AUTHENTIK_BOOTSTRAP_PASSWORD`, `AUTH_FRONTEND_CLIENT_ID`,
`AUTH_FRONTEND_REDIRECT_URI`, `AUTH_DEV_SERVICE_TOKEN`, `AUTH_BRAND_DOMAIN` and `AUTH_ISSUER`. The CA bundle for
GigaChat (the Russian Trusted CA) ships in `agno/litellm/certs/ca-bundle.pem` (see [Models](#models)). Then start the platform:

```sh
docker compose up -d --build
```

The first build can take a few minutes: Authentik applies its migrations and blueprints, and the
one-shot `agentos-migrate` applies the migrations of the product schema `authorled` and then those of the
billing schema `billing`, before the API starts. If a migration fails, `agentos-migrate` exits non-zero and the API does not start
(`docker compose logs agentos-migrate`). `./scripts/dev.sh migrate` reruns the migrations alone,
`./scripts/dev.sh test` runs the core tests on a separate database `ai_test`. When it's ready, open [http://localhost:8000/docs](http://localhost:8000/docs)
to see the API. Authorization is on in every environment, so API calls need a token from
Authentik (see [Module auth](#module-auth)); `./scripts/auth_check.sh` checks the chain.

Uploaded files (chat attachments, manuscript import) are checked by the antivirus ClamAV before
anything reads them. Compose starts it as `clamav` (image `clamav/clamav-debian`, about 1–1.5 GB of
memory) and the API waits until it is healthy. The first start downloads the signature databases
and can take a few minutes; they are kept in the volume `clamav-db` and updated by the container.
Check that it answers:

```sh
printf 'zPING\0' | nc -w 3 127.0.0.1 3310
```

The answer is `PONG`. The API reads its address from `CLAMAV_HOST` and `CLAMAV_PORT` and refuses
to start without them; Compose and `./scripts/dev.sh` set both.

Check that AI apps can connect through MCP (export `MCP_CHECK_TOKEN` first, see
[Module auth](#module-auth)):

```sh
./scripts/mcp_check.sh
```

The check should report `9 tools; required tools available`.

### Develop with the API on the host

For code changes without rebuilding the image, run PostgreSQL, LiteLLM, ClamAV and Authentik in Docker
and the API on your computer with `--reload` (needs [uv](https://docs.astral.sh/uv/) and a filled
`.env`). The command also exports the Authentik keys to `auth/jwks/jwks.json` before
the API starts:

```sh
./scripts/dev.sh api
```

Other commands: `./scripts/dev.sh db` starts only PostgreSQL and waits until it is healthy,
`stop` stops the services and keeps the data, `psql` opens `psql` in the database,
`reset-db --yes` deletes the database volume, including the Authentik data. `.env` is needed even
for `db`: Compose requires the LiteLLM and Authentik settings for every service.

### 2. Connect the UI

1. Open [os.agno.com](https://os.agno.com) and sign in.
2. Choose **Connect OS**, select a local connection, and enter `http://localhost:8000`.
3. Name it **Local AgentOS**, then open the chat for **OS Manager**.

The API accepts only tokens issued by Authentik, so the connection needs one. How AgentOS UI
obtains it is not settled yet (`openspec/changes/auth-module/design.md`, Open Questions); until
then use `curl` or the scripts with a token as described in [Module auth](#module-auth).

### 3. Build your first agent

Tell OS Manager what you want to build. For example:

> Help me build an agent that answers questions about my product. Here's the documentation URL: …

Review what it proposes, then ask it to build and publish the agent.
Refresh the Agents list and try it out. You can chat with your new agent directly
or ask OS Manager to run it for you.

## Build and improve your agents

You can keep working through OS Manager, use Studio, or edit Python files in this repo.
The repo includes instructions, called skills, for common coding tasks.
Ask your coding agent to follow the relevant skill:

| What you want to do | Skill |
| --- | --- |
| Build an agent | [/create-agent](.agents/skills/create-agent/SKILL.md) |
| Add a tool, change behavior, or fix a bug | [/extend-agent](.agents/skills/extend-agent/SKILL.md) |
| Write tests for your agent's answers | [/create-evals](.agents/skills/create-evals/SKILL.md) |
| Fix failing tests or try more scenarios | [/eval-and-improve](.agents/skills/eval-and-improve/SKILL.md) |
| Check the repo before sharing or releasing it | [/review-and-improve](.agents/skills/review-and-improve/SKILL.md) |

If you write an agent in Python, put it in `agno/agents/` and add it to
[agno/app/main.py](agno/app/main.py) so the platform can run it. Set its description and
suggested prompts in [agno/app/config.yaml](agno/app/config.yaml). To make a tool or model
available in Studio, add it to [agno/app/registry.py](agno/app/registry.py).

You can give agents documents to search, a notebook to keep notes, and memory
to remember each user. Keep a product's documentation in its own knowledge base,
separate from the platform's documents.

## Company

Company organizes ongoing work. A **Product** is what you're working on, a
**Project** groups related work, and a **Task** is one piece of work to complete.
A **Routine** is a set of instructions that can run on a schedule.

This template includes an **AgentOS** Product for improving the platform itself.
To get started, ask OS Manager:

> Review this codebase and recent Agno releases. Suggest the most useful improvements.

It also includes a daily review at **09:00 UTC**. Company Manager reads the code
and Agno release notes, then proposes up to three Tasks for you to review.
The review is instructed to suggest work and leave approval and execution to you.
Automatic acceptance is off.

Scheduled reviews use your model API keys and incur usage costs. Check the saved
schedule and run history in Company to see when a review will run and what it did.

[agno/app/company.py](agno/app/company.py) sets the initial review instructions and schedule.
Once they're saved in the database, update the saved Routine to change them;
editing the Python file alone won't change an existing Routine.

## Engineers

The platform includes **Claude Engineer**: Claude Code running on DeepSeek through
the LiteLLM proxy. It can read your code, make changes, and run commands.

Chat with it in AgentOS, or ask OS Manager to use it:

> Ask Claude Engineer to review this project and suggest improvements. Don't change any files yet.

It uses the proxy settings you added during setup and needs no Anthropic key. After
changing `.env`, run `docker compose up -d` again.

By default, engineers work in this project's folder. When running locally with
Docker Compose, their file changes appear in your local checkout. Review those
changes before committing them.

You don't need to configure a sandbox or repository URL to get started.

To have engineers work on a separate copy of your repository, follow the
[sandbox setup guide](agno/docs/sandboxes.md) for Docker or AWS AgentCore.

## Make it yours

To save your work in your own GitHub repository, create an empty private repo.
From a fresh clone of this template, run the commands below with your repo URL.
This makes `origin` your repo and keeps the original template as `upstream`:

```sh
git remote rename origin upstream
git remote add origin https://github.com/YOUR-ORG/YOUR-REPO.git
git push -u origin HEAD
```

Future pushes go to your repository. You can still fetch updates from `upstream`
and review them before merging.

If you use sandboxes, also set the repository URL and branch in
[the sandbox configuration](agno/docs/sandboxes.md#choose-your-repository).

<a id="deploy-in-production"></a>

## Deploy in production

Ask your coding agent to follow [deploy-platform](.agents/skills/deploy-platform/SKILL.md),
or use the steps below. For an existing deployment, read the [upgrade guide](agno/docs/upgrading.md) first.

You'll need Docker Compose 2.24.4 or newer and a stable public HTTPS URL routed
to port 8000 on your host. Use a reverse proxy on the host or an HTTPS tunnel.

### 1. Configure the host

Production Compose reads `.env`. Fill the Required block (`LITELLM_MASTER_KEY`,
`LITELLM_API_KEY`, `DEEPSEEK_API_KEY`, `GIGACHAT_CREDENTIALS`, `GIGACHAT_SCOPE`, `CLOUDRU_API_KEY`,
`EMBEDDINGS_MODEL`),
place `agno/litellm/certs/ca-bundle.pem`, and set `AGENTOS_URL` to your public HTTPS URL,
a strong `DB_PASS` (password of the bootstrap superuser of PostgreSQL, used only by the init
services and administration), a strong `AGENTOS_DB_PASSWORD` (the role `agentos` the API
connects with), and `MCP_CONNECT_SECRET` (generate one with
`openssl rand -base64 32`). Compose passes the file through unchanged, so replace
every `***` placeholder: a placeholder reaches the containers as a real value and
model calls fail on authentication.

For an existing database, changing `DB_PASS` in `.env` does not change the database
password. Update the database password separately; do not delete the data volume.
`AGENTOS_DB_PASSWORD` is applied by `agentos-db-init` (`agno/db/init.sql`) on every `up`; on an
existing database the same step makes `agentos` the owner of schema `ai` and its tables.

### 2. Set up authentication

Fill the auth block of `.env` (see [Module auth](#module-auth)): strong values for
`AUTHENTIK_SECRET_KEY`, `AUTHENTIK_DB_PASSWORD`, `AUTHENTIK_BOOTSTRAP_PASSWORD` and
`AUTH_DEV_SERVICE_TOKEN`, the real redirect URI of the frontend in
`AUTH_FRONTEND_REDIRECT_URI`, `AUTH_BRAND_DOMAIN` (the Authentik host name) and `AUTH_ISSUER` set to the public address of Authentik plus
`/application/o/authorled/`. Sign-up stays closed until the list of allowed e-mails is set in the
admin interface (see [Module auth](#module-auth), «Admin interface»). Authentik listens on `127.0.0.1:9000`: publish it on its own
HTTPS domain through the reverse proxy of the host (set `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS`
for the proxy's address range). The Authentik data lives in the `authentik` schema of the same
database, so the database backup covers it.

### 3. Start the production services

```sh
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
```

The production override turns on token checks and runs the code built into the
image. `agentos-migrate` applies the migrations of the product schema `authorled` and of `billing` before the API
starts, on every deploy; migrations only go forward, so back up the database before deploying a
version with new migrations. Keep one API container. The API and database ports bind to loopback; your
reverse proxy or tunnel must reach the API from the host.

Check `/health` and `/docs` on your public URL. Confirm `/agents` rejects requests
without a token, then connect through the AgentOS UI with a valid token.

### Connect your AI apps

Use your public URL followed by `/mcp` as the connector URL in an AI app.
When prompted, enter the `MCP_CONNECT_SECRET` saved in your production env file.
For a supported coding client, run:

```sh
uvx agno connect --url https://YOUR-DOMAIN
```

Try asking OS Manager about the platform to check that the connection works.

### Update or stop the deployment

Run the same `up -d --build` command after changing code or settings. View logs or
stop the services with:

```sh
docker compose -f compose.yaml -f compose.prod.yaml logs -f agentos-api
docker compose -f compose.yaml -f compose.prod.yaml down
```

`down` keeps the database volume. Adding `-v` deletes it and all stored data.

### Deploy by release

A published GitHub release from `main` goes to the server by itself
(`.github/workflows/deploy.yml`). Pushes to `main` do not touch the server. The workflow checks the
tag with `./scripts/validate.sh`, builds the frontend and the product site (`site/`), sends both to the
server and runs `deploy/deploy.sh`: database copy, code of the tag, `up -d --build`, the new frontend and
site, Caddy reload. Then it checks the public `/os/health`, that `/os/agents` refuses a request without a
token, and the site with `deploy/check_site.sh` (the home page, the policy, a 404 and an empty beta request
that the API refuses). The site is served on `soavtor.app` as static files; of the API only
`/os/api/v1/beta-requests` is reachable there.
It never loads demo stories or development users. A failed step leaves the run red and rolls nothing back.

Release a version, or go back to an earlier one by running the same steps with its tag:

```sh
gh release create v0.1.0 --target main --generate-notes
gh workflow run deploy.yml -f tag=v0.1.0
```

Releases before `v0.3.5` have no `site/`, so the current workflow cannot build them. To go back to one of
them, run the workflow of that tag itself: `gh workflow run deploy.yml --ref v0.3.4 -f tag=v0.3.4`. Such a
release brings back its own Caddy configuration, where `soavtor.app` redirects to the service.

The rollback does not touch the database. If the newer release had migrations, restore the copy from
before it. This loses what was written after the copy:

```sh
cd /srv/authorled/app
docker compose -p authorled -f compose.yaml -f compose.prod.yaml stop agentos-api authentik-server authentik-worker
docker compose -p authorled -f compose.yaml -f compose.prod.yaml exec -T agentos-db \
  pg_restore -U ai -d ai --clean --if-exists --exit-on-error < /srv/authorled/backups/<copy>.dump
docker compose -p authorled -f compose.yaml -f compose.prod.yaml up -d
```

The last 10 copies stay in `/srv/authorled/backups`, on the same disk as the database.

#### Prepare the server once

Docker, Caddy, git and rsync must be installed. As root, with the settings already in
`/etc/authorled/authorled.env` (the `.env` of the server, outside the repository):

```sh
adduser --disabled-password --gecos '' deploy
usermod -aG docker deploy
install -d -o deploy -g deploy -m 755 /srv/authorled /srv/authorled/web /srv/authorled/web/incoming
install -d -o deploy -g deploy -m 755 /srv/authorled/site /srv/authorled/site/incoming
install -d -o deploy -g deploy -m 700 /srv/authorled/backups
sudo -u deploy git clone https://github.com/lehard/Authorled.git /srv/authorled/app
chown root:deploy /etc/authorled /etc/authorled/authorled.env
chmod 750 /etc/authorled
chmod 640 /etc/authorled/authorled.env
sudo -u deploy ln -s /etc/authorled/authorled.env /srv/authorled/app/.env
echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl reload caddy' > /etc/sudoers.d/deploy-caddy
chmod 440 /etc/sudoers.d/deploy-caddy
echo 'import /srv/authorled/app/deploy/Caddyfile' > /etc/caddy/Caddyfile
```

`deploy/Caddyfile` must already be in the clone. Give `deploy` an SSH key of its own, used only by GitHub.
Membership in the group `docker` is nearly root, so keep this key only in the GitHub secret.

Create the GitHub Environment `production`, allow it only for tags `v*` and the branch `main`, and fill it.
A missing value stops the run with its name before the server is touched.

| Name | Kind | Value |
| --- | --- | --- |
| `DEPLOY_HOST` | secret | Address of the server |
| `DEPLOY_SSH_KEY` | secret | Private key of the user `deploy` |
| `DEPLOY_KNOWN_HOSTS` | secret | Host key lines of the server, from `ssh-keyscan` |
| `PUBLIC_URL` | variable | Public address of the frontend, without a trailing slash |
| `AUTH_ISSUER`, `AUTH_FRONTEND_CLIENT_ID`, `AUTH_FRONTEND_REDIRECT_URI`, `AUTH_FRONTEND_LOGOUT_URI` | variable | The same values as in the settings of the server |
| `VITE_DATA_SOURCE` | variable | `api` |
| `SITE_ORIGIN` | variable | Public address of the product site, `https://soavtor.app`; the frontend links to it from the sign-in screen |
| `SITE_APP_URL` | variable | Address of the service that «Войти» of the site opens, `https://app.soavtor.app` |

### Sandbox storage

Local Docker sandbox instructions are in the [sandbox guide](agno/docs/sandboxes.md).
The production deployment does not attach sandbox checkpoint storage by default.
Before enabling AWS AgentCore, enable the commented `agentos-checkpoints` volume in
[compose.prod.yaml](compose.prod.yaml) so it is mounted at `/data` on the API
container, put the AWS credentials AgentCore needs in `.env`, and restart. If you
skip the volume, leave AgentCore disabled. Keep one API instance.

## Verify and develop

To check your Python code and test agent responses, install [uv](https://docs.astral.sh/uv/)
and run these commands from the project folder. Keep the local platform running.
If another Python environment is active, run `deactivate` first.

```sh
./agno/scripts/venv_setup.sh
source agno/.venv/bin/activate
./scripts/validate.sh
python -m evals --tag smoke
```

The repository has four modules: the backend in `agno/`, the frontend in `web/`, the
Authentik configuration in `auth/` and the product site in `site/`; the root holds what they share (`compose.yaml`, `.env`,
`openspec/`, `scripts/`). The Python environment lives in `agno/.venv`. If you still have a
`.venv` at the repository root from before the backend moved to `agno/`, delete it and run
`./agno/scripts/venv_setup.sh` again.

`validate.sh` checks Python formatting, lint rules, and types, and builds and checks the frontend. It first checks that
`python`, `ruff`, `mypy` and `alembic` come from one environment of the project (`agno/.venv` here, the Python of the
runner in CI) and stops before any check if they do not. The smoke tests ask
OS Manager to explain setup, check platform health, and explain agent memory.
They use your model API keys and save results in the database for review in the UI.
PostgreSQL must be running, even when you only want to list the tests. The evals import the
application, so on the host they also need the auth settings in `.env` (`AUTH_ISSUER`,
`AUTH_FRONTEND_CLIENT_ID`) and `JWT_JWKS_FILE` pointing at the exported keys
(`auth/jwks/jwks.json`, written by `./scripts/dev.sh api` or
`docker compose run --rm authentik-jwks-export`); without them they stop with an error naming the
missing variable.

Add your own cases in [agno/evals/cases.py](agno/evals/cases.py), or use
[/create-evals](.agents/skills/create-evals/SKILL.md). To save a report, add
`--json-output tmp/evals.json`. To run one case, use `--name CASE_NAME`.
Evals use your application's database and workspace; agents can call tools during a test.

#### Evals of the co-author

`python -m evals --tag coauthor` runs the co-author as `writer@authorled.test`, like a run of the chat: the co-author
refuses a run without a verified user. Before the run the case takes a token of `writer` from the local Authentik with
the app password `AUTH_DEV_WRITER_TOKEN`, checks it like the API does, creates the account of `writer` in the core if
there is none and binds `writer` to the run. The usage limit is checked as usual and the run is written to the usage
journal of `writer`; when the limit is spent, the case fails with the limit message
(`./scripts/usage.sh local set-plan writer@authorled.test <plan>` raises it).

It needs `RUNTIME_ENV=dev`, a running local stand with Authentik, `AUTH_DEV_WRITER_TOKEN` in `.env` and
`./scripts/dev.sh auth-users` after setting it. Run it on the host: inside the API container the address of Authentik
in `AUTH_ISSUER` (`localhost:9000`) does not reach Authentik, and the case stops with an error naming that address.
Without the variable, with a refused token or outside `dev` the case fails before the model is called. The `smoke`
cases run without a user and need none of this.

### Frontend

The writer's interface lives in [web/](web/). Install [Node.js](https://nodejs.org/) 24
(the version in `web/.nvmrc`), then:

```sh
npm ci --prefix web
npm run dev --prefix web
```

The dev server opens the design-system showcase at http://127.0.0.1:5173.
`./scripts/validate.sh` checks the frontend too, so install its dependencies first.

### Product site

The public site of the product lives in [site/](site/): the main page, the policy for personal data and the request
for the closed beta. It is prerendered to static HTML and takes the tokens and fonts of `web/`, so install both:

```sh
npm ci --prefix web
npm ci --prefix site
npm run dev --prefix site    # http://127.0.0.1:5174
```

`.env` needs `SITE_ORIGIN` (the site's own address), `SITE_APP_URL` (the service «Войти» opens) and, for the dev
server, `AGENTOS_URL`: the form posts to `/os/api/v1/beta-requests` on the site's origin and the dev server passes it
to the API. `npm run build --prefix site` writes `site/dist/` and checks it (texts of the blocks, «Концепт» marks, images, scripts of the main page ≤ 120 KB gzip). The behaviour of the page (contradiction of the first screen, sandbox and its scene links, tabs and the suggestion card under them, hero card of the vision block, path, impact, keyboard, no JavaScript, reduced motion, 390 px) is checked in a real browser against `npm run preview --prefix site`: `SITE_URL=http://127.0.0.1:5174 CHROMIUM_PATH=<Chromium> npm run check:behaviour --prefix site` — a local check, not part of `validate.sh`. A release deploys the site to `soavtor.app`
(«Deploy by release»). The requests are listed by `./scripts/usage.sh local|prod beta-requests`.

Change dependencies in `agno/pyproject.toml`, then run `./agno/scripts/generate_requirements.sh`.
Commit the updated `agno/requirements.txt` and rebuild the API and any sandbox image you use.
See [AGENTS.md](AGENTS.md) for the code layout and development conventions.

## Models

Every model call goes through the LiteLLM proxy (`litellm` service, [agno/litellm/config.yaml](agno/litellm/config.yaml)).
The application uses only the proxy aliases:

| Alias | Provider model | Used by |
| --- | --- | --- |
| `deepseek-fast` | DeepSeek `deepseek-flash`, thinking off | Agents by default |
| `deepseek-thinking` | DeepSeek `deepseek-v4-pro`, thinking on | OS Manager, Company Manager, Claude Engineer |
| `gigachat-embeddings` | GigaChat API `Embeddings-2` (1024 dimensions) | Knowledge bases, when selected |
| `giga-embeddings` | Cloud.ru Foundation Models `ai-sage/Giga-Embeddings-instruct-480M` (1024 dimensions) | Knowledge bases, when selected |
| `bge-m3-embeddings` | Cloud.ru Foundation Models `BAAI/bge-m3` (1024 dimensions) | Knowledge bases, when selected |
| `qwen3-embeddings` | Cloud.ru Foundation Models `Qwen/Qwen3-Embedding-0.6B` (1024 dimensions) | Knowledge bases, when selected |

`EMBEDDINGS_MODEL` in `.env` picks the one embedding alias the API uses; it is required and has no
default, and an unknown value stops the API at startup. An error from the chosen alias is not
retried on another one. Only models with 1024 dimensions are accepted (the pgvector HNSW index
holds at most 2000), and the API rejects any vector of another size. To switch: change
`EMBEDDINGS_MODEL`, restart the API, **recreate the `shared_knowledge` table and upload the
documents again**: vectors of different models are incompatible even at the same size.

For `gigachat-embeddings` the proxy verifies GigaChat TLS with `agno/litellm/certs/ca-bundle.pem`: the certifi CA bundle
with the Russian Trusted Root CA and Sub CA appended. The file is committed; rebuild it with
`./agno/scripts/build_ca_bundle.sh` (active `.venv`) after a `certifi` update. Without that file
the proxy does not start. Cloud.ru Foundation Models (`https://foundation-models.api.cloud.ru/v1`, set in
the proxy configuration) uses a public certificate that the same bundle verifies.

`gigachat-embeddings` (`Embeddings-2`) reads at most 512 tokens, so knowledge bases declare readers that cut
documents into chunks of up to 1200 characters ([agno/db/__init__.py](agno/db/__init__.py)). URLs use
them automatically. When you upload a file, pass the reader explicitly: `reader_id`
(`pdf`, `docx`, `csv`, `excel`, `markdown`, `text`) in `POST /knowledge/content`, or
`chunker` with `chunk_size=1200`. Without it, Agno 3.1.10 reads the file with its default
reader and 5000-character chunks, which exceed that limit.

### Spending and plans

Every run of the co-author is checked against the limit of the user's subscription before the model is called and
written to the usage journal after it. Both belong to the billing module [agno/billing/](agno/billing/), a module
of its own with schema `billing` and its own migrations (`billing.usage_records`, costs in rubles by
[agno/billing/model_prices.toml](agno/billing/model_prices.toml)). Plans are data in
[agno/billing/plans.toml](agno/billing/plans.toml):
new accounts get `beta` (free, a month from sign-up, 500 ₽ a period, renews by itself). A broken data file or a
co-author model without a price stops the API at startup. The administrator reads the spending and changes plans
in the running API container:

```sh
./scripts/usage.sh prod report                       # on the server, from /srv/authorled/app
./scripts/usage.sh prod set-plan anna@example.com beta
./scripts/usage.sh prod beta-requests                # requests for the beta from the site
```

`local` instead of `prod` runs the same commands on the local stand. A new plan or price is a change of the data file
and a release; there are no limits of individual users.

## Module auth

Authentication and authorization are a module of this repository: [Authentik](https://goauthentik.io)
(sign-in with a code by e-mail, profile, password reset, groups, service accounts, admin interface) runs next to
the API, in the same database (schema `authentik`, own role; the API's role `agentos` has no
access to it). Its configuration is code in `auth/` (services in
`auth/compose.yaml`, included by `compose.yaml`; blueprints, database init, key export);
`agno/app/auth/` is the only code that reads tokens. The token claims and group names the API relies
on are the token contract in `openspec/specs/auth`. The API accepts only tokens issued by Authentik, in every environment.

- **Start.** `docker compose up -d --build` (or `./scripts/dev.sh api`) creates the schema and
  role, starts Authentik, applies the blueprints, exports the public keys to
  `auth/jwks/jwks.json` and only then starts the API. Authentik is on
  [http://localhost:9000](http://localhost:9000); the first administrator is `akadmin` with
  `AUTHENTIK_BOOTSTRAP_PASSWORD`.
- **Sign-in.** The web frontend has its own sign-in screens (`/login`): e-mail → password, only
  when the account has one → a 6-digit code by e-mail → OIDC tokens without Authentik pages.
  The screens walk the Authentik flow `authorled-authentication` through its flow executor API
  on the frontend's origin; «Выйти» revokes the tokens, runs the flow `authorled-invalidation`
  (ends the Authentik session) and opens `AUTH_FRONTEND_LOGOUT_URI`, all without Authentik pages.
  Locally the Vite dev server proxies `/api/v3/flows/executor/`, `/flows/-/cancel/` and
  `/application/o/revoke/` to Authentik. In production the reverse proxy of the frontend must
  forward the same three paths to Authentik, and `AUTHENTIK_COOKIE_DOMAIN`
  (the parent domain, e.g. `.example.com`) lets that session reach the Authentik domain.
- **Mail.** Authentik sends the codes over SMTP (`AUTHENTIK_EMAIL__*`). Locally that is the
  `mailpit` container: every e-mail shows at [http://localhost:8025](http://localhost:8025).
  Production does not run Mailpit; put a real SMTP server in `.env`.
- **Development users.** `./scripts/dev.sh auth-users` creates `writer@authorled.test`
  (`screenwriters`) and `editor@authorled.test` (`editors`) with the password
  `AUTH_DEV_USER_PASSWORD` and a confirmed e-mail code device. `writer` also gets the app password
  `AUTH_DEV_WRITER_TOKEN`, with which the eval of the co-author takes a token of `writer`
  ([Evals of the co-author](#evals-of-the-co-author)); without the variable the command stops and names it. In the dev server the sign-in
  screen has «Войти как Сценарист» and «Войти как Редактор»: they walk the same flow and take
  the code from Mailpit. Production builds do not contain these buttons. The command also opens the
  local sign-up to every address (`allowed_emails: ["*"]`, see «Admin interface»).
- **Demo stories.** `./scripts/dev.sh seed` loads the stories of `web/src/data/demo.json` into the
  local database `ai`, a copy for each development user. Run it after `auth-users` on a running,
  migrated stand. It refuses, and changes nothing, if a user already has a story with a demo
  title, in the trash too. The `fixtures` data source shows the same file.
- **Groups.** `screenwriters` and `editors` (authors; they may run only the product agent `coauthor`, scope `agents:coauthor:run`), `admins` (superusers, the only ones in the
  Authentik admin interface and with full API access), `plugins` (service accounts). What each
  group may call is in `agno/app/auth/authorization.py`.
- **Admin interface.** Authentik settings that change without a release are edited at
  `/if/admin/` of the Authentik host (in production `https://auth.soavtor.app/if/admin/`).
  Sign in as `akadmin`: the password is `AUTHENTIK_BOOTSTRAP_PASSWORD` from the env file of the
  server (it sets the password on the first start only; after a change in the profile the new one
  holds), the code comes to `AUTHENTIK_BOOTSTRAP_EMAIL`. Do not add personal accounts to `admins`:
  that group also gets the administrative scopes of the API.
  - *Owned by the admin interface* (the blueprints set them only when the object is created, a
    release keeps your edits): titles and names of the flows `authorled-authentication`,
    `authorled-enrollment` and `authorled-invalidation`, the title of the brand of
    `AUTH_BRAND_DOMAIN`, the subject of the code e-mail, the failed password attempts before the
    sign-in starts over; users, their groups and passwords.
  - *Owned by the repository* (a release that changes the blueprint file restores them; change them
    in `auth/blueprints/`): groups, the OIDC provider and application, the steps of the sign-in,
    sign-up and sign-out flows and their policies, the code lifetime (10 minutes) and its template,
    the sign-in flow of the brand, service accounts.
  - *Who may sign up.* Directory → Groups → `screenwriters` → Edit → Attributes. The list applies
    to the next sign-up attempt, no restart:

    ```yaml
    allowed_emails:
      - tester@example.com
      - another@example.com
    ```

    Comparison ignores case; `allowed_emails: ["*"]` opens the sign-up to everyone, `[]` closes it.
    Without the attribute, or when it is not a list of strings, every sign-up is refused with
    «Регистрация временно недоступна.» and Events show a `configuration_error` that names it.
    Removing an address does not block an existing account. Real addresses stay out of the
    repository.
- **Token for curl and scripts.** The service account `sa-dev` signs in with the secret
  `AUTH_DEV_SERVICE_TOKEN`:

  ```sh
  curl -s -X POST "$AUTHENTIK_URL/application/o/token/" \
    -d grant_type=client_credentials -d client_id="$AUTH_FRONTEND_CLIENT_ID" \
    -d "scope=openid profile email" -d username=sa-dev -d password="$AUTH_DEV_SERVICE_TOKEN"
  ```

  `AUTHENTIK_URL` must be the address from `AUTH_ISSUER` (without `/application/o/...`):
  a token requested through another host name has another issuer and is rejected. Send the
  `access_token` as `Authorization: Bearer ...`; for `./scripts/mcp_check.sh` export it as
  `MCP_CHECK_TOKEN`.
- **Check.** `./scripts/auth_check.sh` gets that token and checks `401` (no token, forged
  signature), `200` and `403`.
- **Rotate the signing key.** After changing the signing key in Authentik, run
  `docker compose run --rm authentik-jwks-export` and restart `agentos-api`: tokens signed with
  the removed key are rejected after the restart.
- **Boundary.** `./scripts/validate.sh` fails when code outside `agno/app/auth/` touches JWT, claims
  or Authentik.

## Configuration

[example.env](example.env) shows the main settings. Start with its Required block;
add the others when you need them. Docker Compose reads `.env` for both local and production runs.

| Setting | What it's for |
| --- | --- |
| `LITELLM_MASTER_KEY` | Admin key of the LiteLLM proxy (required). |
| `LITELLM_API_KEY` | Key the API and Claude Engineer use to call the proxy (required). The proxy has no key database, so set it to the `LITELLM_MASTER_KEY` value. |
| `LITELLM_URL` | Proxy address for the API. Local Compose sets `http://litellm:4000`; set it yourself when the API runs on the host. |
| `DEEPSEEK_API_KEY` | DeepSeek models behind the proxy: agents, OS Manager, Company Manager and Claude Engineer (required). |
| `GIGACHAT_CREDENTIALS` and `GIGACHAT_SCOPE` | GigaChat Embeddings-2 behind the proxy, alias `gigachat-embeddings` (required). Scope is `GIGACHAT_API_PERS` or `GIGACHAT_API_B2B`. |
| `CLOUDRU_API_KEY` | Cloud.ru Foundation Models behind the proxy, a service account key: aliases `giga-embeddings`, `bge-m3-embeddings`, `qwen3-embeddings` (required). |
| `EMBEDDINGS_MODEL` | Active embedding alias for the API (required, no default); see [Models](#models). |
| `PARALLEL_API_KEY` | Optional web search key. Without it, search uses Parallel's MCP server without an API key. |
| `AUTHENTIK_SECRET_KEY`, `AUTHENTIK_DB_PASSWORD`, `AUTHENTIK_BOOTSTRAP_EMAIL`, `AUTHENTIK_BOOTSTRAP_PASSWORD` | Authentik server secret, password of its database role, first administrator (required, see [Module auth](#module-auth)). |
| `AUTH_FRONTEND_CLIENT_ID`, `AUTH_FRONTEND_REDIRECT_URI`, `AUTH_FRONTEND_LOGOUT_URI` | Client ID of the Authentik application (also the expected token audience), the frontend's redirect URI after sign-in and its sign-in screen after sign-out (required). |
| `AUTH_DEV_SERVICE_TOKEN` | Secret of the development service account `sa-dev` (required). |
| `AUTH_BRAND_DOMAIN` | Host of Authentik as users open it, with the port if the address has one (locally `localhost:9000`); the product sign-in flow applies to this host (required). |
| `AUTHENTIK_EMAIL__HOST`, `__PORT`, `__USERNAME`, `__PASSWORD`, `__USE_TLS`, `__USE_SSL`, `__FROM` | Outgoing mail of Authentik (sign-in codes); locally Mailpit (required; `USERNAME` and `PASSWORD` may be empty). `FROM` carries the sender name in quotes: `"Соавтор <noreply@example.com>"`. |
| `AUTHENTIK_COOKIE_DOMAIN` | Production only: parent domain of the product, so the session set through the frontend reaches Authentik (required by `compose.prod.yaml`). |
| `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS` | Production only: address range of the reverse proxy as Authentik sees it (required by `compose.prod.yaml`). A proxy on the host comes through the Docker gateway: `172.16.0.0/12`. |
| `AUTH_DEV_USER_PASSWORD` | Development only: password of the development users and the quick sign-in (`./scripts/dev.sh auth-users`). |
| `AUTH_DEV_WRITER_TOKEN` | Development only: app password of `writer@authorled.test`, set by `./scripts/dev.sh auth-users` and used by `python -m evals --tag coauthor` to take a token of `writer` (required by both; generate with `openssl rand -hex 24`). Compose does not need it. |
| `VITE_DATA_SOURCE` | Data source of the web frontend: `api` (stories in the core) or `fixtures` (sample data in page memory); required by the frontend. |
| `AUTH_ISSUER` | Issuer of the tokens: the address clients use to reach Authentik plus `/application/o/authorled/` (required). |
| `JWT_JWKS_FILE` | Public keys of Authentik, the only source of token verification keys. Compose writes the file at start and sets the path; set it yourself when the API or `python -m evals` runs on the host (`dev.sh api` does for the API). |
| `CLAMAV_HOST`, `CLAMAV_PORT` | Address of the antivirus that checks uploaded files (required by the API). Compose sets `clamav:3310`, `./scripts/dev.sh` sets `127.0.0.1:3310`; set them yourself for other host processes such as `python -m evals`. |
| `AGENTOS_URL` | Public URL used by scheduled jobs and MCP. Set it to your public HTTPS URL. |
| `MCP_CONNECT_SECRET` | Connect browser MCP clients. Generate it before deployment. |
| `AGENTOS_DB_PASSWORD` | Password of the database role `agentos` the API connects with (required; not a superuser, no access to schema `authentik`). |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_DATABASE` | PostgreSQL connection settings of the API. Compose and `./scripts/dev.sh api` set them (`DB_USER=agentos`); in the production `.env`, `DB_PASS` is the bootstrap superuser password. |
| `RUNTIME_ENV` | `prd` by default. Local Compose uses `dev`; token checks are on in both. |

## Learn more

- [Agno documentation](https://docs.agno.com)
- [Agno on GitHub](https://github.com/agno-agi/agno)
- [AgentOS UI](https://os.agno.com)
