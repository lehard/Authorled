#!/usr/bin/env bash

############################################################################
#
#    Local development: PostgreSQL, LiteLLM, ClamAV and Authentik in Docker, API on the host
#
#    The local stand is the Compose project `authorled` and belongs to the main checkout
#    (openspec/specs/runtime, «Стенд основной папки»): only there `up`, `db`, `stop` and
#    `reset-db` start, stop or delete it. The other commands work with the running stand from
#    the main checkout or a worktree and never start, stop or recreate its services. The main
#    checkout uses the databases ai and ai_test, a worktree its own ai_dev_<worktree> and
#    ai_test_<worktree> («Базы worktree»); in a worktree .env is a link to the .env of the
#    main checkout («.env в worktree»).
#
#    Usage:
#      ./scripts/dev.sh up              Main checkout: start the stand for the API on the host (agentos-db,
#                                       litellm, clamav, Authentik and mailpit, not agentos-api) and wait until healthy
#      ./scripts/dev.sh db              Main checkout: start agentos-db and wait until healthy
#      ./scripts/dev.sh api             Prepare and migrate the database of this checkout, export the Authentik keys,
#                                       run the API on the host on port 8000 with --reload
#      ./scripts/dev.sh migrate         Prepare the database of this checkout and apply the migrations of schemas
#                                       authorled and billing
#      ./scripts/dev.sh test            Run the core tests (agno/tests) on a fresh test database of this checkout
#      ./scripts/dev.sh stop            Main checkout: stop the services, keep the data
#      ./scripts/dev.sh reset-db --yes  Main checkout: delete the agentos-db container and volume
#      ./scripts/dev.sh psql            Open psql inside agentos-db on the database of this checkout
#      ./scripts/dev.sh auth-users      Create the development users writer@authorled.test and
#                                       editor@authorled.test in the local Authentik, with the app
#                                       password AUTH_DEV_WRITER_TOKEN of writer, and open its
#                                       sign-up to every address
#      ./scripts/dev.sh seed            Load the demo stories for these two users into the database of this checkout
#
#    Needs Docker with Compose, git and a filled .env (compose.yaml requires the
#    LiteLLM, DeepSeek, GigaChat and Authentik settings for every service). `api`, `migrate`, `test` and
#    `seed` also need uv, `api` also lsof.
#
############################################################################

set -euo pipefail
cd "$(dirname "$0")/.."

# The Compose project of the stand: the name the main checkout gets from its folder.
STAND_PROJECT=authorled
# The services of the stand for the API on the host; agentos-api stays off so the host API can bind 8000.
STAND_SERVICES=(agentos-db litellm clamav authentik-server authentik-worker mailpit)

usage() {
    echo 'Usage: ./scripts/dev.sh up | db | api | migrate | test | stop | reset-db --yes | psql | auth-users | seed'
    echo '  up            main checkout: start agentos-db, litellm, clamav, Authentik and mailpit (not agentos-api)'
    echo '                and wait until healthy'
    echo '  db            main checkout: start agentos-db and wait until healthy'
    echo '  api           prepare and migrate the database of this checkout, export the Authentik keys,'
    echo '                run the API on the host (--reload); the stand must be running and port 8000 free'
    echo '  migrate       prepare the database of this checkout (agentos-db-init) and apply the migrations'
    echo '                of schemas authorled and billing'
    echo '  test          recreate the test database of this checkout, prepare and migrate it, run pytest in agno/tests'
    echo '  stop          main checkout: stop agentos-api, litellm, clamav, Authentik and agentos-db; data is kept'
    echo '  reset-db      main checkout: delete the agentos-db container and its volume, with the Authentik data'
    echo '                (requires --yes)'
    echo '  psql          open psql inside agentos-db on the database of this checkout'
    echo '  auth-users    create or update the development users of the local Authentik (password AUTH_DEV_USER_PASSWORD,'
    echo '                app password of writer AUTH_DEV_WRITER_TOKEN) and open its sign-up to everyone'
    echo '  seed          load the demo stories for the development users into the database of this checkout;'
    echo '                refuses if they are there'
    echo 'Databases: ai and ai_test in the main checkout, ai_dev_<worktree> and ai_test_<worktree> in a worktree.'
}

fail() {
    echo "dev.sh: $*" >&2
    exit 1
}

