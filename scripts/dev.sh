#!/usr/bin/env bash

############################################################################
#
#    Local development: PostgreSQL, LiteLLM, ClamAV and Authentik in Docker, API on the host
#
#    Usage:
#      ./scripts/dev.sh db              Start agentos-db and wait until healthy
#      ./scripts/dev.sh api             Start agentos-db, litellm, clamav and Authentik, migrate the core schema,
#                                       export the Authentik keys, run the API on the host with --reload
#      ./scripts/dev.sh migrate         Prepare the database and apply the migrations of schemas authorled and billing
#      ./scripts/dev.sh test            Run the core tests (agno/tests) on a fresh database ai_test (with clamav)
#      ./scripts/dev.sh stop            Stop the services, keep the data
#      ./scripts/dev.sh reset-db --yes  Delete the agentos-db container and volume
#      ./scripts/dev.sh psql            Open psql inside agentos-db
#      ./scripts/dev.sh auth-users      Create the development users writer@authorled.test and
#                                       editor@authorled.test in the local Authentik, with the app
#                                       password AUTH_DEV_WRITER_TOKEN of writer, and open its
#                                       sign-up to every address
#      ./scripts/dev.sh seed            Load the demo stories for these two users into the database ai
#
#    Needs Docker with Compose and a filled .env (compose.yaml requires the
#    LiteLLM, DeepSeek, GigaChat and Authentik settings for every service). `api`, `test` and `seed` also need uv.
#
############################################################################

set -euo pipefail
cd "$(dirname "$0")/.."

usage() {
    echo 'Usage: ./scripts/dev.sh db | api | migrate | test | stop | reset-db --yes | psql | auth-users | seed'
    echo '  db            start agentos-db and wait until healthy'
    echo '  api           start agentos-db, litellm, clamav and Authentik, migrate, export the Authentik keys, run the API on the host (--reload)'
    echo '  migrate       prepare the database (agentos-db-init) and apply the migrations of schemas authorled and billing'
    echo '  test          start clamav, recreate the database ai_test, prepare and migrate it, run pytest in agno/tests'
    echo '  stop          stop agentos-api, litellm, clamav, Authentik and agentos-db; data is kept'
    echo '  reset-db      delete the agentos-db container and its volume, with the Authentik data (requires --yes)'
    echo '  psql          open psql inside agentos-db'
    echo '  auth-users    create or update the development users of the local Authentik (password AUTH_DEV_USER_PASSWORD,'
    echo '                app password of writer AUTH_DEV_WRITER_TOKEN) and open its sign-up to everyone'
    echo '  seed          load the demo stories for the development users into the database ai; refuses if they are there'
}

fail() {
    echo "dev.sh: $*" >&2
    exit 1
}

# Stops unless the service runs in the Compose project of this checkout. A failure of docker compose
# itself (it cannot read the configuration) is named as such, never as a service that is not running.
require_running() {
    local service="$1" for_command="$2" ids project
    ids="$(docker compose ps -q --status running "${service}")" \
        || fail "docker compose failed (its error is above), so ${service} was not checked: fix .env (the compose files require every variable they name)."
    [[ -z "${ids}" ]] || return 0
    project="$(docker compose config | sed -n '1s/^name: //p')" \
        || fail "docker compose config failed (its error is above) while naming the project where ${service} is not running."
    [[ -n "${project}" ]] || fail "${service} is not running, and 'docker compose config' printed no project name."
    fail "${service} is not running in Compose project ${project} (${PWD}): ${for_command} needs the local stand; run it from the checkout where the stand runs, or start it (docker compose up -d)."
}

