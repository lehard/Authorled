#!/usr/bin/env bash

############################################################################
#
#    Billing module boundary check
#
#    Usage: ./scripts/check_billing_boundary.sh
#
#    agno/billing/ imports nothing of the core, the application layer, the agents, the commands or Agno;
#    code outside it imports only its interface (`billing`), never its inner modules; the core neither
#    calls billing nor names its schema (openspec/specs/billing/module, «Граница модуля биллинга»).
#    Tests in agno/tests/ check the inner modules and the schema directly and are not checked here.
#
############################################################################

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

failed=0

# The searches look at the files of the repository: .claude/ holds local files of the coding agents, among them
# their working copies in .claude/worktrees/ (openspec/specs/runtime, «Проверки кода»).
search() {
    grep -rnE "$1" --include='*.py' --exclude-dir='.venv*' --exclude-dir='tmp' --exclude-dir='__pycache__' \
        "${@:2}" 2> /dev/null || true
}

report() {
    if [[ -n "$2" ]]; then
        echo "check_billing_boundary: $1:" >&2
        echo "$2" >&2
        failed=1
    fi
}

foreign='^[[:space:]]*(from|import)[[:space:]]+(core|app|agents|admin|demo|evals|db|teams|agno)([.[:space:]]|$)'
report "agno/billing/ imports the core, the application layer, the agents or Agno" "$(search "${foreign}" agno/billing)"

inner='^[[:space:]]*(from|import)[[:space:]]+billing\.'
outside="$(search "${inner}" agno | grep -vE '^agno/(billing|tests)/' || true)"
report "code outside agno/billing/ imports an inner module of billing instead of \`billing\`" "${outside}"

report "the core imports billing" "$(search '^[[:space:]]*(from|import)[[:space:]]+billing([.[:space:]]|$)' agno/core)"
report "the core names schema billing" "$(search 'billing\.' agno/core)"

if [[ ${failed} -eq 0 ]]; then
    echo "check_billing_boundary: ok"
fi
exit "${failed}"