compose() {
    docker compose -p "${STAND_PROJECT}" "$@"
}

# Stops unless the service runs and is healthy in the stand. A failure of docker compose itself (it
# cannot read the configuration) is named as such, never as a service that is not running.
require_healthy() {
    local service="$1" for_command="$2" id health
    id="$(compose ps -q --status running "${service}")" \
        || fail "docker compose failed (its error is above), so ${service} was not checked: fix .env (the compose files require every variable they name)."
    [[ -n "${id}" ]] \
        || fail "${service} is not running in Compose project ${STAND_PROJECT}: ${for_command} needs the local stand; start it in the main checkout (${main_checkout}) with ./scripts/dev.sh up."
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "${id}")" \
        || fail "docker inspect of ${service} failed (its error is above)."
    [[ "${health}" == "healthy" ]] \
        || fail "${service} is running in Compose project ${STAND_PROJECT} but is not healthy (${health:-no health status}): ${for_command} needs the local stand; start it in the main checkout (${main_checkout}) with ./scripts/dev.sh up."
}

require_uv() {
    command -v uv > /dev/null || fail "uv not found. Install: https://docs.astral.sh/uv/"
}

# A database name of PostgreSQL holds at most 63 bytes; a longer one is refused, never cut.
check_db_name() {
    local database="$1"
    (( ${#database} <= 63 )) \
        || fail "database name ${database} is longer than 63 bytes (it comes from the worktree folder ${worktree_name}); use a worktree with a shorter name."
}

read_agentos_password() {
    agentos_db_password="$(sed -n 's/^AGENTOS_DB_PASSWORD=//p' .env | tail -n 1)"
    [[ -n "${agentos_db_password}" ]] || fail "AGENTOS_DB_PASSWORD is not set in .env (password of the database role agentos)."
}

# Host-side connection of the role agentos to a database of agentos-db.
export_db_env() {
    export DB_DRIVER=postgresql+psycopg DB_HOST=127.0.0.1 DB_PORT=5432
    export DB_USER=agentos DB_PASS="${agentos_db_password}" DB_DATABASE="$1"
}

# Creates the database (recreate: drops it first; ensure: only when it is missing), prepares it with
# agentos-db-init like ai and applies the migrations of the core and billing on the host as the role
# agentos. Exports DB_* of that database.
prepare_db() {
    local database="$1" mode="$2"
    case "${mode}" in
        recreate)
            compose exec -T agentos-db psql -U ai -d ai -v ON_ERROR_STOP=1 -v db="${database}" <<'SQL'
SELECT format('DROP DATABASE IF EXISTS %I WITH (FORCE)', :'db') \gexec
SELECT format('CREATE DATABASE %I', :'db') \gexec
SQL
            ;;
        ensure)
            compose exec -T agentos-db psql -U ai -d ai -v ON_ERROR_STOP=1 -v db="${database}" <<'SQL'
SELECT format('CREATE DATABASE %I', :'db') WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db') \gexec
SQL
            ;;
        *) fail "prepare_db: unknown mode ${mode}" ;;
    esac
    compose run --rm --no-deps -e PGDATABASE="${database}" agentos-db-init
    export_db_env "${database}"
    (
        cd agno
        uv run --no-project --with-requirements requirements.txt alembic upgrade head
        uv run --no-project --with-requirements requirements.txt alembic -c billing/alembic.ini upgrade head
    )
}

# The host API binds 127.0.0.1:8000: stop before any change when the container agentos-api or another
# process holds it. Stopping a container of the stand is the owner's decision, never this script's.
require_free_api_port() {
    local ids listeners pid line name
    ids="$(compose ps -q --status running agentos-api)" \
        || fail "docker compose failed (its error is above), so agentos-api was not checked: fix .env (the compose files require every variable they name)."
    [[ -z "${ids}" ]] \
        || fail "port 8000 is held by the container agentos-api of Compose project ${STAND_PROJECT}. Stopping it is the owner's decision: in the main checkout (${main_checkout}) run docker compose stop agentos-api."
    if listeners="$(lsof -nP -t -iTCP:8000 -sTCP:LISTEN 2>&1)"; then
        line=""
        for pid in ${listeners}; do
            name="$(ps -o comm= -p "${pid}")" || fail "port 8000 is in use by PID ${pid}, and ps could not name it: ${listeners}"
            line+=" ${pid} (${name})"
        done
        fail "port 8000 is in use; process(es) listening:${line}."
    fi
    # lsof exits 1 both when nothing listens and on its own errors; only the first prints nothing.
    [[ -z "${listeners}" ]] || fail "lsof failed while checking port 8000: ${listeners}"
}

