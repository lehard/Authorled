#!/usr/bin/env bash

############################################################################
#
#    Claude Code Stop hook (openspec/specs/dev-workflow)
#
#    Finds the OpenSpec changes this branch added or edited against origin/main
#    that are not archived. When all tasks of such a change are checked, it asks
#    the session once to finish verify and archive ({"decision": "block"}).
#    With stop_hook_active it lets the session stop. Changes nothing and does
#    not touch the network. A git error is reported on stderr with exit code 1.
#
############################################################################

set -euo pipefail
trap 'echo "hook_stop: command failed at line $LINENO" >&2; exit 1' ERR

input=$(cat)
active=$(printf '%s' "$input" | python3 -c 'import json, sys; print(bool(json.load(sys.stdin).get("stop_hook_active")))')
if [ "$active" = "True" ]; then
    exit 0
fi

root=$(git rev-parse --show-toplevel)
cd "$root"
if ! git rev-parse --verify --quiet origin/main >/dev/null; then
    echo "hook_stop: origin/main is not known in $root; run git fetch origin" >&2
    exit 1
fi
base=$(git merge-base HEAD origin/main)

paths=$(
    git diff --name-only "$base" -- openspec/changes
    git ls-files --others --exclude-standard -- openspec/changes
)

printf '%s\n' "$paths" | python3 -c '
import json, re, sys
from pathlib import Path

names = sorted({p.split("/")[2] for p in sys.stdin.read().splitlines() if p.count("/") >= 3})
task = re.compile(r"^\s*- \[([^\]]*)\]")
done = []
for name in names:
    tasks = Path("openspec/changes", name, "tasks.md")
    if name == "archive" or not tasks.is_file():
        continue
    marks = [m.group(1) for line in tasks.read_text(encoding="utf-8").splitlines() if (m := task.match(line))]
    if marks and all(mark.strip() in ("x", "X") for mark in marks):
        done.append(name)
if done:
    print(json.dumps({
        "decision": "block",
        "reason": (
            "All tasks are checked but the change is not archived: " + ", ".join(done) + ". "
            "Per AGENTS.md (OpenSpec is mandatory): run verify; with no CRITICAL issues archive it, "
            "run ./scripts/validate.sh, git diff --check and the tests the change needs, commit your files, "
            "open the PR into main, wait for its checks and merge it. Stop and report on CRITICAL issues, "
            "a failed check or a conflict."
        ),
    }))
'
