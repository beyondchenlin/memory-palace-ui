"""Task-local preview: never cache files while editing the shared palette/UI."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).resolve().parent), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, _format, *args):
        pass  # No unbounded per-request preview logs.


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8877), PreviewHandler)
    print("Local preview http://127.0.0.1:8877/ (Cache-Control: no-store)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
