"""Antivirus client (openspec/specs/api/files «Антивирусная проверка»; runtime «Антивирус ClamAV»).

Runs against the clamav service of the stand that ./scripts/dev.sh test requires (CLAMAV_HOST, CLAMAV_PORT).
"""

import ast
from pathlib import Path

import pytest

from core.clamav import scan, scanner_address
from core.errors import ScannerUnavailable

# The standard test file of antivirus vendors: harmless, detected by every scanner.
EICAR = rb"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


def test_clean_file() -> None:
    assert scan("ИНТ. КУХНЯ — ДЕНЬ".encode()) is None


def test_eicar_is_found() -> None:
    assert scan(EICAR) == "Eicar-Test-Signature"


def test_large_file_goes_in_chunks() -> None:
    assert scan(b"a" * (3 * 1024 * 1024 + 7)) is None


def test_closed_port_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLAMAV_HOST", "127.0.0.1")
    monkeypatch.setenv("CLAMAV_PORT", "1")
    with pytest.raises(ScannerUnavailable):
        scan(b"a")


@pytest.mark.parametrize("name", ["CLAMAV_HOST", "CLAMAV_PORT"])
def test_missing_address_is_named(monkeypatch: pytest.MonkeyPatch, name: str) -> None:
    monkeypatch.delenv(name)
    with pytest.raises(RuntimeError, match=name):
        scanner_address()


def test_main_checks_the_address_at_startup() -> None:
    main = ast.parse((Path(__file__).resolve().parents[1] / "app" / "main.py").read_text())
    calls = [
        node
        for node in main.body
        if isinstance(node, ast.Expr)
        and isinstance(node.value, ast.Call)
        and isinstance(node.value.func, ast.Name)
        and node.value.func.id == "scanner_address"
    ]
    assert len(calls) == 1