command="${1:-}"
case "${command}" in
    -h|--help) usage; exit 0 ;;
    db|api|migrate|test|stop|psql|auth-users|seed)
        [[ $# -eq 1 ]] || { usage >&2; exit 2; }
        ;;
    reset-db)
        [[ $# -le 2 ]] || { usage >&2; exit 2; }
        if [[ $# -eq 2 && "$2" != "--yes" ]]; then usage >&2; exit 2; fi
        ;;
    *) usage >&2; exit 2 ;;
esac

command -v docker > /dev/null || fail "docker not found. Install Docker with Compose."
[[ -f .env ]] || fail ".env not found. Copy example.env to .env and fill its Required block."

case "${command}" in
    db)
        docker compose up -d --wait agentos-db
        echo "agentos-db is healthy: postgresql://ai@127.0.0.1:5432/ai"
        ;;
    api)
        command -v uv > /dev/null || fail "uv not found. Install: https://docs.astral.sh/uv/"
        agentos_db_password="$(sed -n 's/^AGENTOS_DB_PASSWORD=//p' .env | tail -n 1)"
        [[ -n "${agentos_db_password}" ]] || fail "AGENTOS_DB_PASSWORD is not set in .env (password of the database role agentos)."
        # Phoenix, the journal of agent runs: the API refuses to start without it (openspec/specs/agent-tracing).
        docker compose up -d --wait agentos-db litellm clamav authentik-server authentik-worker phoenix
        # The role the API connects with (agno/db/init.sql); fails loudly like any compose step.
        docker compose run --rm agentos-db-init
        # The core schema `authorled` (openspec/specs/core/database); a failed migration stops here.
        docker compose run --rm agentos-migrate
        # Module auth: write the Authentik public keys to auth/jwks/jwks.json (fails loudly).
        docker compose run --rm authentik-jwks-export
        # The container publishes port 8000 too; stop it so the host API can bind.
        docker compose stop agentos-api
        # Host-side values of what compose.yaml sets for the agentos-api container
        # (DB_* match agentos-db and the role agentos, the service names become loopback ports).
        export RUNTIME_ENV=dev AGNO_DEBUG=True AGNO_TELEMETRY=false
        export DB_DRIVER=postgresql+psycopg DB_HOST=127.0.0.1 DB_PORT=5432
        export DB_USER=agentos DB_PASS="${agentos_db_password}" DB_DATABASE=ai
        export AGENTOS_URL=http://127.0.0.1:8000 LITELLM_URL=http://127.0.0.1:4000
        export JWT_JWKS_FILE="$(pwd)/auth/jwks/jwks.json"
        export CLAMAV_HOST=127.0.0.1 CLAMAV_PORT=3310
        export PHOENIX_URL=http://127.0.0.1:6006
        # The backend module runs from agno/; .env stays at the repository root.
        env_file="$(pwd)/.env"
        cd agno
        exec uv run --no-project --env-file "${env_file}" --with-requirements requirements.txt \
            uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload \
            --reload-dir agents --reload-dir app --reload-dir db --reload-dir evals
        ;;
    migrate)
        docker compose up -d --wait agentos-db
        docker compose run --rm agentos-db-init
        docker compose run --rm agentos-migrate
        ;;
    test)
        # Core tests on real PostgreSQL (openspec/specs/core/database, «Тесты хранения на чистой базе»):
        # the bootstrap user recreates ai_test, agentos-db-init prepares it like ai, then migrations and
        # pytest run on the host as the role agentos. The database ai is never touched.
        command -v uv > /dev/null || fail "uv not found. Install: https://docs.astral.sh/uv/"
        agentos_db_password="$(sed -n 's/^AGENTOS_DB_PASSWORD=//p' .env | tail -n 1)"
        [[ -n "${agentos_db_password}" ]] || fail "AGENTOS_DB_PASSWORD is not set in .env (password of the database role agentos)."
        # File tests scan with the real antivirus (openspec/specs/api/files).
        docker compose up -d --wait agentos-db clamav
        docker compose exec -T agentos-db psql -U ai -d ai -v ON_ERROR_STOP=1 \
            -c 'DROP DATABASE IF EXISTS ai_test WITH (FORCE)' -c 'CREATE DATABASE ai_test'
        docker compose run --rm -e PGDATABASE=ai_test agentos-db-init
        export DB_DRIVER=postgresql+psycopg DB_HOST=127.0.0.1 DB_PORT=5432
        export DB_USER=agentos DB_PASS="${agentos_db_password}" DB_DATABASE=ai_test
        export CLAMAV_HOST=127.0.0.1 CLAMAV_PORT=3310
        cd agno
        uv run --no-project --with-requirements requirements.txt alembic upgrade head
        uv run --no-project --with-requirements requirements.txt alembic -c billing/alembic.ini upgrade head
        exec uv run --no-project --with-requirements requirements.txt --with pytest pytest tests
        ;;
    stop)
        docker compose stop agentos-api litellm clamav phoenix authentik-server authentik-worker agentos-db
        ;;
    reset-db)
        [[ "${2:-}" == "--yes" ]] || fail "reset-db deletes all data in the agentos-db volume. Re-run with --yes to confirm."
        volume="$(docker compose config | awk '
            /^volumes:/ { in_volumes = 1; next }
            in_volumes && /^  pgdata:/ { in_pgdata = 1; next }
            in_pgdata && /^    name:/ { print $2; exit }
        ')"
        [[ -n "${volume}" ]] || fail "could not resolve the pgdata volume name from 'docker compose config'."
        docker compose rm -sf agentos-db
        docker volume rm "${volume}"
        echo "Removed agentos-db and volume ${volume} (Authentik data included). Run ./scripts/dev.sh db to create an empty database."
        ;;
    psql)
        exec docker compose exec agentos-db psql -U ai -d ai
        ;;
    auth-users)
        # Local stand only (openspec/specs/auth, «Пользователи для разработки»): refuse a non-dev
        # RUNTIME_ENV and a stand without the development mailbox, which production never runs.
        runtime_env="${RUNTIME_ENV:-$(sed -n 's/^RUNTIME_ENV=//p' .env | tail -n 1)}"
        if [[ -n "${runtime_env}" && "${runtime_env}" != "dev" ]]; then
            fail "auth-users is for the local stand only; RUNTIME_ENV is ${runtime_env}."
        fi
        dev_password="$(sed -n 's/^AUTH_DEV_USER_PASSWORD=//p' .env | tail -n 1)"
        [[ -n "${dev_password}" && "${dev_password}" != "***" ]] \
            || fail "AUTH_DEV_USER_PASSWORD is not set in .env (password of the development users)."
        writer_token="$(sed -n 's/^AUTH_DEV_WRITER_TOKEN=//p' .env | tail -n 1)"
        [[ -n "${writer_token}" && "${writer_token}" != "***" ]] \
            || fail "AUTH_DEV_WRITER_TOKEN is not set in .env (app password of writer for the co-author eval)."
        require_running mailpit auth-users
        # The users and allowed_emails ["*"] of the group screenwriters (sign-up open to everyone).
        docker compose exec -T -e AUTH_DEV_USER_PASSWORD="${dev_password}" -e AUTH_DEV_WRITER_TOKEN="${writer_token}" \
            authentik-worker ak apply_blueprint /blueprints-dev/dev-users.yaml
        # A confirmed e-mail device per user: without it the first sign-in sets one up, and an
        # unfinished setup leaves an unconfirmed device that blocks the next sign-in.
        docker compose exec -T authentik-worker ak shell -c '
