#!/usr/bin/env bash

############################################################################
#
#    Spending of the co-author and plans of users (openspec/specs/core/subscriptions)
#
#    Usage:
#      ./scripts/usage.sh local report                  The local stand (compose.yaml)
#      ./scripts/usage.sh prod report                   The production server, from /srv/authorled/app
#      ./scripts/usage.sh <local|prod> set-plan <e-mail> <plan>
#
#    The commands run `python -m admin` inside the running agentos-api container, through the
#    operations of the core. The target is required: the script does not guess where it runs.
#
############################################################################

set -euo pipefail
cd "$(dirname "$0")/.."

usage() {
    echo 'Usage: ./scripts/usage.sh local|prod report | set-plan <e-mail> <plan>'
}

[[ $# -ge 2 ]] || { usage >&2; exit 2; }
target="$1"
shift
case "${target}" in
    local) compose=(docker compose) ;;
    prod) compose=(docker compose -p authorled -f compose.yaml -f compose.prod.yaml) ;;
    *) usage >&2; exit 2 ;;
esac
case "$1" in
    report) [[ $# -eq 1 ]] || { usage >&2; exit 2; } ;;
    set-plan) [[ $# -eq 3 ]] || { usage >&2; exit 2; } ;;
    *) usage >&2; exit 2 ;;
esac

[[ -n "$("${compose[@]}" ps -q --status running agentos-api)" ]] \
    || { echo "usage.sh: agentos-api is not running for target ${target}." >&2; exit 1; }
exec "${compose[@]}" exec -T agentos-api python -m admin "$@"
