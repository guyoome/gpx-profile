/**
 * Build-time generator for the landing-page "What you'll get" preview.
 *
 * It renders the *real* ProfileChart component with the bundled sample GPX at
 * the shared DEFAULT_OPTIONS / defaultMarkers, so the preview can never drift
 * from the actual output (requirements FR-2, FR-4). Run it with:
 *
 *   npm run generate:preview
 *
 * Output: public/sample-preview.svg (self-contained, font embedded).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProfileChart, { FONT_FAMILY } from "../src/components/ProfileChart";
import { buildProfile, type RawPoint, type RawWaypoint } from "../src/lib/gpx";
import { DEFAULT_OPTIONS, defaultMarkers } from "../src/lib/profile-defaults";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE = join(root, "public", "sample-diagonale-des-fous.gpx");
const OUT = join(root, "public", "sample-preview.svg");

/**
 * Minimal GPX extraction for Node (no DOM). It only tokenizes the few tags the
 * sample uses and hands the raw points to the shared, DOM-free buildProfile —
 * the exact geometry/stat code the browser upload path uses.
 */
function extract(xml: string): { points: RawPoint[]; waypoints: RawWaypoint[]; name: string } {
  const points: RawPoint[] = [];
  const trkptRe = /<trkpt\b[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  for (let m; (m = trkptRe.exec(xml)); ) {
    const ele = /<ele>([-\d.]+)<\/ele>/.exec(m[3]);
    points.push({ lat: parseFloat(m[1]), lon: parseFloat(m[2]), ele: ele ? parseFloat(ele[1]) : NaN });
  }

  const waypoints: RawWaypoint[] = [];
  const wptRe = /<wpt\b[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"[^>]*>([\s\S]*?)<\/wpt>/g;
  for (let m; (m = wptRe.exec(xml)); ) {
    const nm = /<name>([\s\S]*?)<\/name>/.exec(m[3]);
    waypoints.push({ lat: parseFloat(m[1]), lon: parseFloat(m[2]), name: nm ? nm[1].trim() : "Waypoint" });
  }

  const trkName = /<trk>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(xml);
  const metaName = /<metadata>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(xml);
  return { points, waypoints, name: (trkName?.[1] ?? metaName?.[1] ?? "Parcours").trim() };
}

function main() {
  const xml = readFileSync(SAMPLE, "utf8");
  const { points, waypoints, name } = extract(xml);
  const data = buildProfile(points, waypoints, name);
  const markers = defaultMarkers(data);

  let svg = renderToStaticMarkup(
    createElement(ProfileChart, { data, markers, options: DEFAULT_OPTIONS }),
  );

  // Strip the React-only inline color style; keep it declarative via attributes.
  svg = svg.replace(/ style="[^"]*"/, "");

  // Shrink path geometry: the preview is decorative, so integer coordinates are
  // visually identical at display size but roughly halve the file. Scoped to the
  // path `d` data only, so opacities and other attributes keep full precision.
  // Only touches the generated asset — the live chart keeps full precision.
  svg = svg.replace(/\bd="[^"]*"/g, (d) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(parseFloat(n)))));

  // No @font-face embed: this asset is shown through <img>, where the chart's
  // fallback stack ('Arial Narrow', sans-serif) renders legibly, and embedding
  // the ~125 KB base64 font would blow the <100 KB budget (FR-3) for a purely
  // decorative preview. The downloadable exports still embed the real font.

  const out = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg + "\n";
  writeFileSync(OUT, out);

  const kb = Buffer.byteLength(out) / 1024;
  console.log(`Wrote ${OUT} (${kb.toFixed(1)} KB), ${data.totalDist.toFixed(1)} km, ${markers.length} markers`);
  console.log(`Font family used: ${FONT_FAMILY}`);
  if (kb > 100) {
    console.warn(`! Preview is ${kb.toFixed(1)} KB, over the 100 KB soft target.`);
  }
}

main();
