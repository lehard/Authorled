#!/usr/bin/env bash

############################################################################
#
#    Agno Requirements Generator
#
#    Usage:
#      ./agno/scripts/generate_requirements.sh           # Generate
#      ./agno/scripts/generate_requirements.sh upgrade   # Generate with upgrade
#      ./agno/scripts/generate_requirements.sh <pkg>...  # Refresh only these pins
#
############################################################################

set -euo pipefail

CURR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGNO_DIR="$(dirname "${CURR_DIR}")"

# Colors
ORANGE='\033[38;5;208m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "    ${ORANGE}▸${NC} ${BOLD}Generating requirements.txt${NC}"
echo ""

if [[ "${1:-}" = "upgrade" ]]; then
    echo -e "    ${DIM}Mode: upgrade${NC}"
    echo -e "    ${DIM}> uv pip compile pyproject.toml --no-cache --upgrade -o requirements.txt${NC}"
    echo ""
    UV_CUSTOM_COMPILE_COMMAND="./agno/scripts/generate_requirements.sh upgrade" \
        uv pip compile "${AGNO_DIR}/pyproject.toml" --no-cache --upgrade -o "${AGNO_DIR}/requirements.txt"
elif [[ $# -gt 0 ]]; then
    # Refresh only the named packages.
    UPGRADE_FLAGS=()
    for pkg in "$@"; do
        UPGRADE_FLAGS+=("--upgrade-package" "$pkg")
    done
    echo -e "    ${DIM}Mode: refresh ($*)${NC}"
    echo -e "    ${DIM}> uv pip compile pyproject.toml --no-cache ${UPGRADE_FLAGS[*]} -o requirements.txt${NC}"
    echo ""
    UV_CUSTOM_COMPILE_COMMAND="./agno/scripts/generate_requirements.sh $*" \
        uv pip compile "${AGNO_DIR}/pyproject.toml" --no-cache "${UPGRADE_FLAGS[@]}" -o "${AGNO_DIR}/requirements.txt"
else
    echo -e "    ${DIM}Mode: standard${NC}"
    echo -e "    ${DIM}> uv pip compile pyproject.toml --no-cache -o requirements.txt${NC}"
    echo ""
    UV_CUSTOM_COMPILE_COMMAND="./agno/scripts/generate_requirements.sh" \
        uv pip compile "${AGNO_DIR}/pyproject.toml" --no-cache -o "${AGNO_DIR}/requirements.txt"
fi

echo ""
echo -e "    ${BOLD}Done.${NC}"
echo ""
