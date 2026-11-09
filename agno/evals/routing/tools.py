"""Stub tools of the wide domain set (openspec/specs/orchestrator, «Заглушки инструментов широкого состава»).

Each returns a fixed phrase and touches nothing: no database, no network, no confirmation, so a run never pauses.
The model sees the name and the docstring, as it would a real tool of the domain. Names are unique in the set;
`check_tools` refuses a repeat and a skill that does not list all its domain's tools.
"""

from collections.abc import Callable

from agents.prompts import agent_skill


def _done(name: str) -> str:
    return f"Готово (заглушка инструмента {name})."


# wide-characters
def find_character(name: str) -> str:
    """Найти карточку персонажа истории и прочитать, что о нём записано."""
    return _done("find_character")


def create_character(name: str, description: str) -> str:
    """Завести карточку нового персонажа истории."""
    return _done("create_character")


def update_character(name: str, field: str, value: str) -> str:
    """Изменить поле карточки персонажа: возраст, характер, прошлое, цель, отношения."""
    return _done("update_character")


# wide-world
def find_location(name: str) -> str:
    """Найти карточку локации или описание мира истории."""
    return _done("find_location")


def create_location(name: str, description: str) -> str:
    """Завести карточку новой локации истории."""
    return _done("create_location")


def update_world_rules(text: str) -> str:
    """Записать или изменить правило придуманного мира истории."""
    return _done("update_world_rules")


# wide-notes
def list_notes() -> str:
    """Показать список заметок автора к истории."""
    return _done("list_notes")


def read_note(title: str) -> str:
    """Прочитать заметку автора."""
    return _done("read_note")


def create_note(title: str, text: str) -> str:
    """Создать заметку автора или дописать текст в существующую."""
    return _done("create_note")


def read_attached_file(file_name: str) -> str:
    """Прочитать файл, прикреплённый к истории: интервью, статью, референс."""
    return _done("read_attached_file")


# wide-text
def read_scene(scene: str) -> str:
    """Прочитать текст сцены сценария."""
    return _done("read_scene")


def suggest_line_edit(scene: str, quote: str, replacement: str) -> str:
    """Предложить правку ремарки, описания действия или заголовка сцены."""
    return _done("suggest_line_edit")


# wide-review
def list_comments(scene: str) -> str:
    """Показать комментарии к тексту сцены."""
    return _done("list_comments")


def add_comment(scene: str, quote: str, text: str) -> str:
    """Оставить комментарий к месту в тексте сценария."""
    return _done("add_comment")


def review_scene(scene: str) -> str:
    """Разобрать сцену: что в ней работает и что нет, без правки текста."""
    return _done("review_scene")


# wide-structure
def read_outline() -> str:
    """Прочитать замысел, логлайн и структуру истории по актам."""
    return _done("read_outline")


def analyze_act(act: str) -> str:
    """Разобрать акт истории: поворотные точки, конфликт, арки."""
    return _done("analyze_act")


def propose_structure_change(description: str) -> str:
    """Предложить изменение сюжета или структуры истории."""
    return _done("propose_structure_change")


# wide-scenes
def list_scenes() -> str:
    """Показать поэпизодник: список сцен с карточками."""
    return _done("list_scenes")


def update_scene_card(scene: str, field: str, value: str) -> str:
    """Изменить карточку сцены: место, время, участники, функция."""
    return _done("update_scene_card")


def reorder_scenes(order: str) -> str:
    """Предложить новый порядок сцен: переставить, объединить, разделить или выкинуть."""
    return _done("reorder_scenes")


# wide-dialogue
def read_dialogue(scene: str, character: str) -> str:
    """Прочитать реплики персонажа в сцене."""
    return _done("read_dialogue")


def suggest_dialogue_variant(scene: str, quote: str, intent: str) -> str:
    """Предложить вариант реплики персонажа."""
    return _done("suggest_dialogue_variant")


# wide-craft
def search_craft_library(query: str) -> str:
    """Найти ответ на вопрос о ремесле в библиотеке по драматургии и литературе."""
    return _done("search_craft_library")


def recommend_examples(topic: str) -> str:
    """Подобрать книги, фильмы и сериалы как примеры приёма или жанра."""
    return _done("recommend_examples")


# wide-help
def search_help(query: str) -> str:
    """Найти ответ в справке сервиса «Соавтор»."""
    return _done("search_help")


def show_plan_and_limits() -> str:
    """Показать тариф пользователя, лимиты и оплату."""
    return _done("show_plan_and_limits")


# wide-research
def search_facts(query: str) -> str:
    """Найти факты реального мира для достоверности истории."""
    return _done("search_facts")


def summarize_topic(topic: str) -> str:
    """Собрать короткую справку по теме реального мира для истории."""
    return _done("summarize_topic")


WIDE_TOOLS: dict[str, tuple[Callable[..., str], ...]] = {
    "wide-characters": (find_character, create_character, update_character),
    "wide-world": (find_location, create_location, update_world_rules),
    "wide-notes": (list_notes, read_note, create_note, read_attached_file),
    "wide-text": (read_scene, suggest_line_edit),
    "wide-review": (list_comments, add_comment, review_scene),
    "wide-structure": (read_outline, analyze_act, propose_structure_change),
    "wide-scenes": (list_scenes, update_scene_card, reorder_scenes),
    "wide-dialogue": (read_dialogue, suggest_dialogue_variant),
    "wide-craft": (search_craft_library, recommend_examples),
    "wide-help": (search_help, show_plan_and_limits),
    "wide-research": (search_facts, summarize_topic),
}


def tool_domains(tools: dict[str, tuple[Callable[..., str], ...]]) -> dict[str, str]:
    """Tool name -> its domain; a name in two domains stops the exam."""
    owner: dict[str, str] = {}
    for domain, functions in tools.items():
        if not 2 <= len(functions) <= 4:
            raise RuntimeError(f"Domain {domain!r} must have 2 to 4 stub tools, has {len(functions)}")
        for function in functions:
            name = function.__name__
            if name in owner:
                raise RuntimeError(f"Tool {name!r} is in both {owner[name]!r} and {domain!r}")
            owner[name] = domain
    return owner


def check_tools(tools: dict[str, tuple[Callable[..., str], ...]]) -> None:
    """Unique names, and each domain's skill lists all its tools (the skill is what tells the model to use them)."""
    tool_domains(tools)
    for domain, functions in tools.items():
        body = agent_skill(domain).instructions
        missing = [f.__name__ for f in functions if f"`{f.__name__}`" not in body]
        if missing:
            raise RuntimeError(f"Skill {domain!r} does not list its tools {', '.join(missing)}")
