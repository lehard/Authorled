"""Fields of each document kind, kept in documents.fields (openspec/specs/api/stories, «Виды документов и их поля»).

The profile follows mockup v2 and web/src/data/profiles.ts (after the STARC models). Every text field is
optional; a field of another kind or a value of the wrong type is refused with its name.
"""

from typing import Any, Literal, get_args, get_origin

from pydantic import BaseModel, ConfigDict, ValidationError, create_model
from pydantic_core import ErrorDetails

from core.errors import Invalid
from core.prose import check_synopsis

DocumentKind = Literal["script", "character", "location", "world"]
Role = Literal["main", "secondary", "episodic"]

# Kinds with a role; the database checks the same rule (core/tables.py, ck_documents_role_by_kind).
KINDS_WITH_ROLE = ("character", "location")

CHARACTER_PROFILE = (
    *("height", "body", "hair", "eyes", "feature", "dress"),
    *("personality", "strength", "weakness", "habits", "speech", "fear"),
    *("childhood", "pastEvent", "secrets", "bestMemory", "worstMemory"),
    *("shortGoal", "longGoal", "beliefsStart", "beliefsEnd", "change"),
    *("firstAppearance", "plot", "conflict", "definingMoment"),
    *("residence", "job", "income", "hobbies"),
)
LOCATION_PROFILE = (
    *("sight", "sound", "smell", "touch", "taste"),
    *("climate", "landmark", "nearby", "history", "soundstage"),
)
WORLD_PROFILE = (
    *("geography", "climates", "flora", "animals", "resources"),
    *("races", "languages", "religions", "education", "ethics"),
    *("government", "laws", "wars"),
    *("currency", "trade", "industry"),
    *("technology", "magic", "whoCanUse"),
)


# The screenplay of a draft has this name always: the title belongs to the story.
SCRIPT_NAME = "Сценарий"


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ScriptParts(_Strict):
    """Which parts of the screenplay the navigator shows."""

    title: bool
    logline: bool
    synopsis: bool
    treatment: bool
    text: bool


class TitlePage(_Strict):
    title: str = ""
    genre: str = ""
    author: str = ""
    contacts: str = ""
    place: str = ""


def _profile(name: str, keys: tuple[str, ...], **extra: Any) -> type[_Strict]:
    text_fields: dict[str, Any] = {key: (str | None, None) for key in ("description", *keys)}
    return create_model(name, __base__=_Strict, **text_fields, **extra)


Gender = Literal["", "f", "m", "o"]

CharacterFields = _profile("CharacterFields", CHARACTER_PROFILE, age=(str | None, None), gender=(Gender | None, None))
LocationFields = _profile("LocationFields", LOCATION_PROFILE)
WorldFields = _profile("WorldFields", WORLD_PROFILE, overview=(str | None, None))


class ScriptFields(_Strict):
    logline: str | None = None
    show: ScriptParts | None = None
    title_page: TitlePage | None = None
    synopsis: str | None = None


FIELDS: dict[str, type[_Strict]] = {
    "script": ScriptFields,
    "character": CharacterFields,
    "location": LocationFields,
    "world": WorldFields,
}


# Short meanings of the fields the co-author may set, by kind (labels of web/src/data/profiles.ts); its tools list
# them for the model (openspec/specs/api/agents, «Действия соавтора»). Every text field of a kind has one; the
# screenplay's `show` and `title_page` are not text and stay with the author.
_COMMON_HINTS = {"description": "подробное описание"}
FIELD_HINTS: dict[str, dict[str, str]] = {
    "character": {
        **_COMMON_HINTS,
        **{"age": "возраст", "gender": "пол, f женский, m мужской, o другой"},
        **{"height": "рост", "body": "телосложение", "hair": "волосы", "eyes": "глаза"},
        **{"feature": "особые приметы", "dress": "как одевается"},
        **{"personality": "характер", "strength": "сильные стороны", "weakness": "слабости"},
        **{"habits": "привычки", "speech": "как говорит", "fear": "главный страх"},
        **{"childhood": "детство", "pastEvent": "важное событие в прошлом", "secrets": "секреты"},
        **{"bestMemory": "лучшее воспоминание", "worstMemory": "худшее воспоминание"},
        **{"shortGoal": "ближайшая цель", "longGoal": "главная цель"},
        **{"beliefsStart": "во что верит в начале", "beliefsEnd": "во что верит в конце"},
        **{"change": "что ведёт к перемене", "firstAppearance": "первое появление"},
        **{"plot": "участие в сюжете", "conflict": "конфликт", "definingMoment": "определяющий момент"},
        **{"residence": "где живёт", "job": "работа", "income": "доход", "hobbies": "увлечения"},
    },
    "location": {
        **_COMMON_HINTS,
        **{"sight": "что видно", "sound": "что слышно", "smell": "чем пахнет", "touch": "на ощупь", "taste": "вкус"},
        **{"climate": "климат", "landmark": "ориентиры", "nearby": "что рядом", "history": "история места"},
        **{"soundstage": "павильон или натура"},
    },
    "world": {
        **_COMMON_HINTS,
        **{"overview": "обзор мира", "geography": "география", "climates": "климат", "flora": "растения"},
        **{"animals": "животные", "resources": "природные ресурсы", "races": "народы", "languages": "языки"},
        **{"religions": "религии", "education": "образование", "ethics": "нравы"},
        **{"government": "устройство власти", "laws": "законы", "wars": "войны и конфликты"},
        **{"currency": "деньги", "trade": "торговля", "industry": "промышленность"},
        **{"technology": "технологии", "magic": "магия", "whoCanUse": "кто может пользоваться"},
    },
    "script": {"logline": "логлайн", "synopsis": "синопсис"},
}
KIND_GENITIVE = {"character": "персонажа", "location": "локации", "world": "мира", "script": "сценария"}


