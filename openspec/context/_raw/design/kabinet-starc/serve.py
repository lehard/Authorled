"""Сервер макета без кэша: браузер всегда берёт свежие app.js и data.js.

Запуск из корня репозитория: python3 openspec/context/_raw/design/kabinet-starc/serve.py 5181
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if len(sys.argv) != 2:
    sys.exit("Укажите порт: serve.py 5181")
port = int(sys.argv[1])
handler = partial(NoCacheHandler, directory=str(Path(__file__).parent))
print(f"Макет v2: http://127.0.0.1:{port}")
ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
