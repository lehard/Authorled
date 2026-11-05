"""Fields of each document kind, kept in documents.fields (openspec/specs/api/stories, «Виды документов и их поля»).

The profile follows mockup v2 and web/src/data/profiles.ts (after the STARC models). Every text field is
optional; a field of another kind or a value of the wrong type is refused with its name.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, ValidationError, create_model

from core.errors import Invalid

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


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ScriptParts(_Strict):
    """Which parts of the screenplay the navigator shows."""

    title: bool
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


CharacterFields = _profile(
    "CharacterFields", CHARACTER_PROFILE, age=(str | None, None), gender=(Literal["", "f", "m", "o"] | None, None)
)
LocationFields = _profile("LocationFields", LOCATION_PROFILE)
WorldFields = _profile("WorldFields", WORLD_PROFILE, overview=(str | None, None))


class ScriptFields(_Strict):
    tagline: str | None = None
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


def validate_fields(kind: str, fields: Any) -> dict[str, Any]:
    """Check the fields of a kind and return them without unset keys; refuses with the field name."""
    if not isinstance(fields, dict):
        raise Invalid("Поле «fields» должно быть объектом.", "fields")
    try:
        model = FIELDS[kind].model_validate(fields)
    except ValidationError as error:
        first = error.errors()[0]
        name = ".".join(str(part) for part in first["loc"])
        if first["type"] == "extra_forbidden":
            raise Invalid(f"Поля «{name}» нет у документа этого вида.", f"fields.{name}") from error
        raise Invalid(f"Поле «{name}»: неверное значение.", f"fields.{name}") from error
    return model.model_dump(exclude_none=True)


def merge_fields(kind: str, saved: dict[str, Any], changes: Any) -> dict[str, Any]:
    """PATCH of fields: the passed keys replace the saved ones (null removes a key), the result is checked whole."""
    if not isinstance(changes, dict):
        raise Invalid("Поле «fields» должно быть объектом.", "fields")
    merged = {**saved, **changes}
    return validate_fields(kind, {key: value for key, value in merged.items() if value is not None})
