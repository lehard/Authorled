#!/usr/bin/env bash

############################################################################
#
#    Claude Code SessionStart hook (openspec/specs/dev-workflow)
#
#    Warns when a session is opened in the main checkout instead of a worktree,
#    or when the main checkout is not on `main`. Silent in a worktree whose main
#    checkout is on `main`. Changes nothing and does not touch the network.
#    A git error is reported on stderr with exit code 1.
#
############################################################################

set -euo pipefail
trap 'echo "hook_session_start: command failed at line $LINENO" >&2; exit 1' ERR

# The hook input (JSON on stdin) is not needed: the checkout is read from git.
cat >/dev/null

if ! git_dir=$(git rev-parse --path-format=absolute --git-dir 2>&1); then
    echo "hook_session_start: not a git checkout: $git_dir" >&2
    exit 1
fi
common_dir=$(git rev-parse --path-format=absolute --git-common-dir)
main_checkout=$(dirname "$common_dir")
main_branch=$(git -C "$main_checkout" branch --show-current)

problems=()
if [ "$git_dir" = "$common_dir" ]; then
    problems+=("this session runs in the main checkout ($main_checkout); work in a worktree from origin/main under .claude/worktrees/ and do not edit or commit here")
fi
if [ "$main_branch" != "main" ]; then
    problems+=("the main checkout is on '${main_branch:-detached HEAD}', not on main")
fi

if [ ${#problems[@]} -eq 0 ]; then
    exit 0
fi

python3 -c '
import json, sys
text = "Session flow (AGENTS.md, Parallel sessions): " + "; ".join(sys.argv[1:]) + "."
print(json.dumps({
    "systemMessage": text,
    "hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": text},
}))
' "${problems[@]}"
