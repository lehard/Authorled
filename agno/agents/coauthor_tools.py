"""Tools of the co-author: it reads the draft of the conversation and proposes edits (openspec/specs/api/agents,
«Инструменты соавтора», «Предложение правки соавтором»).

The draft comes only from the conversation (session id `<projectId>:<draftId>:<uuid>`), the caller only from the run;
access goes through the auth module, as in the product routes. The tools change nothing but suggestions,
which the author accepts or rejects. A refusal is returned as text, so the model sees the reason.
"""

import json
import uuid
from collections.abc import Callable
from typing import Any

from agno.run import RunContext

from app.auth import can_access_project, run_principal
from core import documents as docs
from core import review, texts
from core.engine import get_engine
from core.errors import Conflict, Invalid, NotFound
from core.files import file_text as stored_file_text
from core.files import get_file

STORY_NOT_FOUND = "Отказ: история не найдена."


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
    except (NotFound, Invalid, Conflict) as error:
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


COAUTHOR_TOOLS: list[Callable[..., str]] = [
    list_story_documents,
    read_story_document,
    read_screenplay,
    read_chat_file,
    suggest_edit,
]
