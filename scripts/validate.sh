#!/usr/bin/env bash

############################################################################
#
#    Agno Workspace Validator
#
#    Usage: ./scripts/validate.sh
#
############################################################################

set -uo pipefail

CURR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "${CURR_DIR}")"
# The backend module: Python sources and its pyproject.toml (ruff and mypy settings).
AGNO_DIR="${REPO_ROOT}/agno"

# Colors
ORANGE='\033[38;5;208m'
RED='\033[31m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

if [[ -z "${VIRTUAL_ENV:-}" ]]; then
  echo -e "${RED}Warning:${NC} no virtualenv active. Run: ${BOLD}source agno/.venv/bin/activate${NC}"
  echo ""
fi

echo ""
echo -e "${ORANGE}▸${NC} ${BOLD}Validating workspace${NC}"
echo ""

failed=0

echo -e "${DIM}> ruff format --check agno${NC}"
if ! ruff format --check "${AGNO_DIR}"; then
  echo -e "${RED}Fix with:${NC} ${BOLD}./scripts/format.sh${NC}"
  failed=1
fi

echo ""
echo -e "${DIM}> ruff check agno${NC}"
if ! ruff check "${AGNO_DIR}"; then
  failed=1
fi

echo ""
echo -e "${DIM}> (cd agno && mypy . --config-file pyproject.toml)${NC}"
if ! (cd "${AGNO_DIR}" && mypy . --config-file pyproject.toml); then
  failed=1
fi

echo ""
echo -e "${DIM}> check_auth_boundary${NC}"
if ! "${CURR_DIR}/check_auth_boundary.sh"; then
  failed=1
fi

# Frontend (web/): checks run only on installed dependencies; a missing install is an error,
# never a skipped check (openspec/specs/runtime).
WEB_DIR="${REPO_ROOT}/web"
echo ""
if [[ ! -d "${WEB_DIR}/node_modules" ]]; then
  echo -e "${RED}web/node_modules is missing.${NC} Install frontend dependencies: ${BOLD}npm ci --prefix web${NC}"
  failed=1
else
  echo -e "${DIM}> npm run format:check --prefix web${NC}"
  if ! npm run --silent format:check --prefix "${WEB_DIR}"; then
    echo -e "${RED}Fix with:${NC} ${BOLD}./scripts/format.sh${NC}"
    failed=1
  fi

  for step in lint typecheck build check:contrast; do
    echo ""
    echo -e "${DIM}> npm run ${step} --prefix web${NC}"
    if ! npm run --silent "${step}" --prefix "${WEB_DIR}"; then
      failed=1
    fi
  done
fi

echo ""
echo -e "${DIM}> check_web_tokens${NC}"
if ! "${WEB_DIR}/scripts/check_web_tokens.sh"; then
  failed=1
fi

echo ""
if [[ $failed -eq 0 ]]; then
  echo -e "${BOLD}Done.${NC}"
else
  echo -e "${RED}${BOLD}Failed.${NC}"
fi
echo ""

exit "$failed"
