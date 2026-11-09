"""Tasks of «Соавтор» in the head of «Логлайн» and «Синопсис» and what the judge expects of each
(openspec/specs/coauthor-eval, «Задача документа в случае», «Ожидание задачи документа для судьи»).

The requests repeat web/src/screens/project/chat/docTasks.ts word for word: a case of the part `docs` sends the
request of its task over the open document, as the button sends it.
"""

from dataclasses import dataclass

# The documents a case may open, by the address the chat uses (docRef.ts), and their titles in the chat's context
# (SCRIPT_PARTS in web/src/data/model.ts).
DOC_TITLES = {"logline": "Логлайн", "synopsis": "Синопсис"}


@dataclass(frozen=True)
class DocTask:
    doc: str  # the document the button stands on: a key of DOC_TITLES
    label: str
    request: str
    fill: bool  # the request goes into the field, and the author finishes it: a message only starts with it
    expectation: str  # what a good answer does, for the judge


DOC_TASKS: dict[str, DocTask] = {
    "logline-variants": DocTask(
        "logline",
        "Предложить варианты",
        "Предложи три варианта логлайна для этой истории: герой, его цель, главное препятствие и ставки, до 35 слов "
        "каждый. Опирайся на сценарий и документы драфта. Ничего не записывай, пока я не выберу.",
        False,
        "три варианта логлайна, в каждом герой, его цель и главное препятствие, каждый не длиннее 35 слов; "
        "предлагает записать выбранный",
    ),
    "logline-check": DocTask(
        "logline",
        "Проверить мой логлайн",
        "Проверь мой логлайн: видно ли в нём героя, его цель, препятствие и ставки? Скажи, чего не хватает, и спроси "
        "меня об этом. Не переписывай его за меня.",
        False,
        "говорит, чего не хватает логлайну (героя, цели, препятствия, ставок), с цитатой из него, и задаёт автору "
        "вопрос; логлайн за автора не переписывает",
    ),
    "synopsis-page": DocTask(
        "synopsis",
        "Написать на страницу",
        "Напиши синопсис этой истории на страницу, до 400 слов: завязка, ключевые повороты и финал. Опирайся на "
        "сценарий и документы драфта. Покажи его здесь и предложи записать в синопсис драфта.",
        False,
        "синопсис до 400 слов, третье лицо, настоящее время, завязка, ключевые повороты и раскрытый финал, без "
        "рекламных оценок; предлагает записать его в синопсис драфта и говорит, что нынешний синопсис заменится",
    ),
    "synopsis-short": DocTask(
        "synopsis",
        "Коротко: абзац",
        "Напиши короткий синопсис этой истории: один абзац до 120 слов, с финалом. Покажи его здесь и предложи "
        "сохранить заметкой «Синопсис: абзац».",
        False,
        "один абзац до 120 слов с раскрытым финалом; предлагает сохранить его заметкой «Синопсис: абзац»",
    ),
    "synopsis-viewer": DocTask(
        "synopsis",
        "Для зрителя: без финала",
        "Напиши аннотацию этой истории для зрителя: 50–100 слов, без финала и главного поворота. Покажи её здесь и "
        "предложи сохранить заметкой «Синопсис: для зрителя».",
        False,
        "аннотация 50–100 слов, завязка и ставки, не раскрывает финал и главный поворот; предлагает сохранить её "
        "заметкой «Синопсис: для зрителя»",
    ),
    "synopsis-application": DocTask(
        "synopsis",
        "Под заявку",
        "Напиши синопсис под заявку. Требования: ",
        True,
        "если автор не назвал требований заявки, спрашивает о них и синопсис не пишет; если назвал — пишет по ним и "
        "не превышает названный объём, число слов или знаков называет, только если посчитал",
    ),
    "synopsis-check": DocTask(
        "synopsis",
        "Проверить мой синопсис",
        "Проверь мой синопсис: понятны ли завязка, ключевые повороты и финал, нет ли оценок вместо событий? Назови "
        "одно–три места и спроси меня о них. Не переписывай его за меня.",
        False,
        "называет одно–три места синопсиса с точной цитатой, объясняет, что в них не так, и задаёт автору вопрос; "
        "синопсис за автора не переписывает",
    ),
}


def task_line(task_id: str) -> str:
    """The judge's line of expectation for a case of the task."""
    task = DOC_TASKS[task_id]
    return (
        f"- автор открыл документ «{DOC_TITLES[task.doc]}» и выбрал задачу «{task.label}»: хороший ответ — "
        f"{task.expectation}; сюжет берёт только из материалов истории и ничего не записывает без согласия автора;"
    )


def matches(task: DocTask, message: str) -> bool:
    """The message of a case is the request of its task; a request to fill only starts it. The chat trims the
    message it sends, so the trailing space of a request to fill is not part of the match."""
    if task.fill:
        return message.startswith(task.request.rstrip())
    return message == task.request
