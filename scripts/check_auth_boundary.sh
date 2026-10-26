#!/usr/bin/env bash

############################################################################
#
#    Module auth boundary check
#
#    Usage: ./scripts/check_auth_boundary.sh
#
#    Outside app/auth/ no Python code may touch JWT, token claims or Authentik;
#    outside modules/auth/ there are no Authentik blueprints (openspec/specs/auth).
#
############################################################################

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

failed=0

python_hits="$(grep -rniE 'jwt|authentik|state\.(claims|scopes)|claims\[' \
    --include='*.py' --exclude-dir='auth' --exclude-dir='.venv*' --exclude-dir='tmp' \
    agents app db evals teams 2> /dev/null || true)"
# app/auth/ is excluded by directory name; make sure only that directory was skipped.
if find agents app db evals teams -type d -name auth -not -path 'app/auth' 2> /dev/null | grep -q .; then
    echo "check_auth_boundary: a directory named auth exists outside app/auth/, which this check would skip" >&2
    failed=1
fi
if [[ -n "${python_hits}" ]]; then
    echo "check_auth_boundary: Python code outside app/auth/ touches JWT, claims or Authentik:" >&2
    echo "${python_hits}" >&2
    failed=1
fi

blueprint_hits="$(grep -rlI 'blueprints.goauthentik.io' \
    --exclude-dir='.venv*' --exclude-dir='.git' --exclude-dir='tmp' --exclude-dir='node_modules' \
    --exclude-dir='openspec' --exclude-dir='business-intents' --exclude-dir='modules' \
    --exclude='check_auth_boundary.sh' . 2> /dev/null || true)"
if [[ -n "${blueprint_hits}" ]]; then
    echo "check_auth_boundary: Authentik blueprints outside modules/auth/:" >&2
    echo "${blueprint_hits}" >&2
    failed=1
fi

if [[ ${failed} -eq 0 ]]; then
    echo "check_auth_boundary: ok"
fi
exit "${failed}"
