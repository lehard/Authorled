"""Errors of the product routes as application/problem+json (RFC 9457).

Handlers are registered only for the product's own exception types, so the error answers of
Agno routes stay exactly as Agno makes them.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.auth import MissingIdentityClaim

PROBLEM_JSON = "application/problem+json"


class Problem(Exception):
    """A refusal of a product route with its HTTP status and a reason for a person."""

    def __init__(self, status: int, title: str, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.title = title
        self.detail = detail


def problem_response(problem: Problem) -> JSONResponse:
    return JSONResponse(
        status_code=problem.status,
        content={"type": "about:blank", "title": problem.title, "status": problem.status, "detail": problem.detail},
        media_type=PROBLEM_JSON,
    )


async def _on_problem(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, Problem)
    return problem_response(exc)


async def _on_missing_claim(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, MissingIdentityClaim)
    return problem_response(
        Problem(403, "Forbidden", f"В токене нет claim «{exc.claim}»: аккаунт продукта доступен только людям.")
    )


def install_problem_handlers(app: FastAPI) -> None:
    app.add_exception_handler(Problem, _on_problem)
    app.add_exception_handler(MissingIdentityClaim, _on_missing_claim)
