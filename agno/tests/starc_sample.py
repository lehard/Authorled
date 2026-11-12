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


FIRST_SCREENPLAY = '<item uuid="{20a46ee4'
SECOND_TEXT_ID = "{00000000-0000-0000-0000-000000000011}"
# A screenplay of a cloud project of STARC whose documents the file does not have: only its record in the structure.
CLOUD_SCREENPLAY = (
    '<item uuid="{00000000-0000-0000-0000-000000000010}" type="application/x-starc/document/screenplay" name="Выбор 2">'
    f'<item uuid="{SECOND_TEXT_ID}" type="application/x-starc/document/screenplay/text" name="Сценарий"/></item>'
)
# A location whose profile the file does not have, before «МАЯК».
CLOUD_LOCATION = (
    '<item uuid="{00000000-0000-0000-0000-000000000020}" type="application/x-starc/document/location" name="КОЛИБА"/>'
)
LIGHTHOUSE = '<item uuid="{51f2c6e7'


def _with_structure(*changes: tuple[str, str]) -> bytes:
    """The sample whose structure has these replacements."""
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "copy.starc"
        path.write_bytes(SAMPLE.read_bytes())
        with closing(sqlite3.connect(path)) as database:
            (content,) = database.execute("SELECT content FROM documents WHERE type = ?", (STRUCTURE,)).fetchone()
            text = content.decode()
            for old, new in changes:
                assert old in text, old
                text = text.replace(old, new)
            database.execute("UPDATE documents SET content = ? WHERE type = ?", (text.encode(), STRUCTURE))
            database.commit()
        return path.read_bytes()


def cloud_project() -> bytes:
    """The sample with a second screenplay and a location that are only records of the structure."""
    return _with_structure(
        (FIRST_SCREENPLAY, CLOUD_SCREENPLAY + FIRST_SCREENPLAY), (LIGHTHOUSE, CLOUD_LOCATION + LIGHTHOUSE)
    )


def with_second_text(data: bytes) -> bytes:
    """`data` where the text of «Выбор 2» is in the file: a copy of the text of the first screenplay."""
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "copy.starc"
        path.write_bytes(data)
        with closing(sqlite3.connect(path)) as database:
            database.execute(
                "INSERT INTO documents (uuid, type, content) SELECT ?, type, content FROM documents WHERE type = ?",
                (SECOND_TEXT_ID, TEXT),
            )
            database.commit()
        return path.read_bytes()
