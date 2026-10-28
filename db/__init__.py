"""Shared PostgreSQL storage and knowledge creation."""

from functools import cache

from agno.db.postgres import PostgresDb
from agno.knowledge import Knowledge
from agno.knowledge.reader import Reader
from agno.knowledge.reader.csv_reader import CSVReader
from agno.knowledge.reader.docx_reader import DocxReader
from agno.knowledge.reader.excel_reader import ExcelReader
from agno.knowledge.reader.markdown_reader import MarkdownReader
from agno.knowledge.reader.pdf_reader import PDFReader
from agno.knowledge.reader.text_reader import TextReader
from agno.knowledge.reader.website_reader import WebsiteReader
from agno.vectordb.pgvector import PgVector, SearchType

from app.settings import embedder
from db.url import db_url

__all__ = ["create_knowledge", "db_url", "get_postgres_db"]

DB_ID = "agentos-db"

# GigaChat Embeddings-2 accepts 512 input tokens; 1200 characters of Russian
# text stay well below it. CSV and Excel keep Agno's row chunking.
CHUNK_SIZE = 1200


def _readers() -> dict[str, Reader]:
    """Readers keyed by ReaderFactory keys, so URLs and uploads with reader_id use them.

    File uploads without reader_id are read by ReaderFactory defaults (5000 characters)
    in Agno 3.1.10; pass reader_id or chunker/chunk_size with the upload.
    """
    return {
        "pdf": PDFReader(chunk_size=CHUNK_SIZE),
        "docx": DocxReader(chunk_size=CHUNK_SIZE),
        "csv": CSVReader(),
        "excel": ExcelReader(),
        "markdown": MarkdownReader(chunk_size=CHUNK_SIZE),
        "text": TextReader(chunk_size=CHUNK_SIZE),
        "website": WebsiteReader(chunk_size=CHUNK_SIZE),
    }


@cache
def get_postgres_db() -> PostgresDb:
    """Return the shared database for AgentOS and its components."""
    return PostgresDb(id=DB_ID, db_url=db_url)


def create_knowledge(name: str, table_name: str) -> Knowledge:
    """Create hybrid-search knowledge with its own content adapter."""
    contents_table = f"{table_name}_contents"
    return Knowledge(
        name=name,
        vector_db=PgVector(
            db_url=db_url,
            table_name=table_name,
            search_type=SearchType.hybrid,
            embedder=embedder(),
        ),
        readers=_readers(),
        contents_db=PostgresDb(
            id=f"{DB_ID}-{contents_table}",
            db_url=db_url,
            knowledge_table=contents_table,
        ),
    )