command="${1:-}"
case "${command}" in
    -h|--help) usage; exit 0 ;;
    up|db|api|migrate|test|stop|psql|auth-users|seed)
        [[ $# -eq 1 ]] || { usage >&2; exit 2; }
        ;;
    reset-db)
        [[ $# -le 2 ]] || { usage >&2; exit 2; }
        if [[ $# -eq 2 && "$2" != "--yes" ]]; then usage >&2; exit 2; fi
        ;;
    *) usage >&2; exit 2 ;;
esac

command -v docker > /dev/null || fail "docker not found. Install Docker with Compose."
command -v git > /dev/null || fail "git not found."

# The main checkout or a worktree, as git sees it (the same check as scripts/hook_session_start.sh).
git_dir="$(git rev-parse --path-format=absolute --git-dir)" \
    || fail "git rev-parse failed (its error is above): dev.sh runs inside a git checkout of the repository."
common_dir="$(git rev-parse --path-format=absolute --git-common-dir)" \
    || fail "git rev-parse failed (its error is above)."
main_checkout="$(dirname "${common_dir}")"
if [[ "${git_dir}" == "${common_dir}" ]]; then
    in_worktree=false
    worktree_name=""
    dev_db=ai
    test_db=ai_test
else
    in_worktree=true
    toplevel="$(git rev-parse --show-toplevel)" || fail "git rev-parse failed (its error is above)."
    worktree_name="$(basename "${toplevel}")"
    slug="$(printf '%s' "${worktree_name}" | tr '[:upper:]' '[:lower:]' | LC_ALL=C sed 's/[^a-z0-9_]/_/g')"
    dev_db="ai_dev_${slug}"
    test_db="ai_test_${slug}"
fi

if [[ "${in_worktree}" == true ]]; then
    if [[ ! -L .env || "$(readlink .env)" != "${main_checkout}/.env" ]]; then
        fail ".env in this worktree must be a link to the .env of the main checkout, so it never falls behind. Run: ln -sf ${main_checkout}/.env .env"
    fi
    [[ -f .env ]] || fail ".env of the main checkout (${main_checkout}/.env) not found. Copy example.env there and fill its Required block."
    case "${command}" in
        up|db|stop|reset-db)
            fail "${command} manages the local stand and runs only in the main checkout: cd ${main_checkout} && ./scripts/dev.sh ${*}"
            ;;
    esac
else
    [[ -f .env ]] || fail ".env not found. Copy example.env to .env and fill its Required block."
fi

case "${command}" in
    up)
        compose up -d --wait "${STAND_SERVICES[@]}"
        echo "The stand is healthy: ${STAND_SERVICES[*]} (Compose project ${STAND_PROJECT})."
        ;;
    db)
        compose up -d --wait agentos-db
        echo "agentos-db is healthy: postgresql://ai@127.0.0.1:5432/ai"
        ;;
    api)
        require_uv
        command -v lsof > /dev/null || fail "lsof not found; api needs it to name what holds port 8000."
        check_db_name "${dev_db}"
        read_agentos_password
        for service in agentos-db litellm clamav authentik-server authentik-worker; do
            require_healthy "${service}" api
        done
        require_free_api_port
        # The database of this checkout (openspec/specs/core/database); a failed migration stops here.
        prepare_db "${dev_db}" ensure
        # Module auth: write the Authentik public keys to auth/jwks/jwks.json of this checkout (fails loudly).
        compose run --rm --no-deps authentik-jwks-export
        # Host-side values of what compose.yaml sets for the agentos-api container
        # (DB_* from prepare_db, the service names become loopback ports).
        export RUNTIME_ENV=dev AGNO_DEBUG=True AGNO_TELEMETRY=false
        export AGENTOS_URL=http://127.0.0.1:8000 LITELLM_URL=http://127.0.0.1:4000
        export JWT_JWKS_FILE="$(pwd)/auth/jwks/jwks.json"
        export CLAMAV_HOST=127.0.0.1 CLAMAV_PORT=3310
        echo "API on http://127.0.0.1:8000, database ${dev_db}."
        # The backend module runs from agno/; .env stays at the repository root.
        env_file="$(pwd)/.env"
        cd agno
        exec uv run --no-project --env-file "${env_file}" --with-requirements requirements.txt \
            uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload \
            --reload-dir agents --reload-dir app --reload-dir db --reload-dir evals
        ;;
    migrate)
        require_uv
        check_db_name "${dev_db}"
        read_agentos_password
        require_healthy agentos-db migrate
        prepare_db "${dev_db}" ensure
        echo "Database ${dev_db} is migrated."
        ;;
    test)
        # Core tests on real PostgreSQL (openspec/specs/core/database, «Тесты хранения на чистой базе»):
        # the bootstrap user recreates the test database of this checkout, agentos-db-init prepares it
        # like ai, then migrations and pytest run on the host as the role agentos. The database ai and the
        # test databases of other checkouts are never touched.
        require_uv
        check_db_name "${test_db}"
        read_agentos_password
        # File tests scan with the real antivirus (openspec/specs/api/files).
        require_healthy agentos-db test
        require_healthy clamav test
        prepare_db "${test_db}" recreate
        export CLAMAV_HOST=127.0.0.1 CLAMAV_PORT=3310
        cd agno
        exec uv run --no-project --with-requirements requirements.txt --with pytest pytest tests
        ;;
    stop)
        compose stop agentos-api litellm clamav authentik-server authentik-worker agentos-db
        ;;
    reset-db)
        [[ "${2:-}" == "--yes" ]] || fail "reset-db deletes all data in the agentos-db volume. Re-run with --yes to confirm."
        volume="$(compose config | awk '
            /^volumes:/ { in_volumes = 1; next }
            in_volumes && /^  pgdata:/ { in_pgdata = 1; next }
            in_pgdata && /^    name:/ { print $2; exit }
        ')"
        [[ -n "${volume}" ]] || fail "could not resolve the pgdata volume name from 'docker compose config'."
        compose rm -sf agentos-db
        docker volume rm "${volume}"
        echo "Removed agentos-db and volume ${volume} (Authentik data included). Run ./scripts/dev.sh db to create an empty database."
        ;;
    psql)
        check_db_name "${dev_db}"
        require_healthy agentos-db psql
        exec docker compose -p "${STAND_PROJECT}" exec agentos-db psql -U ai -d "${dev_db}"
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
        require_healthy mailpit auth-users
        require_healthy authentik-worker auth-users
        # The users and allowed_emails ["*"] of the group screenwriters (sign-up open to everyone).
        compose exec -T -e AUTH_DEV_USER_PASSWORD="${dev_password}" -e AUTH_DEV_WRITER_TOKEN="${writer_token}" \
            authentik-worker ak apply_blueprint /blueprints-dev/dev-users.yaml
        # A confirmed e-mail device per user: without it the first sign-in sets one up, and an
        # unfinished setup leaves an unconfirmed device that blocks the next sign-in.
        compose exec -T authentik-worker ak shell -c '
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
        require_uv
        check_db_name "${dev_db}"
        read_agentos_password
        for service in agentos-db authentik-worker; do
            require_healthy "${service}" seed
        done
        # The database of this checkout must exist: a worktree gets it from ./scripts/dev.sh migrate.
        db_found="$(compose exec -T agentos-db psql -U ai -d ai -v ON_ERROR_STOP=1 -tA -v db="${dev_db}" <<'SQL'
SELECT count(*) FROM pg_database WHERE datname = :'db';
SQL
)" || fail "checking the database ${dev_db} in agentos-db failed (its error is above)."
        [[ "${db_found}" == "1" ]] || fail "database ${dev_db} does not exist: run ./scripts/dev.sh migrate first."
        # The subject of a user is what the token of the user will carry. Logs share stdout, hence the
        # prefixes. The query names the missing users itself, so a failure of the command is never
        # taken for users that are missing.
        authentik_output="$(compose exec -T authentik-worker ak shell -c '
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
        export_db_env "${dev_db}"
        cd agno
        exec uv run --no-project --with-requirements requirements.txt python -m demo <<< "${people}"
        ;;
esac
