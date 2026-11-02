"""Agent prompts as Anthropic Agent Skills: agno/skills/<agent_id>/SKILL.md (openspec/specs/architecture).

The name and description sit in the frontmatter, the body is the prompt. Agno's LocalSkills parses and
validates the file; a missing, unreadable or invalid skill stops the import instead of leaving the agent
without a prompt.
"""

from agno.skills import LocalSkills

from app.paths import REPO_ROOT

SKILLS_DIR = REPO_ROOT / "agno" / "skills"


def agent_prompt(agent_id: str) -> str:
    """Body of agno/skills/<agent_id>/SKILL.md, the agent's instructions."""
    path = SKILLS_DIR / agent_id
    skill_md = path / "SKILL.md"
    if not skill_md.is_file():
        raise RuntimeError(f"Prompt of agent {agent_id!r} not found: {skill_md} does not exist")
    # LocalSkills raises on an invalid frontmatter but skips a skill it cannot read, logging a warning.
    skills = LocalSkills(str(path), validate=True).load()
    if len(skills) != 1:
        raise RuntimeError(f"Prompt of agent {agent_id!r} not loaded from {skill_md}; see the Agno warning above")
    skill = skills[0]
    if skill.name != agent_id:
        raise RuntimeError(f"{skill_md}: name {skill.name!r} must equal the agent id {agent_id!r}")
    if not skill.instructions:
        raise RuntimeError(f"{skill_md}: the body (the agent's prompt) is empty")
    return skill.instructions
