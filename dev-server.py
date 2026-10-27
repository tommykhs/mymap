#!/usr/bin/env python3
"""MyMap localhost dev server.

Serves static files on 8801 like `python -m http.server`, plus:
  - POST /api/write      → persist pins.json / routes.geojson to disk
  - POST /api/elevation  → server-side proxy to free SRTM elevation providers
                           (bypasses browser CORS AND Open-Elevation's
                           per-browser-session 429 tempo), tries OpenTopoData
                           srtm30m first then falls back to Open-Elevation.
"""
import json
import re
import time
import urllib.request
import urllib.error
from http.server import SimpleHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8801
ALLOWED_PATHS = re.compile(r'^data/maps/[\w\-.]+/(?:pins\.json|routes\.geojson)$')

# Shared across requests so we respect each provider's 1 req/sec limit without
# stacking per-call delays into the user's wait time.
_LAST_HIT = {'opentopodata': 0.0, 'open-elevation': 0.0}


def _throttle(provider, min_gap=1.05):
    now = time.time()
    gap = now - _LAST_HIT[provider]
    if gap < min_gap:
        time.sleep(min_gap - gap)
    _LAST_HIT[provider] = time.time()


def _fetch_elevation_batch(locations):
    """Resolve a batch of up to 100 [lat, lng] pairs to a list of nullable
    meters. Tries OpenTopoData first (public SRTM30m dataset, 1 req/s),
    falls back to Open-Elevation on error. Raises ValueError if both fail.
    """
    body = {'locations': '|'.join(f'{la:.6f},{ln:.6f}' for la, ln in locations)}
    # OpenTopoData srtm30m
    try:
        _throttle('opentopodata')
        url = 'https://api.opentopodata.org/v1/srtm30m?' + \
              'locations=' + body['locations']
        req = urllib.request.Request(url, headers={'User-Agent': 'MyMap-dev/1.0'})
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read().decode('utf-8'))
        if data.get('status') == 'OK' and isinstance(data.get('results'), list):
            return [row.get('elevation') for row in data['results']]
    except Exception as e:
        print(f'[elev] opentopodata failed: {e}')
    # Open-Elevation JSON POST
    try:
        _throttle('open-elevation')
        payload = json.dumps({
            'locations': [{'latitude': la, 'longitude': ln} for la, ln in locations]
        }).encode()
        req = urllib.request.Request(
            'https://api.open-elevation.com/api/v1/lookup',
            data=payload,
            headers={'Content-Type': 'application/json', 'Accept': 'application/json',
                     'User-Agent': 'MyMap-dev/1.0'},
        )
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read().decode('utf-8'))
        if isinstance(data.get('results'), list):
            return [row.get('elevation') for row in data['results']]
    except Exception as e:
        print(f'[elev] open-elevation failed: {e}')
    raise ValueError('both OpenTopoData and Open-Elevation refused')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path == '/api/write':
            return self._handle_write()
        if self.path == '/api/elevation':
            return self._handle_elevation()
        self.send_error(404)

    def _handle_write(self):
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

    def _handle_elevation(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            body = json.loads(self.rfile.read(length).decode('utf-8'))
            locs = body.get('locations') or []
            if not isinstance(locs, list) or not locs:
                return self.send_error(400, 'locations: non-empty list required')
            # normalize + sanity-check
            points = []
            for item in locs:
                if isinstance(item, (list, tuple)) and len(item) >= 2:
                    la, ln = float(item[0]), float(item[1])
                elif isinstance(item, dict):
                    la, ln = float(item['latitude']), float(item['longitude'])
                else:
                    return self.send_error(400, 'bad location format')
                if not (-90 <= la <= 90 and -180 <= ln <= 180):
                    return self.send_error(400, f'out-of-range coord: {la},{ln}')
                points.append((la, ln))
            # batch in 100s to respect OpenTopoData / Open-Elevation limits
            out = []
            BATCH = 100
            for i in range(0, len(points), BATCH):
                chunk = points[i:i+BATCH]
                try:
                    elevs = _fetch_elevation_batch(chunk)
                except ValueError:
                    elevs = [None] * len(chunk)
                out.extend(elevs)
                print(f'[elev] {min(i+BATCH, len(points))}/{len(points)}')
            resp = json.dumps({'ok': True, 'elevations': out}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
        except Exception as e:
            self.send_error(500, str(e))

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        # Dev server: never let the browser cache map.html / JS / CSS / data.
        # Avoids the "I edited map.html but the page still runs the old copy"
        # trap during quick-iteration work.
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # keep fetches happy regardless of the origin the user loads the page from
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()


if __name__ == '__main__':
    print(f'MyMap dev server: http://localhost:{PORT}   (writes to {ROOT})')
    HTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
