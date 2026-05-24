# MyMap

A self-hosted route-map viewer (Leaflet) — a gallery of maps plus a per-map viewer.

- **Live:** https://tommykhs.github.io/mymap/
- **Data:** the map list (`library.json`) and each map's GeoJSON live in a **Gist**.
  The deployed site loads them via the GitHub gist API (fresh within ~60 s, no redeploy).
  Local dev reads `./data/` instead — `data.js` auto-detects by hostname.

## Local development
```sh
python3 -m http.server 8801
# open http://localhost:8801/
```

## Updating map data
Regenerate the data, then push the changed files to the gist:
```sh
gh gist edit <gist-id> data/library.json
gh gist edit <gist-id> data/maps/<map>.geojson
```
Changes go live within ~60 s. Only push to this repo when the site UI changes.
