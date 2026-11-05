"""Antivirus check of uploaded files through clamd (openspec/specs/api/files, «Антивирусная проверка»).

The INSTREAM command of the clamd protocol over TCP: the file goes in chunks with a 4-byte length, a zero
length ends it, the answer is `stream: OK` or `stream: <name> FOUND`. Anything else is a failure of the
scanner, never a clean file.
"""

import socket
import struct
from dataclasses import dataclass
from os import environ

from core.errors import ScannerUnavailable

CHUNK = 64 * 1024
# Scanning 20 MB takes seconds; the timeout covers a hung daemon, not a slow one.
TIMEOUT_SECONDS = 60


@dataclass(frozen=True)
class Address:
    host: str
    port: int


def scanner_address() -> Address:
    """CLAMAV_HOST and CLAMAV_PORT; the API checks them at startup and does not start without them."""
    host = environ.get("CLAMAV_HOST")
    if not host:
        raise RuntimeError("Required environment variable CLAMAV_HOST is not set (address of clamd)")
    port = environ.get("CLAMAV_PORT")
    if not port:
        raise RuntimeError("Required environment variable CLAMAV_PORT is not set (port of clamd)")
    if not port.isdigit():
        raise RuntimeError(f"CLAMAV_PORT must be a port number, not {port!r}")
    return Address(host, int(port))


def scan(data: bytes) -> str | None:
    """Name of the threat found in `data`, or None when clamd answers that the file is clean."""
    address = scanner_address()
    try:
        with socket.create_connection((address.host, address.port), timeout=TIMEOUT_SECONDS) as connection:
            connection.sendall(b"zINSTREAM\0")
            for start in range(0, len(data), CHUNK):
                chunk = data[start : start + CHUNK]
                connection.sendall(struct.pack("!L", len(chunk)) + chunk)
            connection.sendall(struct.pack("!L", 0))
            answer = b""
            while not answer.endswith(b"\0"):
                part = connection.recv(4096)
                if not part:
                    break
                answer += part
    except OSError as error:
        raise ScannerUnavailable(f"Антивирус недоступен: {error}.") from error
    reply = answer.rstrip(b"\0").decode("utf-8", "replace")
    if reply == "stream: OK":
        return None
    if reply.startswith("stream: ") and reply.endswith(" FOUND"):
        return reply.removeprefix("stream: ").removesuffix(" FOUND")
    raise ScannerUnavailable(f"Антивирус ответил непонятно: {reply!r}.")
