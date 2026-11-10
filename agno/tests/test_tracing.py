"""Journal of agent runs in Phoenix (openspec/specs/agent-tracing): startup checks, lost batches, hidden texts.

No Phoenix and no model is needed: the health check runs against a local HTTP server of the test,
the exporter against stand-in exporters, the hiding of tool texts against an in-memory exporter.
"""

import ast
import logging
import threading
from collections.abc import Iterator, Sequence
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest
from openinference.instrumentation import OITracer
from openinference.semconv.trace import SpanAttributes
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter, SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from app.tracing import TRACE_CONFIG, LoggedExporter, check_phoenix, phoenix_url

URL = "http://phoenix.test:6006/v1/traces"


class _Exporter(SpanExporter):
    def __init__(self, result: SpanExportResult | None = None, error: Exception | None = None) -> None:
        self.result = result
        self.error = error

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        if self.error is not None:
            raise self.error
        assert self.result is not None
        return self.result


@pytest.fixture
def health_server(request: pytest.FixtureRequest) -> Iterator[str]:
    """A local server that answers /healthz with the status the test gives."""
    status: int = request.param

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 (name of the stdlib hook)
            self.send_response(status if self.path == "/healthz" else 404)
            self.end_headers()

        def log_message(self, format: str, *args: object) -> None:  # noqa: A002 (stdlib signature)
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    server.server_close()


def test_missing_url_is_named(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PHOENIX_URL", raising=False)
    with pytest.raises(RuntimeError, match="PHOENIX_URL"):
        phoenix_url()


def test_empty_url_is_named(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_URL", "")
    with pytest.raises(RuntimeError, match="PHOENIX_URL"):
        phoenix_url()


def test_url_loses_trailing_slash(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_URL", "http://127.0.0.1:6006/")
    assert phoenix_url() == "http://127.0.0.1:6006"


def test_silent_phoenix_stops_the_start() -> None:
    with pytest.raises(RuntimeError, match=r"http://127\.0\.0\.1:1/healthz"):
        check_phoenix("http://127.0.0.1:1")


@pytest.mark.parametrize("health_server", [200], indirect=True)
def test_healthy_phoenix_passes(health_server: str) -> None:
    check_phoenix(health_server)


@pytest.mark.parametrize("health_server", [503], indirect=True)
def test_unhealthy_phoenix_stops_the_start(health_server: str) -> None:
    with pytest.raises(RuntimeError, match=f"{health_server}/healthz"):
        check_phoenix(health_server)


@pytest.fixture(autouse=True)
def _tracing_logger_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """Alembic's fileConfig in the migration tests disables the loggers that exist by then; the API never runs it."""
    monkeypatch.setattr(logging.getLogger("app.tracing"), "disabled", False)


def test_failed_export_is_an_error(caplog: pytest.LogCaptureFixture) -> None:
    exporter = LoggedExporter(_Exporter(result=SpanExportResult.FAILURE), URL)
    with caplog.at_level(logging.ERROR, logger="app.tracing"):
        assert exporter.export([]) is SpanExportResult.FAILURE
    assert [record.levelno for record in caplog.records] == [logging.ERROR]
    assert URL in caplog.text


def test_raising_export_is_an_error_and_does_not_escape(caplog: pytest.LogCaptureFixture) -> None:
    exporter = LoggedExporter(_Exporter(error=ConnectionError("refused")), URL)
    with caplog.at_level(logging.ERROR, logger="app.tracing"):
        assert exporter.export([]) is SpanExportResult.FAILURE
    assert [record.levelno for record in caplog.records] == [logging.ERROR]
    assert URL in caplog.text
    assert "refused" in caplog.text


def test_successful_export_logs_nothing(caplog: pytest.LogCaptureFixture) -> None:
    exporter = LoggedExporter(_Exporter(result=SpanExportResult.SUCCESS), URL)
    with caplog.at_level(logging.DEBUG, logger="app.tracing"):
        assert exporter.export([]) is SpanExportResult.SUCCESS
    assert caplog.records == []


def test_main_sends_spans_to_phoenix_not_to_agno_tables() -> None:
    main = ast.parse((Path(__file__).resolve().parents[1] / "app" / "main.py").read_text())
    called = {node.func.id for node in ast.walk(main) if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)}
    assert "setup_agent_tracing" in called
    assert "setup_tracing" not in called


NOTE_TEXT = "Unique phrase of the author about the lighthouse"


@pytest.mark.parametrize(
    "key",
    [SpanAttributes.TOOL_PARAMETERS, f"{SpanAttributes.TOOL_PARAMETERS}.content", SpanAttributes.TOOL_DESCRIPTION],
)
def test_tool_arguments_and_description_are_dropped(key: str) -> None:
    assert TRACE_CONFIG.mask(key, NOTE_TEXT) is None


def test_other_attributes_keep_their_rules() -> None:
    assert TRACE_CONFIG.mask(SpanAttributes.TOOL_NAME, "create_story_note") == "create_story_note"
    assert TRACE_CONFIG.mask(SpanAttributes.INPUT_VALUE, NOTE_TEXT) == "__REDACTED__"


def test_tool_span_has_its_name_and_no_text() -> None:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = OITracer(provider.get_tracer(__name__), TRACE_CONFIG)
    with tracer.start_as_current_span(
        "create_story_note",
        attributes={
            SpanAttributes.TOOL_NAME: "create_story_note",
            SpanAttributes.TOOL_DESCRIPTION: "Create a note of the story.",
            SpanAttributes.TOOL_PARAMETERS: f'{{"title": "Lighthouse", "content": "{NOTE_TEXT}"}}',
            SpanAttributes.INPUT_VALUE: f'{{"content": "{NOTE_TEXT}"}}',
        },
    ) as span:
        span.set_attribute(SpanAttributes.TOOL_PARAMETERS, NOTE_TEXT)
        span.set_attributes({f"{SpanAttributes.TOOL_PARAMETERS}.content": NOTE_TEXT})
    [finished] = exporter.get_finished_spans()
    attributes = dict(finished.attributes or {})
    assert attributes[SpanAttributes.TOOL_NAME] == "create_story_note"
    assert not [key for key in attributes if key.startswith(SpanAttributes.TOOL_PARAMETERS)]
    assert SpanAttributes.TOOL_DESCRIPTION not in attributes
    assert not [key for key, value in attributes.items() if NOTE_TEXT in str(value)]
