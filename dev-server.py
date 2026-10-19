#!/usr/bin/env python3
"""MyMap localhost dev server.

Serves static files on 8801 like `python -m http.server` + accepts POST writes
to `data/maps/<id>/pins.json` and `data/maps/<id>/routes.geojson` so the
"Save to file (local)" button in map.html persists edits straight to disk — no
GitHub token needed. Only those two paths are writeable; every other POST is
rejected with 403.
"""
import json
import re
from http.server import SimpleHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8801
ALLOWED_PATHS = re.compile(r'^data/maps/[\w\-.]+/(?:pins\.json|routes\.geojson)$')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path != '/api/write':
            self.send_error(404)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            body = json.loads(self.rfile.read(length).decode('utf-8'))
            rel = body.get('path', '').replace('\\', '/').lstrip('/')
            content = body.get('content', '')
            if not ALLOWED_PATHS.match(rel):
                return self.send_error(403, 'forbidden path')
            if not isinstance(content, str):
                return self.send_error(400, 'content must be a string')
            target = (ROOT / rel).resolve()
            # guard against path escape
            if ROOT not in target.parents:
                return self.send_error(403, 'escape attempt')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding='utf-8')
            resp = json.dumps({'ok': True, 'path': rel, 'bytes': len(content)}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            print(f'[write] {rel}  {len(content)} bytes')
        except Exception as e:
            self.send_error(500, str(e))

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        # keep fetches happy regardless of the origin the user loads the page from
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()


if __name__ == '__main__':
    print(f'MyMap dev server: http://localhost:{PORT}   (writes to {ROOT})')
    HTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