from authentik.core.models import User
from authentik.stages.authenticator_email.models import AuthenticatorEmailStage, EmailDevice
stage = AuthenticatorEmailStage.objects.get(name="authorled-authenticator-email-setup")
for username in ("writer", "editor"):
    user = User.objects.get(username=username)
    EmailDevice.objects.update_or_create(
        user=user, defaults={"email": user.email, "name": "Почта", "confirmed": True, "stage": stage}
    )
' > /dev/null
        echo "Development users: writer@authorled.test (screenwriters), editor@authorled.test (editors)."
        echo "Sign-in codes arrive at http://localhost:8025."
        ;;
    seed)
        # Local stand only (openspec/specs/runtime, «Демо-контент»): nothing is started or migrated here.
        runtime_env="${RUNTIME_ENV:-$(sed -n 's/^RUNTIME_ENV=//p' .env | tail -n 1)}"
        if [[ -n "${runtime_env}" && "${runtime_env}" != "dev" ]]; then
            fail "seed is for the local stand only; RUNTIME_ENV is ${runtime_env}."
        fi
        command -v uv > /dev/null || fail "uv not found. Install: https://docs.astral.sh/uv/"
        agentos_db_password="$(sed -n 's/^AGENTOS_DB_PASSWORD=//p' .env | tail -n 1)"
        [[ -n "${agentos_db_password}" ]] || fail "AGENTOS_DB_PASSWORD is not set in .env (password of the database role agentos)."
        for service in agentos-db authentik-worker; do
            require_running "${service}" seed
        done
        # The subject of a user is what the token of the user will carry. Logs share stdout, hence the
        # prefixes. The query names the missing users itself, so a failure of the command is never
        # taken for users that are missing.
        authentik_output="$(docker compose exec -T authentik-worker ak shell -c '
import json
from authentik.core.models import User
names = ("writer", "editor")
found = {u.username: u for u in User.objects.filter(username__in=names)}
print("DEMO_MISSING " + " ".join(name for name in names if name not in found))
users = [found[name] for name in names if name in found]
print("DEMO_USERS " + json.dumps([{"subject": u.uid, "email": u.email, "name": u.name} for u in users]))
')" || fail "reading the development users from Authentik (authentik-worker) failed; its error is above."
        missing_line="$(grep -m 1 '^DEMO_MISSING ' <<< "${authentik_output}")" \
            || fail "reading the development users from Authentik printed no DEMO_MISSING line."
        missing="${missing_line#DEMO_MISSING }"
        [[ -z "${missing}" ]] || fail "no development users in Authentik (${missing}): run ./scripts/dev.sh auth-users."
        people_line="$(grep -m 1 '^DEMO_USERS ' <<< "${authentik_output}")" \
            || fail "reading the development users from Authentik printed no DEMO_USERS line."
        people="${people_line#DEMO_USERS }"
        export DB_DRIVER=postgresql+psycopg DB_HOST=127.0.0.1 DB_PORT=5432
        export DB_USER=agentos DB_PASS="${agentos_db_password}" DB_DATABASE=ai
        cd agno
        exec uv run --no-project --with-requirements requirements.txt python -m demo <<< "${people}"
        ;;
esac
