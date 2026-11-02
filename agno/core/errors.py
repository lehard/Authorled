"""Refusals of the core operations; the product routes turn them into problem+json (app/api/body.py)."""


class NotFound(Exception):
    """No such record for this caller: missing and someone else's look the same."""


class Conflict(Exception):
    """The record is in a state that refuses the operation: an old revision, the trash, a repeat."""


class Locked(Conflict):
    """The text of a locked draft does not change."""


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
