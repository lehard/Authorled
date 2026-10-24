"""
App Settings
============

Shared runtime objects for the platform.
"""

from agno.models.anthropic import Claude


def default_model() -> Claude:
    """Fresh model instance per agent — avoids shared-state footguns."""
    return Claude(id="claude-sonnet-5-5")


def manager_model() -> Claude:
    """Model for OS Manager and Company Product Manager."""
    return Claude(id="claude-opus-5-5")
