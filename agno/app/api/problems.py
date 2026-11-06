"""Errors of the product routes as application/problem+json (RFC 9457).

Handlers are registered only for the product's own exception types, so the error answers of
Agno routes stay exactly as Agno makes them.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.auth import MissingIdentityClaim
from core.errors import Conflict, Forbidden, Invalid, NotFound, PreconditionRequired, ScannerUnavailable, TooLarge
from core.users import AccountDeleted, AccountNotFound

PROBLEM_JSON = "application/problem+json"


class Problem(Exception):
    """A refusal of a product route with its HTTP status and a reason for a person."""

    def __init__(self, status: int, title: str, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.title = title
        self.detail = detail


def problem_response(problem: Problem) -> JSONResponse:
    # no-store: browsers keep a 410 without this header forever and show it to the next user.
    return JSONResponse(
        status_code=problem.status,
        content={"type": "about:blank", "title": problem.title, "status": problem.status, "detail": problem.detail},
        media_type=PROBLEM_JSON,
        headers={"Cache-Control": "no-store"},
    )


async def _on_problem(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, Problem)
    return problem_response(exc)


async def _on_missing_claim(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, MissingIdentityClaim)
    return problem_response(
        Problem(403, "Forbidden", f"В токене нет claim «{exc.claim}»: аккаунт продукта доступен только людям.")
    )


# Refusals of the core (core/errors.py) and their HTTP answers; the detail is the core's reason.
_CORE: dict[type[Exception], tuple[int, str]] = {
    NotFound: (404, "Not Found"),
    Conflict: (409, "Conflict"),
    Invalid: (422, "Unprocessable Content"),
    PreconditionRequired: (428, "Precondition Required"),
    Forbidden: (403, "Forbidden"),
    TooLarge: (413, "Content Too Large"),
    ScannerUnavailable: (503, "Service Unavailable"),
}


async def _on_core(_: Request, exc: Exception) -> JSONResponse:
    status, title = next(answer for kind, answer in _CORE.items() if isinstance(exc, kind))
    return problem_response(Problem(status, title, str(exc)))


async def _on_account_not_found(_: Request, exc: Exception) -> JSONResponse:
    return problem_response(Problem(404, "Not Found", "Аккаунта ещё нет: сначала вызовите GET /api/v1/me."))


async def _on_account_deleted(_: Request, exc: Exception) -> JSONResponse:
    return problem_response(Problem(410, "Gone", "Аккаунт удалён."))


def install_problem_handlers(app: FastAPI) -> None:
    app.add_exception_handler(Problem, _on_problem)
    app.add_exception_handler(MissingIdentityClaim, _on_missing_claim)
    for kind in _CORE:
        app.add_exception_handler(kind, _on_core)
    app.add_exception_handler(AccountNotFound, _on_account_not_found)
    app.add_exception_handler(AccountDeleted, _on_account_deleted)
