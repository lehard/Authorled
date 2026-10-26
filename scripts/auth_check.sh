#!/usr/bin/env bash

############################################################################
#
#    Module auth smoke check
#
#    Gets a token of the development service account (group plugins) from
#    Authentik and checks the API: 401 without a token and with a forged
#    signature, 200 on a route the group may use, 403 on a route it may not.
#    No model calls.
#
#    Usage:
#      ./scripts/auth_check.sh
#
#    Reads .env: AUTH_ISSUER, AUTH_FRONTEND_CLIENT_ID, AUTH_DEV_SERVICE_TOKEN and
#    AGENTOS_URL (the API address, e.g. http://127.0.0.1:8000).
#
############################################################################

set -euo pipefail
cd "$(dirname "$0")/.."

fail() {
    echo "auth_check: $*" >&2
    exit 1
}

[[ $# -eq 0 ]] || { echo 'Usage: ./scripts/auth_check.sh' >&2; exit 2; }
[[ -f .env ]] || fail ".env not found. Copy example.env to .env and fill it."
set -a
# shellcheck disable=SC1091
source .env
set +a

for name in AUTH_ISSUER AUTH_FRONTEND_CLIENT_ID AUTH_DEV_SERVICE_TOKEN AGENTOS_URL; do
    [[ -n "${!name:-}" ]] || fail "$name is not set in .env"
done
command -v curl > /dev/null || fail "curl not found."
command -v python3 > /dev/null || fail "python3 not found."

authentik_url="${AUTH_ISSUER%/application/o/*}"
[[ "${authentik_url}" != "${AUTH_ISSUER}" ]] || fail "AUTH_ISSUER must contain /application/o/<slug>/"

echo ""
echo -e '\033[38;5;208m▸\033[0m \033[1mAuth Check\033[0m'

response="$(curl --silent --show-error --max-time 30 -X POST "${authentik_url}/application/o/token/" \
    -d grant_type=client_credentials -d "client_id=${AUTH_FRONTEND_CLIENT_ID}" \
    -d "scope=openid profile email" -d username=sa-dev -d "password=${AUTH_DEV_SERVICE_TOKEN}")" \
    || fail "cannot reach Authentik at ${authentik_url}"
token="$(printf '%s' "${response}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])' 2> /dev/null)" \
    || fail "Authentik did not return a token: ${response}"

failures=0
check() {
    local label="$1" expected="$2" auth="$3" path="$4" code
    if [[ -n "${auth}" ]]; then
        code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 30 -H "Authorization: Bearer ${auth}" "${AGENTOS_URL}${path}")"
    else
        code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 30 "${AGENTOS_URL}${path}")"
    fi
    if [[ "${code}" == "${expected}" ]]; then
        echo "  ok    ${label}: ${code}"
    else
        echo "  FAIL  ${label}: expected ${expected}, got ${code}"
        failures=$((failures + 1))
    fi
}

check "no token, GET /sessions" 401 "" /sessions
check "forged signature, GET /sessions" 401 "${token%???}abc" /sessions
check "plugins token, GET /sessions (sessions:read)" 200 "${token}" /sessions
check "plugins token, GET /agents (no agents:read)" 403 "${token}" /agents
check "plugins token, GET /users (admin only)" 403 "${token}" /users

echo ""
[[ ${failures} -eq 0 ]] || fail "${failures} check(s) failed"
echo "auth_check: ok"
