#!/usr/bin/env bash

############################################################################
#
#    Save the authority of sa-routines in the declared Company Routines
#    (openspec/specs/api/schedules, «Права Routine из кода»)
#
#    Usage: ./scripts/routines_authorize.sh < app-password
#      On the server: ssh authorled 'cd /srv/authorled/app && ./scripts/routines_authorize.sh'
#      with the app password on stdin.
#
#    Agno 3.1.10 runs a Routine declared in agno/app/company.py with no authority, and its run
#    is refused with 403. This script takes a token of the service account sa-routines (group
#    routines) with a temporary app password from stdin and repoints every Routine of the
#    declared Products at its own executor (PATCH /company/routines/{id}): Agno checks the right
#    to run the executor and saves the caller's authority in the Routine. Instructions, cron and
#    executor do not change. Delete the app password in the admin interface afterwards.
#
#    Reads .env: AUTH_ISSUER, AUTH_FRONTEND_CLIENT_ID, AGENTOS_URL. Any failure stops the script
#    with the step and the HTTP code; the password and the token are never printed.
#
############################################################################

set -euo pipefail
cd "$(dirname "$0")/.."

# Products declared in agno/app/company.py. A Routine of any other Product stops the script.
DECLARED_PRODUCTS="this-agentos"

fail() {
    echo "routines_authorize: $*" >&2
    exit 1
}

[[ $# -eq 0 ]] || { echo 'Usage: ./scripts/routines_authorize.sh < app-password' >&2; exit 2; }
[[ -f .env ]] || fail ".env not found."
set -a
# shellcheck disable=SC1091
source .env
set +a
for name in AUTH_ISSUER AUTH_FRONTEND_CLIENT_ID AGENTOS_URL; do
    [[ -n "${!name:-}" ]] || fail "$name is not set in .env"
done
command -v curl > /dev/null || fail "curl not found."
command -v python3 > /dev/null || fail "python3 not found."
authentik_url="${AUTH_ISSUER%/application/o/*}"
[[ "${authentik_url}" != "${AUTH_ISSUER}" ]] || fail "AUTH_ISSUER must contain /application/o/<slug>/"

[[ ! -t 0 ]] || fail "pass the app password of sa-routines on stdin, not from a terminal."
IFS= read -r password || [[ -n "${password:-}" ]] || fail "no app password on stdin."
[[ -n "${password}" ]] || fail "the app password on stdin is empty."

work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT

# One request: the body goes to ${work}/body, the HTTP code to stdout. Secrets go through files.
request() {
    curl --silent --show-error --max-time 60 --output "${work}/body" --write-out '%{http_code}' "$@"
}

printf 'password=' > "${work}/password"
printf '%s' "${password}" | python3 -c 'import sys, urllib.parse; sys.stdout.write(urllib.parse.quote(sys.stdin.read(), safe=""))' \
    >> "${work}/password"
code="$(request -X POST "${authentik_url}/application/o/token/" \
    -d grant_type=client_credentials -d "client_id=${AUTH_FRONTEND_CLIENT_ID}" \
    -d "scope=openid profile email" -d username=sa-routines -d "@${work}/password")" \
    || fail "token: cannot reach Authentik at ${authentik_url}"
[[ "${code}" == "200" ]] || fail "token: Authentik answered ${code} (wrong or deleted app password?)"
python3 -c 'import json, sys; print("Authorization: Bearer " + json.load(open(sys.argv[1]))["access_token"])' \
    "${work}/body" > "${work}/auth" 2> /dev/null || fail "token: Authentik returned no access_token"
rm -f "${work}/password" "${work}/body"

# Every Routine, page by page: lines "<id> <product_id> <executor_type> <executor_id> <name>".
: > "${work}/routines"
page=1
while :; do
    code="$(request -H "@${work}/auth" "${AGENTOS_URL}/company/routines?limit=100&page=${page}")" \
        || fail "list: cannot reach the API at ${AGENTOS_URL}"
    [[ "${code}" == "200" ]] || fail "list: GET /company/routines answered ${code}"
    pages="$(python3 - "${work}/body" "${work}/routines" << 'EOF'
import json, sys
body = json.load(open(sys.argv[1]))
with open(sys.argv[2], "a") as out:
    for row in body["data"]:
        product = row["payload"]["metadata"]["product_id"]
        out.write(f'{row["id"]} {product} {row["target_type"]} {row["target_id"]} {row["name"]}\n')
print(body["meta"]["total_pages"])
EOF
)" || fail "list: unexpected answer of GET /company/routines"
    [[ "${page}" -ge "${pages}" ]] && break
    page=$((page + 1))
done
[[ -s "${work}/routines" ]] || fail "list: no Routines found."

while read -r id product executor_type executor_id name; do
    [[ " ${DECLARED_PRODUCTS} " == *" ${product} "* ]] \
        || fail "Routine ${name} belongs to Product ${product}, which agno/app/company.py does not declare."
done < "${work}/routines"

while read -r id product executor_type executor_id name; do
    printf '{"executor_type": "%s", "executor_id": "%s"}' "${executor_type}" "${executor_id}" > "${work}/patch"
    code="$(request -X PATCH -H "@${work}/auth" -H 'Content-Type: application/json' \
        --data-binary "@${work}/patch" "${AGENTOS_URL}/company/routines/${id}")" \
        || fail "save ${name}: cannot reach the API at ${AGENTOS_URL}"
    [[ "${code}" == "200" ]] || fail "save ${name}: PATCH /company/routines/${id} answered ${code}"
    python3 - "${work}/body" "${executor_type}" "${executor_id}" << 'EOF' || fail "save ${name}: the executor changed"
import json, sys
row = json.load(open(sys.argv[1]))
sys.exit(0 if (row["target_type"], row["target_id"]) == (sys.argv[2], sys.argv[3]) else 1)
EOF
    echo "routines_authorize: authority of sa-routines saved in ${name}"
done < "${work}/routines"
