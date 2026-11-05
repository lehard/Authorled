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


def with_text(body: str) -> bytes:
    """The sample whose screenplay text is `body`, the XML inside the document."""
    start = '<document mime-type="application/x-starc/document/screenplay/text" version="1.0">'
    xml = f'<?xml version="1.0"?>\n{start}\n{body}\n</document>\n'.replace("'", "''")
    return run_sql(f"UPDATE documents SET content = CAST('{xml}' AS BLOB) WHERE type = {TEXT}")


def with_role(name: str, role: str) -> bytes:
    """The sample where the profile of `name` has this story role."""
    old = "<story_role><![CDATA[3]]></story_role>"
    new = f"<story_role><![CDATA[{role}]]></story_role>"
    return run_sql(
        f"UPDATE documents SET content = CAST(replace(CAST(content AS TEXT), '{old}', '{new}') AS BLOB) "
        f"WHERE type IN (30001, 40001) AND CAST(content AS TEXT) LIKE '%<name><![CDATA[{name}]]></name>%'"
    )


def novel() -> bytes:
    """A project without a screenplay."""
    return edited(STRUCTURE, 'document/screenplay"', 'document/novel"')
