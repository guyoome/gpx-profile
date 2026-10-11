# GPX → Elevation profile

Turn a GPX track into a clean, race-style elevation profile and export it as **SVG** or **PNG**.
Everything runs in the browser — files are parsed and rendered client-side and never uploaded —
and the same renderer is also available as an HTTP API.

## Features

- **Drop or browse** a `.gpx` file, or **Try an example** (a bundled Diagonale des Fous sample) to see the output in one click.
- **Race-style rendering**: stacked contour lines, axes, grid, regular km labels, and a layered line style.
- **Markers**: start, finish, and any waypoints found in the GPX are added automatically; names, distances, and icons are editable (aid station, water, finish flag, start).
- **Style controls**: color, number of lines, line shift, width/height, grid, km labels, and transparent background.
- **Exports**: download as SVG or high-resolution PNG, with the display font embedded so the result renders identically anywhere.
- **Landing preview**: a "What you'll get" section shows a real render of the sample (served by the API) so visitors see the output before uploading.
- **HTTP API**: generate a profile SVG from a GPX with a single request (see below).
- **Privacy**: all in-browser processing is local; the API is optional and server-side.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the dev server (Turbopack). |
| `npm run build` | Production build (runs TypeScript). |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint. |

## HTTP API

`POST /api/profile` renders a GPX into a profile SVG. SVG only for now. Rate limited to 30 requests/min per IP.

**Raw GPX in, SVG out:**

```bash
curl -X POST http://localhost:3000/api/profile \
  -H "Content-Type: application/gpx+xml" \
  --data-binary @public/sample-diagonale-des-fous.gpx \
  -o profile.svg
```

**JSON with custom style and/or markers** (send only what you want to change; the rest fall back to defaults):

```bash
curl -X POST http://localhost:3000/api/profile \
  -H "Content-Type: application/json" \
  -d '{
        "gpx": "<?xml version=\"1.0\"?><gpx>…</gpx>",
        "options": { "color": "#cc0022", "lines": 40, "showGrid": false, "background": "transparent" },
        "markers": [{ "id": "a", "name": "Cilaos", "dist": 68, "icon": "water" }]
      }' \
  -o profile.svg
```

**Options** (all optional): `color`, `width` (600–4000), `height` (200–1500), `lines` (1–80), `shift` (0–3), `showGrid`, `showKmLabels`, `background` (`"white"` | `"transparent"`). Omit `markers` to auto-generate start / aid-stations / finish from the GPX waypoints.

**Responses:** `200` `image/svg+xml` on success, with `X-Profile-Name`, `X-Profile-Distance-Km`, `X-Profile-Markers` and `X-RateLimit-*` headers. Errors: `400` (bad body), `413` (GPX > 20 MB), `415` (unsupported Content-Type), `422` (invalid GPX), `429` (rate limited).

**Discovery / sample:**

```bash
curl http://localhost:3000/api/profile              # JSON describing the endpoint
curl "http://localhost:3000/api/profile?sample=1"   # renders the bundled sample as SVG (cacheable)
```

The landing-page preview image is this `?sample=1` endpoint, so the preview is always a real render of the current default style.

## How it works

The pipeline is the same whether you upload a file, load the example, or call the API:

1. **Parse** — `src/lib/gpx.ts` exposes `parseGpx(xml)` for the browser (DOM) and `src/lib/gpx-extract.ts` `parseGpxText(xml)` for the server (regex, no DOM). Both feed the pure, DOM-free `buildProfile(points, waypoints, name)` which computes cumulative distance (haversine), smooths elevation (distance-weighted moving average), and derives gain/loss, min/max, and projected waypoints.
2. **Render** — `src/lib/profile-svg.ts` `buildProfileSvg(data, markers, options)` produces the SVG string with no framework dependency. The `ProfileChart` React component injects this markup for the browser; the API route (`src/lib/render-profile.ts`) returns it directly. One source of truth, so every environment produces identical output.
3. **Export** — `src/lib/export.ts` serializes the live SVG with the font embedded and rasterizes it to PNG via canvas (browser only).

Default style and marker generation live in `src/lib/profile-defaults.ts` (`DEFAULT_OPTIONS`, `defaultMarkers`), shared everywhere.

## Project structure

```
public/
  sample-diagonale-des-fous.gpx   Bundled sample course (Try an example + API ?sample=1)
  fonts/SairaCondensed-SemiBold.ttf
src/
  app/            page.tsx, layout, styles, api/profile/route.ts
  components/     ProfileChart.tsx, LandingPreview.tsx, Card.tsx
  lib/            gpx.ts, gpx-extract.ts, profile-svg.ts, render-profile.ts,
                  profile-defaults.ts, export.ts, analytics.ts, rate-limit.ts
```

## The sample

**`public/sample-diagonale-des-fous.gpx`** — a simplified Diagonale des Fous route (~177 km, 0–2477 m, 6 waypoints), kept small for instant loading. It is a derived, simplified track from a public TraceDeTrail route; confirm redistribution rights before shipping, or swap in a self-made/open-licensed route (the `SAMPLE` constants in `src/app/page.tsx`).

## Tech

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript.
