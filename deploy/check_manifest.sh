#!/usr/bin/env bash
# Checks the type of the page manifest after a deploy (openspec/specs/runtime, «Тип манифеста страниц»):
# /manifest.webmanifest of every origin answers 200 with Content-Type application/manifest+json, plain and
# with Accept-Encoding: gzip. Any other code, type or a missing type fails with the address.
#
#   deploy/check_manifest.sh https://app.soavtor.app https://soavtor.app

set -euo pipefail

[[ $# -ge 1 ]] || { echo "usage: check_manifest.sh <origin>..." >&2; exit 2; }
want="application/manifest+json"
failed=0

for origin in "$@"; do
    url="${origin%/}/manifest.webmanifest"
    for encoding in identity gzip; do
        answer="$(curl -sS -o /dev/null --max-time 15 -H "Accept-Encoding: ${encoding}" \
            -w '%{http_code} %{content_type}' "${url}")"
        code="${answer%% *}"
        type="${answer#* }"
        type="$(printf '%s' "${type%%;*}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
        if [[ "${code}" != "200" || "${type}" != "${want}" ]]; then
            echo "::error::${url} (Accept-Encoding: ${encoding}) answered ${code} ${type:-no content-type} instead of 200 ${want}" >&2
            failed=1
        else
            echo "check_manifest: ${url} (${encoding}) ${code} ${type}"
        fi
    done
done

exit "$failed"
