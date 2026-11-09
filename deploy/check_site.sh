#!/usr/bin/env bash
# Checks the product site after a deploy (openspec/specs/runtime, «Проверка после деплоя»): the home
# page, the policy of the beta request and the documents of the service (offer, policy, pricing) answer
# 200, an unknown address 404, and an empty beta request reaches the route of the core, which refuses it
# with 422. Nothing is stored and the rate limit is not spent.
#
#   deploy/check_site.sh https://soavtor.app

set -euo pipefail

[[ $# -eq 1 ]] || { echo "usage: check_site.sh <site origin>" >&2; exit 2; }
origin="${1%/}"
failed=0

expect() {
    local want="$1" got="$2" what="$3"
    if [[ "$got" != "$want" ]]; then
        echo "::error::${what} answered ${got} instead of ${want}" >&2
        failed=1
    else
        echo "check_site: ${what} ${got}"
    fi
}

status() {
    curl -sS -o /dev/null --max-time 15 -w '%{http_code}' "$@"
}

expect 200 "$(status "${origin}/")" "${origin}/"
expect 200 "$(status "${origin}/privacy/")" "${origin}/privacy/"
for document in legal/offer legal/privacy pricing; do
    expect 200 "$(status "${origin}/${document}/")" "${origin}/${document}/"
done
expect 404 "$(status "${origin}/no-such-page")" "${origin}/no-such-page"
expect 422 "$(status -X POST -H 'Content-Type: application/json' --data-binary '' "${origin}/os/api/v1/beta-requests")" \
    "POST ${origin}/os/api/v1/beta-requests with an empty body"

exit "$failed"
