"""The caller of the co-author cases: the verified development user `writer@authorled.test` (openspec/specs/runtime,
«Eval соавтора от имени пользователя разработки»).

The co-author refuses a run without a verified caller (agents/coauthor_usage.py), and an in-process eval run has none.
`writer_setup` takes the caller from the auth module (`dev_writer_caller`), creates the account of the core the way
the first sign-in does and binds the caller to the runs of the case; `writer_teardown` unbinds it. Agno's runner
awaits an async setup in the task of the case, runs the case in a copy of that context and awaits teardown in the
same task (agno/eval/suite.py, `_arun_case`), so the scope entered here covers the run and the judge of this case only.
A failure stops the case before the model is called.
"""

import asyncio
from contextlib import AbstractContextManager

from agno.eval import CaseResult
from agno.run.authorization import authorization_scope

from app.auth import DevCaller, dev_writer_caller
from app.main import app
from core.engine import get_engine
from core.users import get_or_create_user


def _account(caller: DevCaller) -> None:
    with get_engine().begin() as connection:
        get_or_create_user(connection, caller.subject, caller.identity.email, caller.identity.name)


async def writer_setup() -> AbstractContextManager[None]:
    """Bind the verified `writer` to the runs of this case; its account in the core is created if missing."""
    caller = await asyncio.to_thread(dev_writer_caller, app)
    await asyncio.to_thread(_account, caller)
    scope = authorization_scope(lambda: caller.authorization)
    scope.__enter__()
    return scope


async def writer_teardown(scope: AbstractContextManager[None], result: CaseResult) -> None:
    """Unbind the caller bound by `writer_setup`."""
    scope.__exit__(None, None, None)
