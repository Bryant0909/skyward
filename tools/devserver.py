"""Static file server for local development.

The only difference from `python -m http.server` is a no-store header on every
response. Without it a refresh after editing a .js file often keeps serving the
cached copy, which at best looks like the change did nothing and at worst runs
old and new files together.

Usage:
    python tools/devserver.py [port] [root]
    npm start
"""
import functools
import http.server
import socketserver
import sys

DEFAULT_PORT = 8123
DEFAULT_ROOT = "docs"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    root = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_ROOT

    handler = functools.partial(NoCacheHandler, directory=root)
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", port), handler) as httpd:
        print("Up Up Angel — http://localhost:%d/  (serving %s, no-cache)" % (port, root))
        print("Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
