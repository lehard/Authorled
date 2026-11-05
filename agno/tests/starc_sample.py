"""The STARC sample of the tests and its spoiled copies.

project.starc keeps the tables and the XML of a real file saved in STARC 0.8.2; its content is invented and its
history of changes is empty.
"""

import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

SAMPLE = Path(__file__).parent / "fixtures" / "import" / "project.starc"
STRUCTURE = 1
TEXT = 10104


def run_sql(sql: str) -> bytes:
    """The sample after one SQL statement."""
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "copy.starc"
        path.write_bytes(SAMPLE.read_bytes())
        with closing(sqlite3.connect(path)) as database:
            database.execute(sql)
            database.commit()
        return path.read_bytes()


def edited(document_type: int, old: str, new: str) -> bytes:
    """The sample with `old` replaced by `new` in the document of this type."""
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "copy.starc"
        path.write_bytes(SAMPLE.read_bytes())
        with closing(sqlite3.connect(path)) as database:
            (content,) = database.execute("SELECT content FROM documents WHERE type = ?", (document_type,)).fetchone()
            text = content.decode()
            assert old in text, old
            database.execute(
                "UPDATE documents SET content = ? WHERE type = ?", (text.replace(old, new).encode(), document_type)
            )
            database.commit()
        return path.read_bytes()


def novel() -> bytes:
    """A project without a screenplay."""
    return edited(STRUCTURE, 'document/screenplay"', 'document/novel"')
