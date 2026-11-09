"""
Own routes of the product
=========================

Product actions without a model call, under /api/v1/ (ADR-002). They are added to the app that
AgentOS returns, not passed as `base_app`: with `base_app` Agno 3.1.10 does not install its error
handlers for its own routes.
"""

from fastapi import FastAPI
from starlette.routing import Mount

from app.api.beta import router as beta_router
from app.api.feedback import router as feedback_router
from app.api.files import router as files_router
from app.api.me import router as me_router
from app.api.notes import router as notes_router
from app.api.problems import install_problem_handlers
from app.api.review import router as review_router
from app.api.saves import router as saves_router
from app.api.stories import router as stories_router


def attach_api(app: FastAPI) -> None:
    """Add the product routes and the handlers of their own errors to the AgentOS app.

    AgentOS mounts its MCP app at the root ("/"), and a mount at the root answers every path
    that reaches it, so the product routes are placed before that mount.
    """
    install_problem_handlers(app)
    routes = app.router.routes
    start = len(routes)
    app.include_router(me_router)
    app.include_router(stories_router)
    app.include_router(notes_router)
    app.include_router(review_router)
    app.include_router(saves_router)
    app.include_router(files_router)
    app.include_router(beta_router)
    app.include_router(feedback_router)
    ours = routes[start:]
    del routes[start:]
    root_mount = next((i for i, route in enumerate(routes) if isinstance(route, Mount) and route.path == ""), None)
    at = len(routes) if root_mount is None else root_mount
    routes[at:at] = ours


__all__ = ["attach_api"]
