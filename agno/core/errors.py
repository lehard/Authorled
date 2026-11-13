"""Refusals of the core operations; the product routes turn them into problem+json (app/api/body.py)."""


class NotFound(Exception):
    """No such record for this caller: missing and someone else's look the same."""


class Conflict(Exception):
    """The record is in a state that refuses the operation: an old revision, the trash, a repeat."""


class RevisionConflict(Conflict):
    """The save is based on an older revision (openspec/specs/api/stories, «Кто сохранил при конфликте»).

    Names who saved the current revision and carries the refused state of the part (`text` or `fields`), so the
    route keeps it as a snapshot `conflict` after the refused transaction is rolled back; `content` is None when
    the refused change had nothing to keep (only the position).
    """

    def __init__(
        self, detail: str, saved_by: str, saved_by_me: bool, part: str, content: dict[str, object] | None
    ) -> None:
        super().__init__(detail)
        self.saved_by = saved_by
        self.saved_by_me = saved_by_me
        self.part = part
        self.content = content


class Locked(Conflict):
    """Nothing in a locked draft changes."""


class Invalid(Exception):
    """The input breaks a rule; `field` names the field when there is one."""

    def __init__(self, detail: str, field: str | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.field = field


class PreconditionRequired(Exception):
    """A change of a revised record came without the revision it was based on (If-Match)."""


class Forbidden(Exception):
    """The record is visible, but this caller may not change it: someone else's comment."""


class ScannerUnavailable(Exception):
    """The antivirus did not answer: the file is neither parsed nor stored."""


class TooLarge(Exception):
    """The upload is larger than the limit of one file."""
