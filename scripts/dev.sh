#!/usr/bin/env bash

############################################################################
#
#    Local development: PostgreSQL, LiteLLM and Authentik in Docker, API on the host
#
#    Usage:
#      ./scripts/dev.sh db              Start agentos-db and wait until healthy
#      ./scripts/dev.sh api             Start agentos-db, litellm and Authentik, export the
#                                       Authentik keys, run the API on the host with --reload
#      ./scripts/dev.sh stop            Stop the services, keep the data
#      ./scripts/dev.sh reset-db --yes  Delete the agentos-db container and volume
#      ./scripts/dev.sh psql            Open psql inside agentos-db
#
#    Needs Docker with Compose and a filled .env (compose.yaml requires the
#    LiteLLM, DeepSeek, GigaChat and Authentik settings for every service). `api` also needs uv.
#
############################################################################

set -euo pipefail
cd "$(dirname "$0")/.."

usage() {
    echo 'Usage: ./scripts/dev.sh db | api | stop | reset-db --yes | psql'
    echo '  db            start agentos-db and wait until healthy'
    echo '  api           start agentos-db, litellm and Authentik, export the Authentik keys, run the API on the host (--reload)'
    echo '  stop          stop agentos-api, litellm, Authentik and agentos-db; data is kept'
    echo '  reset-db      delete the agentos-db container and its volume, with the Authentik data (requires --yes)'
    echo '  psql          open psql inside agentos-db'
}

fail() {
    echo "dev.sh: $*" >&2
    exit 1
}

command="${1:-}"
case "${command}" in
    -h|--help) usage; exit 0 ;;
    db|api|stop|psql)
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
        docker compose up -d --wait agentos-db litellm authentik-server authentik-worker
        # The role the API connects with (db/init.sql); fails loudly like any compose step.
        docker compose run --rm agentos-db-init
        # Module auth: write the Authentik public keys to modules/auth/jwks/jwks.json (fails loudly).
        docker compose run --rm authentik-jwks-export
        # The container publishes port 8000 too; stop it so the host API can bind.
        docker compose stop agentos-api
        # Host-side values of what compose.yaml sets for the agentos-api container
        # (DB_* match agentos-db and the role agentos, the service names become loopback ports).
        export RUNTIME_ENV=dev AGNO_DEBUG=True AGNO_TELEMETRY=false
        export DB_DRIVER=postgresql+psycopg DB_HOST=127.0.0.1 DB_PORT=5432
        export DB_USER=agentos DB_PASS="${agentos_db_password}" DB_DATABASE=ai
        export AGENTOS_URL=http://127.0.0.1:8000 LITELLM_URL=http://127.0.0.1:4000
        export JWT_JWKS_FILE="$(pwd)/modules/auth/jwks/jwks.json"
        exec uv run --no-project --env-file .env --with-requirements requirements.txt \
            uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload \
            --reload-dir agents --reload-dir app --reload-dir db --reload-dir evals
        ;;
    stop)
        docker compose stop agentos-api litellm authentik-server authentik-worker agentos-db
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
esac
