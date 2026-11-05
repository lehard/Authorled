#!/usr/bin/env bash

############################################################################
#
#    Local development: PostgreSQL, LiteLLM, ClamAV and Authentik in Docker, API on the host
#
#    Usage:
#      ./scripts/dev.sh db              Start agentos-db and wait until healthy
#      ./scripts/dev.sh api             Start agentos-db, litellm, clamav and Authentik, migrate the core schema,
#                                       export the Authentik keys, run the API on the host with --reload
#      ./scripts/dev.sh migrate         Prepare the database and apply the migrations of schema authorled
#      ./scripts/dev.sh test            Run the core tests (agno/tests) on a fresh database ai_test (with clamav)
#      ./scripts/dev.sh stop            Stop the services, keep the data
#      ./scripts/dev.sh reset-db --yes  Delete the agentos-db container and volume
#      ./scripts/dev.sh psql            Open psql inside agentos-db
#      ./scripts/dev.sh auth-users      Create the development users writer@authorled.test and
#                                       editor@authorled.test in the local Authentik
#
#    Needs Docker with Compose and a filled .env (compose.yaml requires the
#    LiteLLM, DeepSeek, GigaChat and Authentik settings for every service). `api` and `test` also need uv.
#
############################################################################

set -euo pipefail
cd "$(dirname "$0")/.."

usage() {
    echo 'Usage: ./scripts/dev.sh db | api | migrate | test | stop | reset-db --yes | psql | auth-users'
    echo '  db            start agentos-db and wait until healthy'
    echo '  api           start agentos-db, litellm, clamav and Authentik, migrate, export the Authentik keys, run the API on the host (--reload)'
    echo '  migrate       prepare the database (agentos-db-init) and apply the migrations of schema authorled'
    echo '  test          start clamav, recreate the database ai_test, prepare and migrate it, run pytest in agno/tests'
    echo '  stop          stop agentos-api, litellm, clamav, Authentik and agentos-db; data is kept'
    echo '  reset-db      delete the agentos-db container and its volume, with the Authentik data (requires --yes)'
    echo '  psql          open psql inside agentos-db'
    echo '  auth-users    create or update the development users of the local Authentik (password AUTH_DEV_USER_PASSWORD)'
}

fail() {
    echo "dev.sh: $*" >&2
    exit 1
}

command="${1:-}"
case "${command}" in
    -h|--help) usage; exit 0 ;;
    db|api|migrate|test|stop|psql|auth-users)
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
        docker compose up -d --wait agentos-db litellm clamav authentik-server authentik-worker
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
        exec uv run --no-project --with-requirements requirements.txt --with pytest pytest tests
        ;;
    stop)
        docker compose stop agentos-api litellm clamav authentik-server authentik-worker agentos-db
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
        [[ -n "$(docker compose ps -q --status running mailpit)" ]] \
            || fail "mailpit is not running: auth-users needs the local stand (docker compose up -d)."
        docker compose exec -T -e AUTH_DEV_USER_PASSWORD="${dev_password}" authentik-worker \
            ak apply_blueprint /blueprints-dev/dev-users.yaml
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
esac
