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

# Colors
ORANGE='\033[38;5;208m'
RED='\033[31m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

if [[ -z "${VIRTUAL_ENV:-}" ]]; then
  echo -e "${RED}Warning:${NC} no virtualenv active. Run: ${BOLD}source .venv/bin/activate${NC}"
  echo ""
fi

echo ""
echo -e "${ORANGE}▸${NC} ${BOLD}Validating workspace${NC}"
echo ""

failed=0

echo -e "${DIM}> ruff format --check ${REPO_ROOT}${NC}"
if ! ruff format --check "${REPO_ROOT}"; then
  echo -e "${RED}Fix with:${NC} ${BOLD}./scripts/format.sh${NC}"
  failed=1
fi

echo ""
echo -e "${DIM}> ruff check ${REPO_ROOT}${NC}"
if ! ruff check "${REPO_ROOT}"; then
  failed=1
fi

echo ""
echo -e "${DIM}> mypy ${REPO_ROOT} --config-file ${REPO_ROOT}/pyproject.toml${NC}"
if ! mypy "${REPO_ROOT}" --config-file "${REPO_ROOT}/pyproject.toml"; then
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
if ! "${CURR_DIR}/check_web_tokens.sh"; then
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
