"""Tools of the co-author: it reads the draft of the conversation, proposes edits of the screenplay and, by the
author's request, changes notes (also from a file of the conversation), documents and comments
(openspec/specs/api/agents, «Инструменты соавтора», «Действия соавтора», «Комментарий соавтором»).

The draft comes only from the conversation (session id `<projectId>:<draftId>:<uuid>`), the caller only from the run;
access goes through the auth module, as in the product routes. The screenplay text changes only through suggestions,
which the author accepts or rejects; nothing is deleted, trashed or decided here. The changing tools (CHANGING_TOOLS)
pause the run until the chat answers: the author in the mode `ask`, the chat itself in the
mode `auto` (COAUTHOR_TOOLS). A refusal is returned as text, so the model sees the reason;
a done change is JSON with `done` for the model and `target` for the chat, which links to what changed.
"""

import json
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from agno.run import RunContext
from agno.tools.function import Function

import billing
from app.auth import can_access_project, run_principal
from core import documents as docs
from core import notes, review, search, story_templates, texts
from core.engine import get_engine
from core.errors import Conflict, Invalid, Locked, NotFound, TooLarge
from core.fields import FIELD_HINTS, Role, field_guide
from core.files import file_text as stored_file_text
from core.files import get_file
from core.users import active_user_id

STORY_NOT_FOUND = "Отказ: история не найдена."
# One part of a note the co-author reads at a time: the same as the open document in the chat context
# (web/src/screens/project/chat/docContext.ts, MAX_CHARS).
NOTE_PART_CHARS = 20_000


class Refusal(Exception):
    """A reason the tool gives the model instead of data."""


def _draft(run_context: RunContext) -> docs.Draft:
    """The draft of the conversation, if the caller owns its story and the draft is outside the trash."""
    parts = (run_context.session_id or "").split(":")
    try:
        project_id, draft_id = uuid.UUID(parts[0]), uuid.UUID(parts[1])
    except (ValueError, IndexError) as error:
        raise Refusal("Отказ: беседа не относится к драфту истории, читать нечего.") from error
    if len(parts) != 3 or not can_access_project(run_principal(run_context), str(project_id)):
        raise Refusal(STORY_NOT_FOUND)
    with get_engine().connect() as connection:
        draft = docs.draft_row(connection, draft_id)
        if draft.project_id != project_id:
            raise Refusal(STORY_NOT_FOUND)
        docs.ensure_draft_open(connection, draft)
    return draft


def _answer(work: Callable[[], Any]) -> str:
    try:
        result = work()
    except Refusal as refusal:
        return str(refusal)
    except (NotFound, Invalid, Conflict, Locked, TooLarge) as error:
        return f"Отказ: {error}"
    return result if isinstance(result, str) else json.dumps(result, ensure_ascii=False, default=str)


def _document_of_draft(connection: Any, draft_id: uuid.UUID, document_id: str) -> docs.Document:
    try:
        document = docs.document_row(connection, uuid.UUID(document_id))
    except ValueError as error:
        raise Refusal("Отказ: документ не найден.") from error
    if document.draft_id != draft_id or document.deleted_at is not None:
        raise Refusal("Отказ: документ не найден.")
    return document


def list_story_documents(run_context: RunContext) -> str:
    """Документы драфта этой беседы: сценарий, персонажи, локации и миры (без корзины).

    Возвращает id, вид, имя, роль и короткое описание каждого документа. Используй, чтобы найти
    документ, о котором спрашивает автор, и затем прочитать его через read_story_document.
    """

    def work() -> Any:
        draft = _draft(run_context)
        with get_engine().connect() as connection:
            return [
                {"id": d.id, "kind": d.kind, "name": d.name, "role": d.role, "summary": d.summary}
                for d in docs.list_documents(connection, draft.id)
                if d.deleted_at is None
            ]

    return _answer(work)


def read_story_document(run_context: RunContext, document_id: str) -> str:
    """Поля документа драфта: профиль персонажа, локации или мира, паспорт сценария.

    Args:
        document_id: id документа из list_story_documents.
    """

    def work() -> Any:
        draft = _draft(run_context)
        with get_engine().connect() as connection:
            document = _document_of_draft(connection, draft.id, document_id)
        return {
            "id": document.id,
            "kind": document.kind,
            "name": document.name,
            "role": document.role,
            "summary": document.summary,
            "fields": {key: value for key, value in document.fields.items() if value not in ("", None)},
        }

    return _answer(work)


