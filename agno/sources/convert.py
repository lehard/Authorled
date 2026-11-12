"""A draft of the canon from a file of a book (openspec/specs/sources/library, «Подготовка черновика из файла книги»).

Runs on the owner's Mac (design of storytelling-sources, decision 10): the file passes the antivirus of the stand
first, then pandoc, calibre, the PDF text of the core or djvutxt turn it into Markdown. The draft goes to
`<canon>/drafts/`, where loading never looks; the owner and the model finish it into the canon.
"""

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import yaml  # type: ignore[import-untyped]

from core.clamav import scan
from core.errors import Invalid
from core.files import pdf_text

PANDOC = (".epub", ".fb2", ".docx", ".rtf", ".odt", ".html", ".htm", ".txt", ".md")
CALIBRE = (".mobi", ".azw3")
SUPPORTED = (*PANDOC, *CALIBRE, ".pdf", ".djvu")
INSTALL = {
    "pandoc": "brew install pandoc",
    "ebook-convert": "brew install --cask calibre",
    "djvutxt": "brew install djvulibre",
}
ILLUSTRATION = "[Иллюстрация: ]"
OPTIONAL_KEYS = ("original_year", "edition_year", "translator", "translation_year", "original_title")

_IMAGE = re.compile(r"!\[[^\]]*\]\([^)]*\)(\{[^}]*\})?")
# Comments of HTML, which pandoc keeps even without raw HTML: page and scan markers of OCR books.
_COMMENT = re.compile(r"<!--.*?-->\n?", re.DOTALL)
_TRANSLIT = dict(
    zip(
        "абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
        "a b v g d e e zh z i y k l m n o p r s t u f h ts ch sh sch  y  e yu ya".split(" "),
        strict=True,
    )
)
# Metadata pandoc finds in a book: title, authors one per line after a tab, language.
_META_TEMPLATE = "$title$\n$for(author)$$author$$sep$\t$endfor$\n$if(lang)$$lang$$else$$language$$endif$\n"


def converter_for(path: Path) -> str:
    """What turns this file into Markdown: pandoc, calibre, pdf or djvu."""
    suffix = path.suffix.lower()
    if suffix in PANDOC:
        return "pandoc"
    if suffix in CALIBRE:
        return "calibre"
    if suffix in (".pdf", ".djvu"):
        return suffix[1:]
    raise Invalid(
        f"{path.name}: формат «{suffix or 'без расширения'}» не поддерживается; поддерживаются {', '.join(SUPPORTED)}."
    )


def draft_slug(stem: str) -> str:
    """The name of a canon file from the name of a book file: Latin letters, digits and hyphens."""
    latin = "".join(_TRANSLIT.get(char, char) for char in stem.lower())
    slug = re.sub(r"[^a-z0-9]+", "-", latin).strip("-")
    if not slug:
        raise Invalid(f"{stem}: из имени файла не выходит имя канона; переименуйте файл латиницей.")
    return slug


def replace_images(markdown: str) -> str:
    """Images become a blank description the owner fills in or removes; comments of HTML (page markers) go."""
    return _COMMENT.sub("", _IMAGE.sub(ILLUSTRATION, markdown))


def _program(name: str) -> str:
    found = shutil.which(name)
    if found is None:
        raise Invalid(f"Нет программы {name}: установите её командой «{INSTALL[name]}».")
    return found


def _run(command: list[str]) -> str:
    done = subprocess.run(command, capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise Invalid(f"{Path(command[0]).name} не разобрал файл: {done.stderr.strip()[:500]}")
    return done.stdout


def _pandoc(path: Path) -> tuple[str, dict[str, object]]:
    pandoc = _program("pandoc")
    body = _run([pandoc, str(path), "-t", "gfm-raw_html", "--wrap=none"])
    with tempfile.TemporaryDirectory() as folder:
        template = Path(folder) / "meta.txt"
        template.write_text(_META_TEMPLATE, encoding="utf-8")
        title, authors, lang = (_run([pandoc, str(path), "-t", "plain", "--template", str(template)]) + "\n\n").split(
            "\n"
        )[:3]
    meta: dict[str, object] = {"title": title.strip(), "authors": [a.strip() for a in authors.split("\t") if a.strip()]}
    language = lang.strip().lower()[:2]
    meta["language"] = language if language in ("ru", "en") else ""
    return body, meta


def _calibre(path: Path) -> tuple[str, dict[str, object]]:
    converter = _program("ebook-convert")
    with tempfile.TemporaryDirectory() as folder:
        epub = Path(folder) / "book.epub"
        _run([converter, str(path), str(epub)])
        return _pandoc(epub)


def _djvu(path: Path) -> str:
    text = _run([_program("djvutxt"), str(path)])
    if not text.strip():
        raise Invalid(f"{path.name}: в файле DjVu нет текста — возможно, это сканы страниц.")
    return text


def _header(meta: dict[str, object]) -> str:
    known = {key: meta.get(key) or ("" if key != "authors" else []) for key in ("title", "authors", "language")}
    header = yaml.safe_dump(known, allow_unicode=True, sort_keys=False, default_flow_style=None)
    hints = "".join(f"# {key}:\n" for key in OPTIONAL_KEYS)
    return f"---\n{header}{hints}---\n\n"


def draft(path: Path) -> str:
    """The text of the draft canon of the book file `path`, after the antivirus."""
    kind = converter_for(path)
    data = path.read_bytes()
    threat = scan(data)
    if threat is not None:
        raise Invalid(f"{path.name}: антивирус нашёл угрозу {threat}; файл не разбирается.")
    meta: dict[str, object] = {}
    match kind:
        case "pandoc":
            body, meta = _pandoc(path)
        case "calibre":
            body, meta = _calibre(path)
        case "pdf":
            body = pdf_text(data)
        case _:
            body = _djvu(path)
    if not body.strip():
        raise Invalid(f"{path.name}: в файле нет текста.")
    return _header(meta) + replace_images(body).strip() + "\n"


def convert(path: Path, canon: Path, force: bool = False) -> Path:
    """Write the draft of `path` to `<canon>/drafts/<slug>.md`; an existing draft stays without `force`."""
    if not path.is_file():
        raise Invalid(f"{path}: файла нет.")
    if not canon.is_dir():
        raise Invalid(f"{canon}: папки канона нет.")
    target = canon / "drafts" / f"{draft_slug(path.stem)}.md"
    if target.exists() and not force:
        raise Invalid(f"{target}: черновик уже есть; добавьте --force, чтобы заменить его.")
    text = draft(path)
    target.parent.mkdir(exist_ok=True)
    target.write_text(text, encoding="utf-8")
    return target
