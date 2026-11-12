#!/usr/bin/env bash

############################################################################
#
#    Brand files check
#
#    Usage: ./scripts/check_brand.sh
#
#    The mark and page icons come only from docs/brand/ (openspec/specs/web/brand).
#    Every copy in web/public/ and site/public/ must exist and equal its source
#    byte for byte; a missing or different copy fails with its path.
#
############################################################################

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

# copy:source, both relative to the repository root
PAIRS=()
for dir in web/public site/public; do
    PAIRS+=(
        "${dir}/favicon.svg:docs/brand/mark.svg"
        "${dir}/brand-mark.svg:docs/brand/mark.svg"
        "${dir}/favicon.ico:docs/brand/export/favicon.ico"
        "${dir}/apple-touch-icon.png:docs/brand/export/apple-touch-icon.png"
        "${dir}/icon-192.png:docs/brand/export/icon-192.png"
        "${dir}/icon-512.png:docs/brand/export/icon-512.png"
        "${dir}/icon-maskable-512.png:docs/brand/export/icon-maskable-512.png"
    )
done
PAIRS+=(
    "web/public/manifest.webmanifest:docs/brand/export/manifest.webmanifest"
    "site/public/manifest.webmanifest:docs/brand/export/site.webmanifest"
)

failed=0
for pair in "${PAIRS[@]}"; do
    copy="${pair%%:*}"
    source="${pair#*:}"
    if [[ ! -f "${source}" ]]; then
        echo "check_brand: source ${source} is missing" >&2
        failed=1
    elif [[ ! -f "${copy}" ]]; then
        echo "check_brand: ${copy} is missing; copy it from ${source}" >&2
        failed=1
    elif ! cmp -s "${copy}" "${source}"; then
        echo "check_brand: ${copy} differs from ${source}; copy it again" >&2
        failed=1
    fi
done

exit "${failed}"