def _lines(blocks: list[dict[str, Any]]) -> list[str]:
    return [f"[{block['type']}] {texts.block_text(block)}" for block in blocks if block["type"] != "pageBreak"]


def read_screenplay(run_context: RunContext, scene_uid: str = "") -> str:
    """Текст сценария драфта этой беседы: целиком или одна сцена.

    Каждая строка — абзац с типом в скобках. Сцены помечены заголовком «Сцена N, uid …»: uid нужен,
    чтобы прочитать одну сцену или предложить правку в ней.

    Args:
        scene_uid: uid сцены; пусто — весь текст.
    """

    def work() -> Any:
        draft = _draft(run_context)
        with get_engine().connect() as connection:
            content = texts.get_text(connection, texts.screenplay_id(connection, draft.id)).content
        found = texts.scenes(content)
        if scene_uid:
            scene = next((s for s in found if s.uid == scene_uid), None)
            if scene is None:
                raise Refusal(f"Отказ: сцены {scene_uid} нет в тексте сценария.")
            return "\n".join([f"Сцена {scene.number}, uid {scene.uid}", *_lines(scene.blocks)])
        out: list[str] = []
        starts = {id(s.blocks[0]): s for s in found}
        for block in content["content"]:
            scene = starts.get(id(block))
            if scene is not None:
                out.append(f"\nСцена {scene.number}, uid {scene.uid}")
            out.extend(_lines([block]))
        return "\n".join(out).strip()

    return _answer(work)


def list_story_templates(run_context: RunContext) -> str:
    """Каркасы структуры историй сервиса: id, название, описание, акты и точки с подсказками.

    Используй, когда автор просит разложить историю по каркасу (три акта, путешествие героя и т. п.):
    других каркасов, кроме этих, в сервисе нет.
    """

    def work() -> Any:
        _draft(run_context)
        out: list[str] = []
        for found in story_templates.templates():
            out.append(f"Каркас «{found.name}» (id {found.id}): {found.description}")
            for act in found.acts:
                out.append(f"  Акт «{act.name}»")
                out.extend(f"    — {point.name}: {point.hint}" for point in act.points)
        return "\n".join(out)

    return _answer(work)


_KIND_WORDS = {"character": "персонаж", "location": "локация", "world": "мир"}
_COMMON_FIELDS = {"name": "имя или название", "summary": "короткое описание"}


def _piece(snippet: search.Snippet) -> str:
    return f"{snippet.before}«{snippet.match}»{snippet.after}"


def _found(result: search.SearchResult) -> str:
    if not (result.scenes or result.documents or result.notes):
        return f"Ничего не нашлось по запросу «{result.query}»."
    out = [f"Найдено по запросу «{result.query}» (регистр и ё/е не различаются):"]
    if result.scenes:
        out.append("Сцены:")
        for scene in result.scenes:
            where = "Вне сцен" if scene.uid is None else f"Сцена {scene.number}, uid {scene.uid}"
            out.append(f"- {where} (совпадений {scene.count}): {_piece(scene.snippet)}")
    if result.documents:
        out.append("Документы:")
        for document in result.documents:
            if document.kind == "script":
                what = f"{FIELD_HINTS['script'][document.field]} сценария, id {document.id}"
            else:
                label = _COMMON_FIELDS.get(document.field) or FIELD_HINTS[document.kind][document.field]
                what = f"{_KIND_WORDS[document.kind]} «{document.name}», id {document.id}, поле «{label}»"
            out.append(f"- {what} (совпадений {document.count}): {_piece(document.snippet)}")
    if result.notes:
        out.append("Заметки:")
        for note in result.notes:
            where = "в названии" if note.field == "title" else "в тексте"
            out.append(f"- «{note.title}», id {note.id}, {where} (совпадений {note.count}): {_piece(note.snippet)}")
    return "\n".join(out)


