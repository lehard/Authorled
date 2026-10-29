"""
App Settings
============

Shared runtime objects for the platform. Every model call goes through the
LiteLLM proxy (`litellm/config.yaml`); model names below are proxy aliases.
"""

from os import getenv
from typing import Any

from agno.knowledge.embedder.openai import OpenAIEmbedder
from agno.models.deepseek import DeepSeek

# Proxy aliases declared in litellm/config.yaml.
DEEPSEEK_FAST = "deepseek-fast"
DEEPSEEK_THINKING = "deepseek-thinking"
# Embedding aliases the application accepts in EMBEDDINGS_MODEL. All return
# EMBEDDING_DIMENSIONS-sized vectors; models with other sizes must not be added
# (the pgvector HNSW index holds at most 2000 dimensions).
EMBEDDING_ALIASES = (
    "gigachat-embeddings",
    "giga-embeddings",
    "bge-m3-embeddings",
    "qwen3-embeddings",
)
EMBEDDING_DIMENSIONS = 1024


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


def embeddings_model() -> str:
    """Proxy alias of the active embedding model, chosen by EMBEDDINGS_MODEL."""
    alias = _required_env("EMBEDDINGS_MODEL")
    if alias not in EMBEDDING_ALIASES:
        raise RuntimeError(f"EMBEDDINGS_MODEL={alias!r} is not supported; use one of: {', '.join(EMBEDDING_ALIASES)}")
    return alias


def _check_dimensions(embedding: Any) -> None:
    if len(embedding) != EMBEDDING_DIMENSIONS:
        raise RuntimeError(f"Embedding model returned {len(embedding)} dimensions, expected {EMBEDDING_DIMENSIONS}")


class _CheckedEmbedder(OpenAIEmbedder):
    """OpenAIEmbedder that rejects vectors of the wrong size instead of passing them on."""

    def get_embedding(self, text: str) -> list[float]:
        embedding = super().get_embedding(text)
        _check_dimensions(embedding)
        return embedding

    def get_embedding_and_usage(self, text: str) -> tuple[list[float], dict | None]:
        embedding, usage = super().get_embedding_and_usage(text)
        _check_dimensions(embedding)
        return embedding, usage

    async def async_get_embedding(self, text: str) -> list[float]:
        embedding = await super().async_get_embedding(text)
        _check_dimensions(embedding)
        return embedding

    async def async_get_embedding_and_usage(self, text: str):
        embedding, usage = await super().async_get_embedding_and_usage(text)
        _check_dimensions(embedding)
        return embedding, usage

    async def async_get_embeddings_batch_and_usage(self, texts: list[str]):
        embeddings, usage = await super().async_get_embeddings_batch_and_usage(texts)
        for embedding in embeddings:
            _check_dimensions(embedding)
        return embeddings, usage


def embedder() -> OpenAIEmbedder:
    """Embeddings through the proxy's OpenAI-compatible /v1/embeddings (alias from EMBEDDINGS_MODEL)."""
    return _CheckedEmbedder(
        id=embeddings_model(),
        dimensions=EMBEDDING_DIMENSIONS,
        base_url=f"{litellm_url()}/v1",
        api_key=litellm_key(),
    )
