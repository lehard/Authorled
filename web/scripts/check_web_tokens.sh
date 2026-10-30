#!/usr/bin/env bash

############################################################################
#
#    Design token check for web/
#
#    Usage: ./web/scripts/check_web_tokens.sh
#
#    Colours live only in web/src/design-system/tokens.css. Everywhere else in
#    web/src code uses semantic tokens (openspec/specs/web/design-system):
#    no hex colours, no colour functions, no Tailwind palette classes, and no
#    layer-1 primitives such as var(--blue-9) outside the showcase page.
#
############################################################################

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

TOKENS_FILE="web/src/design-system/tokens.css"
if [[ ! -f "${TOKENS_FILE}" ]]; then
    echo "check_web_tokens: ${TOKENS_FILE} not found" >&2
    exit 1
fi

PALETTE='slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
UTILITIES='bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|shadow|accent|caret|divide|placeholder'
PATTERN="#[0-9a-fA-F]{3,8}\\b|\\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\\(|\\b(${UTILITIES})-((${PALETTE})-[0-9]{2,3}|white|black)\\b"

hits="$(grep -rnE "${PATTERN}" \
    --include='*.ts' --include='*.tsx' --include='*.css' \
    web/src 2> /dev/null | grep -v "^${TOKENS_FILE}:" || true)"

failed=0
if [[ -n "${hits}" ]]; then
    echo "check_web_tokens: raw colours outside ${TOKENS_FILE}; use semantic tokens instead:" >&2
    echo "${hits}" >&2
    failed=1
fi

# Layer-1 scale names are read from tokens.css: a primitive is a numbered token declared with a
# literal colour (--blue-9: oklch(...)), so a new scale is covered without editing this script.
SHOWCASE_DIR="web/src/showcase"
scales="$(grep -oE -- '--[a-z]+-[0-9]+: oklch\(' "${TOKENS_FILE}" | sed -E 's/^--([a-z]+)-.*/\1/' | sort -u | paste -sd '|' -)"
if [[ -z "${scales}" ]]; then
    echo "check_web_tokens: no layer-1 scales found in ${TOKENS_FILE}" >&2
    exit 1
fi
primitive_hits="$(grep -rnE -- "--(${scales})-[0-9]+\b" \
    --include='*.ts' --include='*.tsx' --include='*.css' \
    web/src 2> /dev/null | grep -v -e "^${TOKENS_FILE}:" -e "^${SHOWCASE_DIR}/" || true)"
if [[ -n "${primitive_hits}" ]]; then
    echo "check_web_tokens: layer-1 primitives outside ${TOKENS_FILE} and ${SHOWCASE_DIR}/; use layer 2-3 tokens:" >&2
    echo "${primitive_hits}" >&2
    failed=1
fi

exit "${failed}"
