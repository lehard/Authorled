"""python -m sources convert <file> <canon> [--force] | check <canon> | load <canon> | remove <slug> | list
(openspec/specs/sources/library, «Команды владельца»).

Locally ./scripts/dev.sh sources runs it on the host with the database of the checkout; on the server
./scripts/sources.sh runs it in the API container with the canon in /sources. `load` checks every book of the canon
before it spends the embedding model, then writes one book at a time, each in one transaction. A failure exits
non-zero with its reason; the text of the books is never printed.
"""

import argparse
import sys
from pathlib import Path

from app.settings import embedder, embeddings_model
from core.engine import get_engine
from core.errors import Invalid, NotFound
from core.sources import Book, list_books, parse_canon, remove_book, save_book
from sources.convert import convert

# Pieces in one request to the embedding model.
BATCH = 64


def _canon(folder: Path) -> list[Book]:
    """Every book of the top level of the canon folder, checked; all problems are reported before the first raise."""
    if not folder.is_dir():
        raise Invalid(f"{folder}: папки канона нет.")
    books: list[Book] = []
    problems: list[str] = []
    for path in sorted(folder.glob("*.md")):
        try:
            books.append(parse_canon(path.name, path.read_text(encoding="utf-8")))
        except Invalid as refusal:
            problems.append(refusal.detail)
    if problems:
        raise Invalid("\n".join(problems))
    if not books:
        raise Invalid(f"{folder}: в папке канона нет книг (*.md верхнего уровня).")
    return books


def _check(folder: Path) -> None:
    for book in _canon(folder):
        print(f"{book.meta.slug}: {len(book.pieces)} кусков")


def _load(folder: Path) -> None:
    books = _canon(folder)
    model = embeddings_model()
    vectors_of = embedder()
    for book in books:
        texts = [piece.content for piece in book.pieces]
        vectors = [
            vector
            for start in range(0, len(texts), BATCH)
            for vector in vectors_of.embed_batch(texts[start : start + BATCH])
        ]
        with get_engine().begin() as connection:
            save_book(connection, book, vectors, model)
        print(f"{book.meta.slug}: загружено {len(book.pieces)} кусков ({model})")


def _remove(slug: str) -> None:
    with get_engine().begin() as connection:
        remove_book(connection, slug)
    print(f"{slug}: удалена")


def _list() -> None:
    with get_engine().connect() as connection:
        books = list_books(connection)
    if not books:
        print("Библиотека пуста.")
    for book in books:
        print(
            f"{book.slug}\t{book.title}\t{', '.join(book.authors)}\t{book.language}\t{book.pieces} кусков\t"
            f"{book.embedding_model}\t{book.loaded_at:%Y-%m-%d %H:%M} UTC"
        )


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="python -m sources")
    commands = parser.add_subparsers(dest="command", required=True)
    converting = commands.add_parser("convert", help="черновик канона из файла книги")
    converting.add_argument("file", type=Path)
    converting.add_argument("canon", type=Path)
    converting.add_argument("--force", action="store_true", help="заменить готовый черновик")
    commands.add_parser("check", help="проверить канон без загрузки").add_argument("canon", type=Path)
    commands.add_parser("load", help="загрузить все книги канона").add_argument("canon", type=Path)
    commands.add_parser("remove", help="убрать книгу из библиотеки").add_argument("slug")
    commands.add_parser("list", help="загруженные книги")
    args = parser.parse_args(argv)
    try:
        match args.command:
            case "convert":
                print(convert(args.file, args.canon, args.force))
            case "check":
                _check(args.canon)
            case "load":
                _load(args.canon)
            case "remove":
                _remove(args.slug)
            case _:
                _list()
    except (Invalid, NotFound) as refusal:
        print(str(refusal), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
