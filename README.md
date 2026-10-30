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

You'll need Git, Docker with Compose, a DeepSeek API key, an embeddings provider key (Sber500 gateway or GigaChat API credentials) and the choice of embedding model.
Make sure Docker is running.
Run the commands below in a terminal.

### 1. Start the platform

```sh
git clone https://github.com/agno-agi/agentos-docker agent-platform
cd agent-platform
cp example.env .env
```

Open `.env` and fill the Required block: `LITELLM_MASTER_KEY`, `LITELLM_API_KEY`,
`DEEPSEEK_API_KEY`, `GIGACHAT_CREDENTIALS`, `GIGACHAT_SCOPE`, `SBER500_API_BASE`, `SBER500_API_KEY`, `EMBEDDINGS_MODEL` and `AGENTOS_DB_PASSWORD` (password
of the database role `agentos` the API connects with), and the block of the
[auth module](#module-auth): `AUTHENTIK_SECRET_KEY`, `AUTHENTIK_DB_PASSWORD`,
`AUTHENTIK_BOOTSTRAP_EMAIL`, `AUTHENTIK_BOOTSTRAP_PASSWORD`, `AUTH_FRONTEND_CLIENT_ID`,
`AUTH_FRONTEND_REDIRECT_URI`, `AUTH_DEV_SERVICE_TOKEN`, `AUTH_BRAND_DOMAIN` and `AUTH_ISSUER`. The CA bundle for
GigaChat (the Russian Trusted CA) ships in `agno/litellm/certs/ca-bundle.pem` (see [Models](#models)). Then start the platform:

```sh
docker compose up -d --build
```

The first build can take a few minutes: Authentik applies its migrations and blueprints before
the API starts. When it's ready, open [http://localhost:8000/docs](http://localhost:8000/docs)
to see the API. Authorization is on in every environment, so API calls need a token from
Authentik (see [Module auth](#module-auth)); `./scripts/auth_check.sh` checks the chain.

Check that AI apps can connect through MCP (export `MCP_CHECK_TOKEN` first, see
[Module auth](#module-auth)):

```sh
./scripts/mcp_check.sh
```

The check should report `9 tools; required tools available`.

### Develop with the API on the host

For code changes without rebuilding the image, run PostgreSQL, LiteLLM and Authentik in Docker
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
`LITELLM_API_KEY`, `DEEPSEEK_API_KEY`, `GIGACHAT_CREDENTIALS`, `GIGACHAT_SCOPE`, `SBER500_API_BASE`,
`SBER500_API_KEY`, `EMBEDDINGS_MODEL`),
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
`/application/o/authorled/`. Authentik listens on `127.0.0.1:9000`: publish it on its own
HTTPS domain through the reverse proxy of the host (set `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS`
for the proxy's address range). The Authentik data lives in the `authentik` schema of the same
database, so the database backup covers it.

### 3. Start the production services

```sh
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
```

The production override turns on token checks and runs the code built into the
image. Keep one API container. The API and database ports bind to loopback; your
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

The repository has three modules: the backend in `agno/`, the frontend in `web/` and the
Authentik configuration in `auth/`; the root holds what they share (`compose.yaml`, `.env`,
`openspec/`, `scripts/`). The Python environment lives in `agno/.venv`. If you still have a
`.venv` at the repository root from before the backend moved to `agno/`, delete it and run
`./agno/scripts/venv_setup.sh` again.

`validate.sh` checks Python formatting, lint rules, and types, and builds and checks the frontend. The smoke tests ask
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

### Frontend

The writer's interface lives in [web/](web/). Install [Node.js](https://nodejs.org/) 24
(the version in `web/.nvmrc`), then:

```sh
npm ci --prefix web
npm run dev --prefix web
```

The dev server opens the design-system showcase at http://127.0.0.1:5173.
`./scripts/validate.sh` checks the frontend too, so install its dependencies first.

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
| `giga-embeddings` | Sber500 gateway `giga-embeddings-instruct-480m` (1024 dimensions) | Knowledge bases, when selected |
| `bge-m3-embeddings` | Sber500 gateway `bge-m3` (1024 dimensions) | Knowledge bases, when selected |
| `qwen3-embeddings` | Sber500 gateway `qwen3-embedding-0.6b` (1024 dimensions) | Knowledge bases, when selected |

`EMBEDDINGS_MODEL` in `.env` picks the one embedding alias the API uses; it is required and has no
default, and an unknown value stops the API at startup. An error from the chosen alias is not
retried on another one. Only models with 1024 dimensions are accepted (the pgvector HNSW index
holds at most 2000), and the API rejects any vector of another size. To switch: change
`EMBEDDINGS_MODEL`, restart the API, **recreate the `shared_knowledge` table and upload the
documents again**: vectors of different models are incompatible even at the same size.

For `gigachat-embeddings` the proxy verifies GigaChat TLS with `agno/litellm/certs/ca-bundle.pem`: the certifi CA bundle
with the Russian Trusted Root CA and Sub CA appended. The file is committed; rebuild it with
`./agno/scripts/build_ca_bundle.sh` (active `.venv`) after a `certifi` update. Without that file
the proxy does not start. The Sber500 gateway uses a public certificate.

`gigachat-embeddings` (`Embeddings-2`) reads at most 512 tokens, so knowledge bases declare readers that cut
documents into chunks of up to 1200 characters ([agno/db/__init__.py](agno/db/__init__.py)). URLs use
them automatically. When you upload a file, pass the reader explicitly: `reader_id`
(`pdf`, `docx`, `csv`, `excel`, `markdown`, `text`) in `POST /knowledge/content`, or
`chunker` with `chunk_size=1200`. Without it, Agno 3.1.10 reads the file with its default
reader and 5000-character chunks, which exceed that limit.

## Module auth

Authentication and authorization are a module of this repository: [Authentik](https://goauthentik.io)
(sign-in, 2FA, profile, password reset, groups, service accounts, admin interface) runs next to
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
- **Groups.** `screenwriters` and `editors` (authors), `admins` (superusers, the only ones in the
  Authentik admin interface and with full API access), `plugins` (service accounts). What each
  group may call is in `agno/app/auth/authorization.py`.
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
| `SBER500_API_BASE` and `SBER500_API_KEY` | Sber500 gateway behind the proxy: aliases `giga-embeddings`, `bge-m3-embeddings`, `qwen3-embeddings` (required). |
| `EMBEDDINGS_MODEL` | Active embedding alias for the API (required, no default); see [Models](#models). |
| `PARALLEL_API_KEY` | Optional web search key. Without it, search uses Parallel's MCP server without an API key. |
| `AUTHENTIK_SECRET_KEY`, `AUTHENTIK_DB_PASSWORD`, `AUTHENTIK_BOOTSTRAP_EMAIL`, `AUTHENTIK_BOOTSTRAP_PASSWORD` | Authentik server secret, password of its database role, first administrator (required, see [Module auth](#module-auth)). |
| `AUTH_FRONTEND_CLIENT_ID`, `AUTH_FRONTEND_REDIRECT_URI` | Client ID of the Authentik application (also the expected token audience) and the frontend's redirect URI (required). |
| `AUTH_DEV_SERVICE_TOKEN` | Secret of the development service account `sa-dev` (required). |
| `AUTH_BRAND_DOMAIN` | Host name of Authentik as users open it (no port); sign-in on this host requires a second factor (required). |
| `AUTH_ISSUER` | Issuer of the tokens: the address clients use to reach Authentik plus `/application/o/authorled/` (required). |
| `JWT_JWKS_FILE` | Public keys of Authentik, the only source of token verification keys. Compose writes the file at start and sets the path; set it yourself when the API or `python -m evals` runs on the host (`dev.sh api` does for the API). |
| `AGENTOS_URL` | Public URL used by scheduled jobs and MCP. Set it to your public HTTPS URL. |
| `MCP_CONNECT_SECRET` | Connect browser MCP clients. Generate it before deployment. |
| `AGENTOS_DB_PASSWORD` | Password of the database role `agentos` the API connects with (required; not a superuser, no access to schema `authentik`). |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_DATABASE` | PostgreSQL connection settings of the API. Compose and `./scripts/dev.sh api` set them (`DB_USER=agentos`); in the production `.env`, `DB_PASS` is the bootstrap superuser password. |
| `RUNTIME_ENV` | `prd` by default. Local Compose uses `dev`; token checks are on in both. |

## Learn more

- [Agno documentation](https://docs.agno.com)
- [Agno on GitHub](https://github.com/agno-agi/agno)
- [AgentOS UI](https://os.agno.com)