def search_story(run_context: RunContext, query: str) -> str:
    """Поиск слова, имени, предмета или фразы по драфту этой беседы и заметкам истории.

    Ищет в тексте сценария, логлайне, синопсисе, персонажах, локациях, мирах и заметках (без корзины),
    без учёта регистра и разницы ё/е. Возвращает сцены с uid, документы и заметки с id и кусочком текста
    вокруг первого совпадения; целиком найденное читай через read_screenplay, read_story_document
    или read_story_note.

    Args:
        query: что искать, не короче 2 символов, например «лодка» или «ключ».
    """

    def work() -> Any:
        draft = _draft(run_context)
        with get_engine().connect() as connection:
            return _found(search.search_draft(connection, draft.id, query))

    return _answer(work)


def read_chat_file(run_context: RunContext, file_id: str) -> str:
    """Текст файла, который автор прикрепил к этой беседе.

    Args:
        file_id: id файла из сообщения автора.
    """

    def work() -> Any:
        project_id = _draft(run_context).project_id
        try:
            found = uuid.UUID(file_id)
        except ValueError as error:
            raise Refusal("Отказ: файл не найден в этой беседе.") from error
        with get_engine().connect() as connection:
            stored = get_file(connection, found)
            if stored.project_id != project_id or stored.session_id != run_context.session_id:
                raise Refusal("Отказ: файл не найден в этой беседе.")
            return f"Файл «{stored.name}»:\n{stored_file_text(connection, found)}"

    return _answer(work)


def suggest_edit(run_context: RunContext, scene_uid: str, quote: str, text: str, why: str) -> str:
    """Предложить автору правку фрагмента сценария. Текст автора не меняется, пока автор не примет правку.

    Args:
        scene_uid: uid сцены из read_screenplay.
        quote: точная цитата из одного абзаца этой сцены, которую заменить (символ в символ).
        text: предлагаемый текст вместо цитаты; пусто — убрать цитату.
        why: коротко, зачем эта правка.
    """

    def work() -> Any:
        draft = _draft(run_context)
        with get_engine().begin() as connection:
            suggestion = review.create_suggestion(
                connection,
                texts.screenplay_id(connection, draft.id),
                scene_uid,
                quote,
                text,
                why,
                run_context.session_id,
            )
        return (
            f"Предложение {suggestion.id} отправлено автору: «{quote}» → «{text}». "
            "Текст сценария изменится, только если автор его примет."
        )

    return _answer(work)


KIND_NAMES = {"character": "персонаж", "location": "локация", "world": "мир", "script": "сценарий"}


def _done(done: str, target_type: str, target_id: uuid.UUID, **extra: str) -> dict[str, Any]:
    return {"done": done, "target": {"type": target_type, "id": str(target_id), **extra}}


def _caller(connection: Any, run_context: RunContext) -> uuid.UUID:
    return active_user_id(connection, run_principal(run_context).user_id)


def _note_of_story(connection: Any, project_id: uuid.UUID, note_id: str) -> notes.Note:
    try:
        note = notes.note_row(connection, uuid.UUID(note_id))
    except (ValueError, NotFound) as error:
        raise Refusal("Отказ: заметка не найдена.") from error
    if note.project_id != project_id or note.deleted_at is not None:
        raise Refusal("Отказ: заметка не найдена.")
    return note


def list_story_notes(run_context: RunContext) -> str:
    """Заметки истории этой беседы (общие для всех драфтов, без корзины): id, название, начало текста, длина текста
    в знаках и `file` — имя файла-оригинала, если заметка сделана из файла (материал), иначе null.

    Используй, чтобы найти заметку, о которой говорит автор, и затем прочитать её через read_story_note.
    """

    def work() -> Any:
        draft = _draft(run_context)
        with get_engine().connect() as connection:
            return [
                {
                    "id": n.id,
                    "title": n.title,
                    "start": n.body[:200],
                    "length": len(n.body),
                    "file": None if n.file is None else n.file.name,
                }
                for n in notes.list_notes(connection, draft.project_id)
                if n.deleted_at is None
            ]

    return _answer(work)


