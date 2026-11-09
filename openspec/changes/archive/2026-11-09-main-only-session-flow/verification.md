# Verification: main-only-session-flow

## Deterministic (2026-11-09, macOS, bash, git, python3)

Hooks were run by hand with JSON on stdin. The scratch repository had a bare `origin`, `main` with the
change `openspec/changes/other/` (all tasks checked), and a worktree in branch `claude/mine` from `origin/main`.

### `scripts/hook_session_start.sh`

| Case | Where | Output | Exit |
| --- | --- | --- | --- |
| Session in the main checkout | `/Users/Shared/Workspace/Authorled` (on `feature/openspec`) | JSON: `systemMessage` and `additionalContext` name the main checkout and its branch | 0 |
| Worktree, main checkout not on `main` | `.claude/worktrees/main-only-session-flow` | JSON: the main checkout is on `feature/openspec` | 0 |
| Worktree, main checkout on `main` | scratch worktree | nothing | 0 |
| Outside git | `/private/tmp/claude-501` | stderr `not a git checkout: fatal: not a git repository …` | 1 |

### `scripts/hook_stop.sh`

| Case (scratch worktree unless noted) | Output | Exit |
| --- | --- | --- |
| Only the change `other` of `main`, not touched by the branch | nothing | 0 |
| Branch change `mine` with `- [ ]` | nothing | 0 |
| `mine` untracked, all `- [x]` / `- [ X]` | `{"decision": "block", "reason": "… not archived: mine. …"}` | 0 |
| `mine` committed, all checked | the same block | 0 |
| `{"stop_hook_active": true}` with `mine` finished | nothing | 0 |
| `mine` with `- [~]` | nothing (counts as unfinished, as in OpenSpec) | 0 |
| No `origin/main` (remote removed) | stderr `origin/main is not known in …; run git fetch origin` | 1 |
| Real worktree of this change, 1 of 14 tasks checked | nothing | 0 |

`.claude/settings.json` parses with `python3 -m json.tool`.

## Not checked here

- That Claude Code calls both hooks in a new session: the settings take effect from the next session started from
  `main` after the merge.
