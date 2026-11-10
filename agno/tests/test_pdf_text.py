"""Paragraphs of the text of a PDF page (openspec/specs/api/files, «Абзацы текста PDF»)."""

from core.files import paragraphs_of_page


def test_sentence_over_two_lines() -> None:
    page = "Для пополнения счета используйте реквизиты для\nоплаты по договору."

    assert paragraphs_of_page(page) == "Для пополнения счета используйте реквизиты для оплаты по договору."


def test_broken_word() -> None:
    assert paragraphs_of_page("Каждый сцена-\nрист пишет") == "Каждый сценарист пишет"


def test_comma_goes_on() -> None:
    assert paragraphs_of_page("Москва,\n1913 год") == "Москва, 1913 год"


def test_lines_of_details_stay() -> None:
    page = "Банк ГПБ (АО) БИК 044525823\nСч. № 30101810200000000823\nПолучатель\nВ платежных поручениях"

    assert paragraphs_of_page(page) == page


def test_blank_line_stays() -> None:
    assert paragraphs_of_page("Глава 1\n\nначало") == "Глава 1\n\nначало"