def _literal_values(annotation: Any) -> tuple[str, ...]:
    """Allowed values of a `Literal[...] | None` field; empty for any other type."""
    for part in get_args(annotation) or (annotation,):
        if get_origin(part) is Literal:
            return tuple(get_args(part))
    return ()


def _allowed(values: tuple[str, ...]) -> str:
    shown = [value for value in values if value]
    return ", ".join(shown) + (" или пусто" if "" in values else "")


def _text_fields(kind: str) -> set[str]:
    """Fields of a kind whose value is a string: free text or one of the allowed strings."""
    return {
        name
        for name, field in FIELDS[kind].model_fields.items()
        if field.annotation == str | None or _literal_values(field.annotation)
    }


def _check_hints() -> None:
    for kind in FIELDS:
        missing = _text_fields(kind) - set(FIELD_HINTS[kind])
        extra = set(FIELD_HINTS[kind]) - _text_fields(kind)
        if missing or extra:
            raise RuntimeError(
                f"core/fields.py: FIELD_HINTS[{kind!r}] must match the text fields of the kind; "
                f"without a hint: {sorted(missing)}, not a text field: {sorted(extra)}"
            )


_check_hints()


def field_guide(kinds: tuple[str, ...]) -> str:
    """The fields of each kind with their meanings, one line per kind, for the co-author's tools."""
    lines = []
    for kind in kinds:
        model = FIELDS[kind]
        parts = []
        for name, hint in FIELD_HINTS[kind].items():
            values = _literal_values(model.model_fields[name].annotation)
            parts.append(f"{name} — {hint}" + (f" ({_allowed(values)})" if values else ""))
        lines.append(f"{kind} ({KIND_GENITIVE[kind]}): " + "; ".join(parts) + ".")
    return "\n".join(lines)


def _problem(kind: str, error: ErrorDetails) -> str:
    """One field error in words; a pydantic error type outside this table is a bug of this module, not of the input."""
    name = ".".join(str(part) for part in error["loc"])
    match error["type"]:
        case "extra_forbidden":
            return f"Поля «{name}» нет у документа этого вида."
        case "string_type":
            return f"Поле «{name}»: ожидается строка."
        case "literal_error":
            field = FIELDS[kind].model_fields[str(error["loc"][0])]
            return f"Поле «{name}»: допустимые значения — {_allowed(_literal_values(field.annotation))}."
        case "bool_type":
            return f"Поле «{name}»: ожидается да или нет (true или false)."
        case "missing":
            return f"Поле «{name}» обязательно."
        case "model_type" | "dict_type":
            return f"Поле «{name}»: ожидается объект."
    raise RuntimeError(f"core/fields.py: no wording for the field error {error['type']!r} of «{name}»")


def validate_fields(kind: str, fields: Any) -> dict[str, Any]:
    """Check the fields of a kind and return them without unset keys.

    A refusal names every wrong field at once, in the order of the request, with what is expected; for an unknown
    field it lists the fields of the kind. `Invalid.field` is the path of the first wrong field.
    """
    if not isinstance(fields, dict):
        raise Invalid("Поле «fields» должно быть объектом.", "fields")
    try:
        model = FIELDS[kind].model_validate(fields)
    except ValidationError as error:
        order = list(fields)
        found = sorted(error.errors(), key=lambda e: order.index(e["loc"][0]) if e["loc"][0] in order else len(order))
        sentences = [_problem(kind, e) for e in found]
        if any(e["type"] == "extra_forbidden" for e in found):
            sentences.append(f"Поля {KIND_GENITIVE[kind]}: {', '.join(FIELDS[kind].model_fields)}.")
        first = ".".join(str(part) for part in found[0]["loc"])
        raise Invalid(" ".join(sentences), f"fields.{first}") from error
    if isinstance(model, ScriptFields) and model.synopsis is not None:
        # The synopsis is Markdown of the prose editor: a heading deeper than the second level is refused.
        check_synopsis(model.synopsis)
    return model.model_dump(exclude_none=True)


def merge_fields(kind: str, saved: dict[str, Any], changes: Any) -> dict[str, Any]:
    """PATCH of fields: the passed keys replace the saved ones (null removes a key), the result is checked whole."""
    if not isinstance(changes, dict):
        raise Invalid("Поле «fields» должно быть объектом.", "fields")
    merged = {**saved, **changes}
    return validate_fields(kind, {key: value for key, value in merged.items() if value is not None})
