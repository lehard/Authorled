"""
App Settings
============

Shared runtime objects for the platform. Every model call goes through the
LiteLLM proxy (`litellm/config.yaml`); model names below are proxy aliases.
"""

from os import getenv

from agno.knowledge.embedder.openai import OpenAIEmbedder
from agno.models.deepseek import DeepSeek

# Proxy aliases declared in litellm/config.yaml.
DEEPSEEK_FAST = "deepseek-fast"
DEEPSEEK_THINKING = "deepseek-thinking"
GIGACHAT_EMBEDDINGS = "gigachat-embeddings"
GIGACHAT_EMBEDDING_DIMENSIONS = 1024


def _required_env(name: str) -> str:
    value = getenv(name)
    if not value:
        raise RuntimeError(f"Required environment variable {name} is not set")
    return value


def litellm_url() -> str:
    """Base URL of the LiteLLM proxy, without the /v1 suffix."""
    return _required_env("LITELLM_URL")


def litellm_key() -> str:
    """Virtual or master key the application uses to call the LiteLLM proxy."""
    return _required_env("LITELLM_API_KEY")


def _deepseek(alias: str, thinking: bool) -> DeepSeek:
    # Agno's DeepSeek model sends `thinking` and returns reasoning_content with
    # tool calls, which DeepSeek requires in thinking mode; LiteLLMOpenAI does not.
    return DeepSeek(
        id=alias,
        base_url=f"{litellm_url()}/v1",
        api_key=litellm_key(),
        use_thinking=thinking,
    )


def default_model() -> DeepSeek:
    """Fresh model instance per agent — avoids shared-state footguns."""
    return _deepseek(DEEPSEEK_FAST, thinking=False)


def manager_model() -> DeepSeek:
    """Model for OS Manager and Company Product Manager."""
    return _deepseek(DEEPSEEK_THINKING, thinking=True)


def embedder() -> OpenAIEmbedder:
    """GigaChat embeddings through the proxy's OpenAI-compatible /v1/embeddings."""
    return OpenAIEmbedder(
        id=GIGACHAT_EMBEDDINGS,
        dimensions=GIGACHAT_EMBEDDING_DIMENSIONS,
        base_url=f"{litellm_url()}/v1",
        api_key=litellm_key(),
    )
