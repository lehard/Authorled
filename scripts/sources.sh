#!/usr/bin/env bash

############################################################################
#
#    The library of sources on the production server (openspec/specs/sources/library, «Команды владельца»)
#
#    Usage, from /srv/authorled/app on the server:
#      ./scripts/sources.sh load              Load every book of the canon in /srv/authorled/sources
#      ./scripts/sources.sh remove <slug>     Remove a book and its pieces
#      ./scripts/sources.sh list              Books of the library
#
#    The commands run `python -m sources` inside the running agentos-api container, where
#    compose.prod.yaml mounts /srv/authorled/sources read-only at /sources. Drafts are made on the
#    owner's Mac (./scripts/dev.sh sources convert), never here. Locally use ./scripts/dev.sh sources.
#
############################################################################

set -euo pipefail
cd "$(dirname "$0")/.."

usage() {
    echo 'Usage: ./scripts/sources.sh load | remove <slug> | list'
}

[[ $# -ge 1 ]] || { usage >&2; exit 2; }
case "$1" in
    load) [[ $# -eq 1 ]] || { usage >&2; exit 2; }; args=(load /sources) ;;
    remove) [[ $# -eq 2 ]] || { usage >&2; exit 2; }; args=(remove "$2") ;;
    list) [[ $# -eq 1 ]] || { usage >&2; exit 2; }; args=(list) ;;
    *) usage >&2; exit 2 ;;
esac

compose=(docker compose -p authorled -f compose.yaml -f compose.prod.yaml)
[[ -n "$("${compose[@]}" ps -q --status running agentos-api)" ]] \
    || { echo "sources.sh: agentos-api is not running." >&2; exit 1; }
exec "${compose[@]}" exec -T agentos-api python -m sources "${args[@]}"
