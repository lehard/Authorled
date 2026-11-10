---
name: deploy-platform
description: Deploy this AgentOS using its own provider instructions, configure JWT verification, and verify the public service. Use for first deployment, redeployment, or production configuration changes.
---

# Deploy the Platform

Read `AGENTS.md`, the README deployment section, and this repository's deploy
configuration and scripts. Use those files to identify the provider and its exact
commands, required CLI versions, environment file, and teardown behavior.
Do not assume every template has deploy scripts or supports the same flags.
For Docker or an existing Kubernetes cluster, follow the repository's Compose or
Helm instructions.

Never print credentials, the MCP connect secret or the Authentik secrets. The Authentik public
keys (`auth/jwks/jwks.json`) are public and may be shared to complete configuration.

## 1. Prepare

- Check the required tools and the authenticated provider account. Interactive
  logins belong in the user's terminal.
- Confirm the intended workspace, account, project, region, or cluster context
  before making changes. Use the inputs required by this repository's commands.
- Set up the project environment if the deploy scripts need it. Use the production
  env file documented in the README; create it from `example.env` only if absent.
  Configure credentials without printing them: the LiteLLM, DeepSeek, GigaChat and Cloud.ru
  keys and `EMBEDDINGS_MODEL` from the Required block of `example.env`, and `agno/litellm/certs/ca-bundle.pem`
  on the host. Replace every `***` placeholder. Check how the deploy scripts load
  settings rather than assuming they read `.env` or exported shell variables.
- Keep production authentication enabled. Do not upload `RUNTIME_ENV=dev`.
  Set strong `DB_PASS` (bootstrap superuser), `AGENTOS_DB_PASSWORD` (role `agentos` of the API) and
  `PHOENIX_DB_PASSWORD` (role `phoenix` of the journal of agent runs; `phoenix-db-init` applies it on every `up`).
  Tokens come from Authentik (module `auth`, services in `auth/compose.yaml`): fill the auth block of
  the production env file with strong values (`AUTHENTIK_SECRET_KEY`, `AUTHENTIK_DB_PASSWORD`,
  `AUTHENTIK_BOOTSTRAP_PASSWORD`, `AUTH_DEV_SERVICE_TOKEN`), the frontend's `AUTH_FRONTEND_*`
  values, `AUTH_BRAND_DOMAIN` (host name of Authentik), `AUTH_ADMIN_DOMAIN` (host of the admin interface, `admin.soavtor.app`) and `AUTH_ISSUER` (public HTTPS address of Authentik plus `/application/o/authorled/`).
  On a new server sign-up stays closed until `akadmin` sets `allowed_emails` of the group `screenwriters`
  in the admin interface (README, Module auth, «Admin interface»); real addresses stay out of the repository.
  `authentik-jwks-export` writes `JWT_JWKS_FILE` at start; the API does not start without it.
- If a sandbox is requested, configure its provider and `REPOSITORY` in
  `agno/app/sandbox.py` using the [sandbox setup guide](../../../agno/docs/sandboxes.md).
  AgentCore needs an existing runtime, host AWS access, and persistent checkpoints at `/data`. Confirm the
  deployment target supports that mount before enabling it. Use volume flags only
  if this repository's deploy scripts support them. Bedrock settings and private
  repository credentials must be supplied explicitly through the provider's `env`.
  Never put secret values in source.
- Remove retired `SANDBOX_ENABLED`, `SANDBOX_IMAGE`, and `SANDBOX_RUNTIME_ARN`
  settings; they no longer select a provider. Keep one API replica and the
  always-running process needed by the scheduler.

## 2. Choose first deployment or update

The production server is updated by publishing a GitHub release from `main`
(`.github/workflows/deploy.yml`, `deploy/deploy.sh`; README, "Deploy by release"). Do not run
`docker compose up` on the server by hand for a new version. The same release builds and ships the
product site (`site/`) to `/srv/authorled/site` and serves it on `soavtor.app`; its build needs the
GitHub variables `SITE_ORIGIN` and `SITE_APP_URL`, and the server needs `/srv/authorled/site/incoming`
owned by `deploy`. A rollback is a manual run of the same workflow with an earlier tag; for tags before
`v0.3.5` (no `site/`) run the workflow of that tag (`--ref <tag>`). The server starts empty: never run `dev.sh seed` or `dev.sh auth-users` there.

The Authentik admin interface is only on `admin.soavtor.app`, with the owner's client certificate
(README, Module auth, «Admin interface»). To turn it on for the first time, each server and DNS step with
the owner's confirmation:

1. The owner runs `scripts/admin_cert.sh init` on the Mac and imports `client.p12` into the login keychain.
2. On the server: `ca.pem` → `/etc/authorled/admin-client-ca.pem` (root, 0644);
   `AUTH_ADMIN_DOMAIN=admin.soavtor.app` and `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS=<gateway>/32` in
   `/etc/authorled/authorled.env`, the gateway read just before with
   `docker network inspect authorled_agentos --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}'` (172.18.0.1 now).
