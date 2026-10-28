#!/usr/bin/env bash

############################################################################
#
#    Module auth boundary check
#
#    Usage: ./scripts/check_auth_boundary.sh
#
#    Outside app/auth/ no Python code may touch JWT, token claims or Authentik;
#    outside modules/auth/ there are no Authentik blueprints or services, and the groups of the
#    blueprints match GROUP_SCOPES in app/auth (openspec/specs/auth).
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

service_hits="$(grep -rlI 'goauthentik/server' --include='compose*.yaml' \
    --exclude-dir='.venv*' --exclude-dir='.git' --exclude-dir='tmp' --exclude-dir='node_modules' \
    . 2> /dev/null | grep -vx './modules/auth/compose.yaml' || true)"
if [[ -n "${service_hits}" ]]; then
    echo "check_auth_boundary: Authentik services declared outside modules/auth/compose.yaml:" >&2
    echo "${service_hits}" >&2
    failed=1
fi

# Token contract (openspec/specs/auth, "Контракт токена"): the groups declared by the blueprints
# and the groups mapped to scopes in app/auth must be the same set.
blueprint_groups="$(awk '
    /^  - model:/ { in_group = ($3 == "authentik_core.group"); next }
    in_group && /^      name:/ { print $2; in_group = 0 }
' modules/auth/blueprints/*.yaml | sort -u)"
if ! scope_groups="$(python -c 'from app.auth.authorization import GROUP_SCOPES; print("\n".join(GROUP_SCOPES))' | sort -u)"; then
    echo "check_auth_boundary: cannot import GROUP_SCOPES from app.auth.authorization; activate .venv" >&2
    failed=1
elif [[ -z "${blueprint_groups}" ]]; then
    echo "check_auth_boundary: no authentik_core.group entries found in modules/auth/blueprints" >&2
    failed=1
else
    only_blueprints="$(comm -23 <(echo "${blueprint_groups}") <(echo "${scope_groups}"))"
    only_scopes="$(comm -13 <(echo "${blueprint_groups}") <(echo "${scope_groups}"))"
    if [[ -n "${only_blueprints}" ]]; then
        echo "check_auth_boundary: groups in blueprints but not in GROUP_SCOPES: ${only_blueprints//$'\n'/, }" >&2
        failed=1
    fi
    if [[ -n "${only_scopes}" ]]; then
        echo "check_auth_boundary: groups in GROUP_SCOPES but not in blueprints: ${only_scopes//$'\n'/, }" >&2
        failed=1
    fi
fi

if [[ ${failed} -eq 0 ]]; then
    echo "check_auth_boundary: ok"
fi
exit "${failed}"
