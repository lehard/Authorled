"""Repository root: the directory above the backend module `agno/` (openspec/specs/architecture)."""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if not (REPO_ROOT / "AGENTS.md").is_file():
    raise RuntimeError(f"Repository root not found: {REPO_ROOT} has no AGENTS.md")
