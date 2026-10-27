#!/usr/bin/env bash

############################################################################
#
#    Design token check for web/
#
#    Usage: ./scripts/check_web_tokens.sh
#
#    Colours live only in web/src/design-system/tokens.css. Everywhere else in
#    web/src code uses semantic tokens (openspec/specs/web/design-system):
#    no hex colours, no colour functions, no Tailwind palette classes.
#
############################################################################

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

if [[ -n "${hits}" ]]; then
    echo "check_web_tokens: raw colours outside ${TOKENS_FILE}; use semantic tokens instead:" >&2
    echo "${hits}" >&2
    exit 1
fi