3. DNS: an A record `admin.soavtor.app` → the server IP (Reg.ru, zone `soavtor.app`); check it with
   `https://dns.google/resolve?name=admin.soavtor.app&type=A`.
4. The owner checks in the admin interface that `akadmin` has no API tokens and app passwords.
5. A release from `main`: `deploy.sh` refuses without the CA file, `deploy/check_admin.sh` must pass.
6. From the Mac: `https://admin.soavtor.app/if/admin/` in Safari and Chrome opens the sign-in, and
   `akadmin` on `app.soavtor.app` is refused. End the sessions of `akadmin` opened before the release.

Lost Mac or keys: `scripts/admin_cert.sh init --replace-ca` on another computer, replace the CA file on the
server, `sudo systemctl reload caddy`. Without the e-mail of the codes too: `ak` in `authentik-server`.

Use the provider's status/list commands, saved project identifiers, and local
configuration to find an existing deployment. A failed health check does not mean
its resources are gone. Resolve authentication, permission, and network errors
before deciding to create anything. Link an existing project where required.

For a new deployment, explain which resources will be created, their billing,
and the actual teardown command and data it deletes. Run the README's first-deploy
procedure with the intended account and target explicitly selected.
For owned infrastructure, configure the public URLs of the API and Authentik before first boot.
Authentik listens on `127.0.0.1:9000`: publish it on its own HTTPS domain through the host's
reverse proxy and set `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS` to the gateway of the network
`authorled_agentos` with `/32` (`docker network inspect authorled_agentos`): a wider range lets any container
forge `X-Forwarded-Host`, and `deploy/deploy.sh` refuses it.

For an update, follow the README's code and environment update commands. Read the
scripts to establish their order and whether updating settings also triggers a
redeploy. Use flags such as `--no-deploy` only when implemented by that script.
Every `up` runs the one-shot `agentos-migrate` (migrations of schema `authorled`) before the API.
Migrations only go forward: take a database backup before deploying a version with new files in
`agno/migrations/versions/`. If `agentos-migrate` exits non-zero the API stays down; read
`docker compose logs agentos-migrate` and fix the migration in a new revision, never by editing
an applied one.
If a command fails, inspect existing resources and any partial settings changes
before retrying. Do not create a second project to recover from a failed deploy.

## 3. Complete authentication and settings

Tokens are issued by Authentik, so there is no verification key to fetch from a Live OS.
After the first boot check the chain with `./scripts/auth_check.sh` against the public URLs
(it needs `AUTH_DEV_SERVICE_TOKEN` and `AUTH_ISSUER` from the production env file), and rotate
the signing key with `docker compose run --rm authentik-jwks-export` followed by a restart of
`agentos-api`. Do not treat an exit code or missing-key stop as identical across providers.

Ensure `AGENTOS_URL` is the public HTTPS URL used by the scheduler and MCP OAuth.
Keep `MCP_CONNECT_SECRET` in the production settings for browser MCP connections.
Check how this provider clears remote variables; removing a local line may not
remove the saved value. Database credential rotation is separate from updating
API settings. Disable a sandbox by returning `None` from `sandbox_provider()` and
redeploying.

## 4. Verify and hand over

Build submission is not successful deployment. Inspect bounded provider logs and
test the public URL: `/health` must succeed; unauthenticated `/agents` requests and
MCP initialization POSTs must reject access. `deploy/check_site.sh https://soavtor.app` must pass: the
site answers, an unknown page is 404, and an empty beta request is refused with 422. `deploy/check_admin.sh admin.soavtor.app https://auth.soavtor.app https://app.soavtor.app`
must pass: the admin host asks for the owner's client certificate and refuses a connection without one,
`/if/admin/` on the Authentik host and default flows on the public hosts answer 404. A plain `GET /mcp` may return public
server-card metadata; it does not test authorization. With MCP OAuth enabled,
verify the POST's Bearer challenge. Exercise an authenticated request with an
existing token, then confirm the UI connects at
[os.agno.com](https://os.agno.com/?ref=docker-template).

Phoenix, the journal of agent runs (README, «Journal of agent runs»), listens on `127.0.0.1:6006` of the server
only: from another machine port 6006 of the server must refuse the connection, and `deploy/Caddyfile` has no route
to it. Open it through `ssh -L 6006:127.0.0.1:6006 authorled` and `http://127.0.0.1:6006`; after a run of the
co-author its trace must be there, with the run of `coauthor` as the root, and `ai.agno_traces` must get no new rows.

Model prompts spend calls; report exactly what ran. Engineer HTTP runs, delegation,
and Company Task completion need separate verification before claiming they work.

Provide the URL, verification results, and this repository's commands for code
updates, settings, logs, and teardown. For browser MCP, use `<AGENTOS_URL>/mcp` and
tell the user to enter `MCP_CONNECT_SECRET` from the production settings into the
consent page; do not print it. For coding clients, use
`uvx agno connect --url <AGENTOS_URL>`.
