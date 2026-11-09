"""Journal of agent runs in Phoenix (openspec/specs/agent-tracing).

Agno instruments agents, teams and workflows through OpenTelemetry (openinference). The application
gives the instrumentor a TracerProvider of its own that sends spans to Phoenix over OTLP/HTTP in
batches. The provider is never made global: FastAPI 0.159 traces every request into the global
provider once one is configured, and those HTTP spans would become the root of every trace. With
the global provider left unconfigured, the root of a trace is the run of an agent or a team.

The spans carry no text: messages, prompts, answers, inputs and outputs of agents and tools are
hidden by the openinference TraceConfig. Names, models, tokens, durations, statuses and errors stay.

Phoenix is required at startup: no PHOENIX_URL or no answer from Phoenix stops the API. Once
running, a failed export is logged as an error and the run of the author goes on; the spans of
that batch are lost (owner's decision 2026-11-09, the only exception to "no fallbacks" here).
"""

import logging
import urllib.error
import urllib.request
from collections.abc import Sequence
from os import environ

from openinference.instrumentation import TraceConfig
from openinference.instrumentation.agno import AgnoInstrumentor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import ReadableSpan, SpanLimits, TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter, SpanExportResult

log = logging.getLogger(__name__)

HEALTH_TIMEOUT_SECONDS = 5
EXPORT_TIMEOUT_SECONDS = 10
# The same limit Agno's setup_tracing sets: a run of an agent with many tools has many attributes.
MAX_SPAN_ATTRIBUTES = 1024

# Everything that could carry the text of an author, a prompt or an answer is hidden.
TRACE_CONFIG = TraceConfig(
    hide_inputs=True,
    hide_outputs=True,
    hide_input_messages=True,
    hide_output_messages=True,
    hide_input_images=True,
    hide_input_text=True,
    hide_output_text=True,
    hide_prompts=True,
    hide_choices=True,
    hide_embeddings_text=True,
    hide_embeddings_vectors=True,
    hide_retrieval_documents=True,
)


def phoenix_url() -> str:
    """PHOENIX_URL, the base address of Phoenix; the API does not start without it."""
    url = environ.get("PHOENIX_URL")
    if not url:
        raise RuntimeError("Required environment variable PHOENIX_URL is not set (address of Phoenix)")
    return url.rstrip("/")


def check_phoenix(url: str) -> None:
    """Stop the start when Phoenix does not answer its health check."""
    health = f"{url}/healthz"
    try:
        with urllib.request.urlopen(health, timeout=HEALTH_TIMEOUT_SECONDS) as response:
            status = response.status
    except (urllib.error.URLError, OSError) as error:
        raise RuntimeError(f"Phoenix does not answer at {health}: {error}") from error
    if status != 200:
        raise RuntimeError(f"Phoenix answered {status} at {health}, expected 200")


class LoggedExporter(SpanExporter):
    """The OTLP exporter, with every lost batch logged as an error naming Phoenix.

    The OTLP exporter reports a failed request as a warning; the journal needs it as an error. The
    result is passed on unchanged: no retry beyond the exporter's own, no other destination.
    """

    def __init__(self, exporter: SpanExporter, url: str) -> None:
        self._exporter = exporter
        self._url = url

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        try:
            result = self._exporter.export(spans)
        except Exception:
            log.exception("Lost %d spans: export to Phoenix at %s raised", len(spans), self._url)
            return SpanExportResult.FAILURE
        if result is not SpanExportResult.SUCCESS:
            log.error("Lost %d spans: export to Phoenix at %s failed", len(spans), self._url)
        return result

    def shutdown(self) -> None:
        self._exporter.shutdown()

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        return self._exporter.force_flush(timeout_millis)


def setup_agent_tracing() -> TracerProvider:
    """Send the spans of agent runs to Phoenix; call once, before AgentOS is created."""
    url = phoenix_url()
    check_phoenix(url)
    endpoint = f"{url}/v1/traces"
    provider = TracerProvider(span_limits=SpanLimits(max_span_attributes=MAX_SPAN_ATTRIBUTES))
    exporter = LoggedExporter(OTLPSpanExporter(endpoint=endpoint, timeout=EXPORT_TIMEOUT_SECONDS), endpoint)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    AgnoInstrumentor().instrument(tracer_provider=provider, config=TRACE_CONFIG)
    return provider