def read_story_note(run_context: RunContext, note_id: str, part: int = 1) -> str:
    """Заметка истории частями по 20 000 знаков: название, `part` — номер этой части, `parts` — сколько их всего,
    `body` — текст части. Длинную заметку читай по частям, пока не найдёшь нужное.

    Args:
        note_id: id заметки из list_story_notes.
        part: номер части, с 1.
    """

    def work() -> Any:
        draft = _draft(run_context)
        with get_engine().connect() as connection:
            note = _note_of_story(connection, draft.project_id, note_id)
        parts = max(1, -(-len(note.body) // NOTE_PART_CHARS))
        if not 1 <= part <= parts:
            raise Refusal(f"Отказ: в заметке {parts} частей, части {part} нет.")
        start = (part - 1) * NOTE_PART_CHARS
        return {
            "id": note.id,
            "title": note.title,
            "part": part,
            "parts": parts,
            "body": note.body[start : start + NOTE_PART_CHARS],
        }

    return _answer(work)


def create_story_note(run_context: RunContext, title: str, body: str = "") -> str:
    """Создать заметку истории. Только по прямой просьбе автора.

    Args:
        title: название заметки, непустое.
        body: текст заметки.
    """

    def work() -> Any:
        draft = _draft(run_context)
        with get_engine().begin() as connection:
            note = notes.create_note(connection, draft.project_id, title, body, _caller(connection, run_context))
        return _done(f"Создана заметка «{note.title}»", "note", note.id)

    return _answer(work)


def save_chat_file_to_notes(run_context: RunContext, file_id: str) -> str:
    """Сохранить файл, который автор прикрепил к этой беседе, в заметки истории: заметка получит текст файла и сам
    файл как оригинал. Только по прямой просьбе автора («сохрани в заметки», «положи в материалы»).

    Args:
        file_id: id файла из сообщения автора.
    """

    def work() -> Any:
        draft = _draft(run_context)
        try:
            found = uuid.UUID(file_id)
        except ValueError as error:
            raise Refusal("Отказ: файл не найден в этой беседе.") from error
        with get_engine().connect() as connection:
            stored = get_file(connection, found)
            user = _caller(connection, run_context)
        if stored.project_id != draft.project_id or stored.session_id != run_context.session_id:
            raise Refusal("Отказ: файл не найден в этой беседе.")
        try:
            place = billing.storage_limit(user, datetime.now(UTC))
        except billing.SubscriptionEnded as error:
            raise Refusal("Отказ: подписка закончилась, файлы в заметки не сохраняются.") from error
        with get_engine().begin() as connection:
            note = notes.create_note_from_chat_file(connection, found, user, place)
        return _done(f"Файл сохранён в заметку «{note.title}»", "note", note.id)

    return _answer(work)


def update_story_note(
    run_context: RunContext, note_id: str, title: str | None = None, body: str | None = None, append: str | None = None
) -> str:
    """Изменить заметку истории: название, весь текст или дописать в конец. Только по прямой просьбе автора.

    Args:
        note_id: id заметки из list_story_notes.
        title: новое название; не передавай, если не меняется.
        body: новый текст целиком; не передавай вместе с append.
        append: что дописать в конец текста с новой строки.
    """

    def work() -> Any:
        draft = _draft(run_context)
        changes = {
            key: value for key, value in (("title", title), ("body", body), ("append", append)) if value is not None
        }
        with get_engine().begin() as connection:
            found = _note_of_story(connection, draft.project_id, note_id)
            note = notes.update_note_by_coauthor(connection, found.id, changes, _caller(connection, run_context))
        return _done(f"Изменена заметка «{note.title}»", "note", note.id)

    return _answer(work)


def create_story_document(
    run_context: RunContext,
    kind: str,
    name: str,
    role: Role | None = None,
    summary: str = "",
    fields: dict[str, str] | None = None,
) -> str:
    """Создать персонажа, локацию или мир в драфте этой беседы. Только по прямой просьбе автора.

    Сведения о персонаже, локации или мире клади в поля профиля (fields), а не в summary. Значение каждого поля —
    строка. Поля по видам (имя — что в нём):
    {fields}

    Args:
        kind: character, location или world.
        name: имя персонажа или название локации, мира.
        role: роль персонажа или локации, у них обязательна: main — главная, secondary — второстепенная, episodic —
            эпизодическая; у мира роли нет, не передавай.
        summary: одной фразой, кто это или что это.
        fields: поля профиля этого вида из списка выше, значения — строки.
    """

    def work() -> Any:
        draft = _draft(run_context)
        item: dict[str, Any] = {"kind": kind, "name": name, "summary": summary, "fields": fields or {}}
        if role is not None:
            item["role"] = role
        with get_engine().begin() as connection:
            (document,) = docs.create_documents(connection, draft.id, [item], _caller(connection, run_context))
        what = KIND_NAMES[document.kind]
        return _done(f"Создан документ: {what} «{document.name}»", "document", document.id, kind=document.kind)

    return _answer(work)


def update_story_document(
    run_context: RunContext,
    document_id: str,
    name: str | None = None,
    role: Role | None = None,
    summary: str | None = None,
    fields: dict[str, str | None] | None = None,
) -> str:
    """Изменить документ драфта: имя, роль, описание или поля профиля. Только по прямой просьбе автора.

    Прежние значения остаются в версиях документа. Значение каждого поля — строка. Поля по видам (имя — что в нём):
    {fields}

    Args:
        document_id: id документа из list_story_documents.
        name: новое имя; не передавай, если не меняется.
        role: новая роль персонажа или локации (main, secondary или episodic); у мира роли нет; не передавай, если не
            меняется.
        summary: новое описание одной фразой; не передавай, если не меняется.
        fields: только меняемые поля вида документа из списка выше: строка — новое значение, null убирает поле,
            остальные остаются.
    """

    def work() -> Any:
        draft = _draft(run_context)
        changes = {
            key: value
            for key, value in (("name", name), ("role", role), ("summary", summary), ("fields", fields))
            if value is not None
        }
        with get_engine().begin() as connection:
            found = _document_of_draft(connection, draft.id, document_id)
            document = docs.update_document_by_coauthor(connection, found.id, changes, _caller(connection, run_context))
        return _done(f"Изменён документ «{document.name}»", "document", document.id, kind=document.kind)

    return _answer(work)


def _list_fields(tool: Callable[..., str], kinds: tuple[str, ...]) -> None:
    """Put the fields of the kinds, from the core, into the description the model gets (design, decision 2)."""
    marker = "{fields}"
    if tool.__doc__ is None or marker not in tool.__doc__:
        raise RuntimeError(f"The docstring of {tool.__name__} has no {marker} for the fields of the kinds")
    tool.__doc__ = tool.__doc__.replace(marker, field_guide(kinds).replace("\n", "\n    "))


_list_fields(create_story_document, ("character", "location", "world"))
_list_fields(update_story_document, ("character", "location", "world", "script"))


def comment_on_screenplay(run_context: RunContext, scene_uid: str, quote: str, text: str) -> str:
    """Оставить комментарий к фрагменту сценария. Текст сценария не меняется. Только по прямой просьбе автора.

    Args:
        scene_uid: uid сцены из read_screenplay.
        quote: точная цитата из одного абзаца этой сцены (символ в символ).
        text: текст комментария.
    """

    def work() -> Any:
        draft = _draft(run_context)
        with get_engine().begin() as connection:
            thread = review.create_coauthor_thread(
                connection, texts.screenplay_id(connection, draft.id), scene_uid, quote, text
            )
        return _done(f"Комментарий к «{thread.quote}»", "comment", thread.id)

    return _answer(work)


# Read and suggest: never wait for the author.
READING_TOOLS: list[Callable[..., str]] = [
    list_story_documents,
    read_story_document,
    read_screenplay,
    search_story,
    read_chat_file,
    list_story_notes,
    read_story_note,
    list_story_templates,
    suggest_edit,
]

# Change the story: in the mode `ask` each call waits for the author (openspec/specs/api/agents, «Режим соавтора»).
# Their names are the contract with the chat, which shows the confirmation and what was done.
CHANGING_TOOLS: list[Callable[..., str]] = [
    create_story_note,
    save_chat_file_to_notes,
    update_story_note,
    create_story_document,
    update_story_document,
    comment_on_screenplay,
]


def _confirmed(tool: Callable[..., str]) -> Function:
    function = Function.from_callable(tool)
    function.requires_confirmation = True
    return function


# What the agent gets: every changing call pauses the run until the chat answers it, the author in the mode `ask`
# and the chat itself in the mode `auto`. The list is static: AgentOS 3.1.10 refuses tools built per run
# (design of coauthor-actions, decision 1).
COAUTHOR_TOOLS: list[Callable[..., str] | Function] = [*READING_TOOLS, *map(_confirmed, CHANGING_TOOLS)]
