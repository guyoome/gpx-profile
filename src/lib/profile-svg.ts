import { elevationAt, type ParsedGpx } from "@/lib/gpx";

export type MarkerIcon = "none" | "food" | "water" | "flag" | "start" | "runner";

export type Marker = {
  id: string;
  name: string;
  /** km */
  dist: number;
  icon: MarkerIcon;
};

export type ChartOptions = {
  color: string;
  width: number;
  height: number;
  /** Number of stacked contour lines */
  lines: number;
  /** Horizontal shift between two consecutive lines, in px */
  shift: number;
  /** Stroke width of the top ridgeline, in px; stacked contour lines scale with it */
  strokeWidth: number;
  showGrid: boolean;
  /** Show the X and Y axes (lines, arrowheads, "Alt (m)"/"Dist (km)" captions and altitude tick labels) */
  showAxes: boolean;
  /** Show the regular distance labels (every 10 km, 5 km… depending on length) */
  showKmLabels: boolean;
  /** Soft colour gradient under the profile and shaded lines; off = flat lines in the picked colour */
  showGradient: boolean;
  background: "white" | "transparent";
};

export const FONT_FAMILY = "ProfileFont, 'Arial Narrow', sans-serif";

/**
 * A runner marks a *position on the course* (where someone is), not a fixed
 * course feature like an aid station. It sits in the top rail like other
 * markers but inverts their colours: a badge in the picked chart colour with
 * a dark-ink icon and outline, plus a dashed leader line, so it stands apart
 * from the solid ink course markers.
 */

/** Parse #rgb / #rrggbb into [r,g,b] 0-255, or null if unrecognized. */
function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = (c: number) => {
    const t = ((c % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const to = (c: number) =>
    Math.round((s === 0 ? l : hue(c)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(h + 1 / 3)}${to(h)}${to(h - 1 / 3)}`;
}

/**
 * A shade of `hex` at lightness `l` (0-1), keeping its hue. Saturation is
 * capped so very dark shades read as ink rather than neon. Unparseable input is
 * returned unchanged.
 */
export function shadeOf(hex: string, l: number, maxSat = 1): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [h, s] = rgbToHsl(...rgb);
  return hslToHex(h, Math.min(s, maxSat), l);
}

/** Linear interpolation between two hex colours (t in 0-1). */
function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  return (
    "#" +
    ca
      .map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Neutral greys used for the grid and secondary labels, independent of the chart colour. */
const GRID_COLOR = "#e5e5e5";
const MUTED_TEXT = "#8a8a8a";

const MARGIN = { top: 62, right: 95, bottom: 48, left: 70 };

function niceStep(range: number, maxTicks: number, steps: number[]) {
  return steps.find((s) => range / s <= maxTicks) ?? steps[steps.length - 1];
}

function fmtKm(d: number) {
  const r = Math.round(d * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Minimal XML text escaping for attribute/text content. */
function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"));
}

/**
 * Tabler outline icons (https://tabler.io/icons, MIT, v3.49) used for markers,
 * as raw path data on the 24×24 grid. Inlined rather than imported because this
 * module builds plain SVG strings (also server-side), so it can't use the React
 * components from @tabler/icons-react.
 */
const TABLER_PATHS: Record<Exclude<MarkerIcon, "none">, string[]> = {
  // tools-kitchen-2
  food: ["M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12m0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3"],
  // droplet
  water: [
    "M7.502 19.423c2.602 2.105 6.395 2.105 8.996 0c2.602 -2.105 3.262 -5.708 1.566 -8.546l-4.89 -7.26c-.42 -.625 -1.287 -.803 -1.936 -.397a1.376 1.376 0 0 0 -.41 .397l-4.893 7.26c-1.695 2.838 -1.035 6.441 1.567 8.546",
  ],
  // flag
  flag: ["M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9", "M5 21v-7"],
  // player-play
  start: ["M7 4v16l13 -8l-13 -8"],
  // run
  runner: [
    "M11.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
    "M4 17l5 1l.75 -1.5",
    "M15 21v-4l-4 -3l1 -6",
    "M7 12v-3l5 -1l3 3l3 1",
  ],
};

/** Rendered icon size in px, centred on the marker badge (r = 13). */
const ICON_SIZE = 16;

/** Marker icon as an SVG string: a Tabler outline icon stroked in `fg`. */
function iconSvg(type: MarkerIcon, fg = "#fff"): string {
  if (type === "none") return "";
  const k = ICON_SIZE / 24;
  // Stroke width is set in icon units (24 grid), so 2.4 renders at ~1.6 px.
  return (
    `<g transform="translate(${-ICON_SIZE / 2},${-ICON_SIZE / 2}) scale(${k})" fill="none" stroke="${fg}" ` +
    `stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">` +
    TABLER_PATHS[type].map((d) => `<path d="${d}"></path>`).join("") +
    `</g>`
  );
}

/**
 * Pure, framework-free SVG string for an elevation profile. This is the single
 * source of truth for the chart geometry: the ProfileChart React component
 * wraps this output, and the API route + build-time generator call it directly,
 * so every environment produces identical SVG with no React server renderer.
 */
export function buildProfileSvg(data: ParsedGpx, markers: Marker[], options: ChartOptions): string {
  const { color, width: W, height: H, lines: N, shift, strokeWidth: SW, showGrid, showAxes, showKmLabels, showGradient, background } = options;
  const x0 = MARGIN.left;
  const x1 = W - MARGIN.right;
  const yBottom = H - MARGIN.bottom;
  const yTop = MARGIN.top;

  const range = Math.max(data.maxEle - data.minEle, 50);
  const eleBase = data.minEle - range * 0.12;
  const eleMax = data.maxEle + range * 0.06;
  const total = data.totalDist;

  const xOf = (d: number) => x0 + (d / total) * (x1 - x0);
  const dOf = (px: number) => ((px - x0) / (x1 - x0)) * total;
  const yOf = (e: number) => yBottom - ((e - eleBase) / (eleMax - eleBase)) * (yBottom - yTop);

  const eleStep = niceStep(eleMax - eleBase, 5, [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000]);
  const eleTicks: number[] = [];
  for (let e = Math.ceil((eleBase + eleStep * 0.3) / eleStep) * eleStep; e <= eleMax; e += eleStep) {
    eleTicks.push(e);
  }

  const kmStep = niceStep(total, 12, [1, 2, 5, 10, 20, 25, 50, 100, 200]);
  const kmTicks: number[] = [];
  for (let d = 0; d <= total + 1e-9; d += kmStep) kmTicks.push(d);

  const pxStep = 1.5;
  const paths: string[] = [];
  for (let i = 0; i < N; i++) {
    const f = 1 - i / N;
    let d = "";
    for (let px = x0; px <= x1 + 0.01; px += pxStep) {
      const dist = Math.min(Math.max(dOf(px - i * shift), 0), total);
      const e = elevationAt(data.points, dist);
      const y = yOf(eleBase + (e - eleBase) * f);
      d += `${d ? "L" : "M"}${px.toFixed(1)},${y.toFixed(1)}`;
    }
    paths.push(d);
  }
  const topLine = paths[0];
  const fillPath = `${topLine}L${x1},${yBottom}L${x0},${yBottom}Z`;

  const sorted = [...markers].sort((a, b) => a.dist - b.dist);
  const markerXs = sorted.map((m) => xOf(Math.min(Math.max(m.dist, 0), total)));

  // One colour in, a family of shades out: a dark "ink" for axes, markers and
  // the ridgeline, fading to the picked colour (lightened) for the deepest layer.
  // With the gradient off, the chart is flat: axes, markers and lines all use
  // the picked colour as-is instead of the dark shade.
  const ink = showGradient ? shadeOf(color, 0.2, 0.75) : color;
  const baseRgb = parseHex(color);
  const baseL = baseRgb ? rgbToHsl(...baseRgb)[2] : 0.5;
  const lightest = shadeOf(color, Math.min(Math.max(baseL, 0.55) + 0.12, 0.8));
  const gradientId = "profile-fill";
  const clipId = "plot-clip";
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${esc(
      FONT_FAMILY,
    )}">`,
  );

  if (background === "white") parts.push(`<rect width="${W}" height="${H}" fill="#fff"></rect>`);

  parts.push(
    `<defs><clipPath id="${clipId}"><rect x="${x0}" y="0" width="${x1 - x0}" height="${yBottom}"></rect></clipPath>` +
      `<linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${color}" stop-opacity="0.22"></stop>` +
      `<stop offset="1" stop-color="${color}" stop-opacity="0.04"></stop>` +
      `</linearGradient></defs>`,
  );

  // Grid
  if (showGrid) {
    let g = `<g stroke="${GRID_COLOR}" stroke-width="1">`;
    for (const e of eleTicks) g += `<line x1="${x0}" x2="${x1}" y1="${yOf(e)}" y2="${yOf(e)}"></line>`;
    for (const d of kmTicks.slice(1))
      g += `<line x1="${xOf(d)}" x2="${xOf(d)}" y1="${yBottom}" y2="${yTop - 20}"></line>`;
    g += `</g>`;
    parts.push(g);
  }

  // Profile (fill + stacked lines, drawn back-to-front)
  let prof = `<g clip-path="url(#${clipId})">`;
  if (showGradient) prof += `<path d="${fillPath}" fill="url(#${gradientId})"></path>`;
  const mid = shadeOf(color, 0.32, 0.8);
  for (let i = paths.length - 1; i >= 0; i--) {
    const t = N > 1 ? i / (N - 1) : 0;
    // With the gradient off, every line is drawn in the picked colour, unshaded.
    const stroke = !showGradient ? color : i === 0 ? ink : mixHex(mid, lightest, t);
    // The ridgeline uses the picked stroke width; stacked contour lines keep
    // their original ratio to it (1 / 2.4 of the ridgeline).
    const strokeWidth = i === 0 ? SW : SW * (1 / 2.4);
    prof += `<path d="${paths[i]}" fill="none" stroke="${stroke}" stroke-opacity="${i === 0 ? 1 : 0.9}" stroke-width="${strokeWidth.toFixed(2)}" stroke-linejoin="round"></path>`;
  }
  prof += `</g>`;
  parts.push(prof);

  // Axes
  if (showAxes) {
    parts.push(
      `<g stroke="${ink}" stroke-width="3" stroke-linecap="round" fill="none">` +
        `<line x1="${x0}" y1="${yBottom}" x2="${x1 + 18}" y2="${yBottom}"></line>` +
        `<line x1="${x0}" y1="${yBottom}" x2="${x0}" y2="${yTop - 20}"></line>` +
        `</g>`,
    );
    parts.push(`<path d="M${x1 + 26},${yBottom} l-10,-5 v10z" fill="${ink}"></path>`);
    parts.push(`<path d="M${x0},${yTop - 28} l-5,10 h10z" fill="${ink}"></path>`);
    parts.push(
      `<text x="${x0 - 10}" y="${yTop - 22}" text-anchor="end" font-size="14" fill="${MUTED_TEXT}">Alt (m)</text>`,
    );
    parts.push(`<text x="${x1 + 32}" y="${yBottom + 5}" font-size="14" fill="${MUTED_TEXT}">Dist (km)</text>`);

    // Altitude labels
    for (const e of eleTicks)
      parts.push(
        `<text x="${x0 - 10}" y="${yOf(e) + 5}" text-anchor="end" font-size="15" fill="${MUTED_TEXT}">${e}</text>`,
      );
  }

  // Regular km labels, skipped when too close to a marker label
  if (showKmLabels) {
    for (const d of kmTicks) {
      const x = xOf(d);
      if (markerXs.some((mx) => Math.abs(mx - x) < 24)) continue;
      parts.push(
        `<text x="${x}" y="${yBottom + 24}" text-anchor="middle" font-size="16" fill="${MUTED_TEXT}">${fmtKm(
          d,
        )}</text>`,
      );
    }
  }

  // Markers
  sorted.forEach((m, i) => {
    const x = markerXs[i];
    const isRunner = m.icon === "runner";
    const hasIcon = m.icon !== "none";
    // Course markers are drawn in ink; a runner gets a badge in the picked
    // colour (ink icon + outline) and a dashed leader line.
    const mColor = ink;
    const badgeFill = isRunner ? color : ink;
    // In flat mode the runner badge would be the same colour as its outline and
    // icon, so fall back to a white outline + icon and let the dashed line set it apart.
    const runnerFg = showGradient ? ink : "#fff";
    const badgeStroke = isRunner ? runnerFg : "#fff";
    const iconY = 22;
    const labelY = hasIcon ? iconY + 22 : yTop - 14;
    let g = `<g>`;
    if (x > x0 + 0.5)
      g += `<line x1="${x}" x2="${x}" y1="${yBottom}" y2="${hasIcon ? iconY + 12 : yTop - 20}" stroke="${mColor}" stroke-width="2"${
        isRunner ? ` stroke-dasharray="4 3"` : ""
      }></line>`;
    if (hasIcon)
      g += `<g transform="translate(${x},${iconY})"><circle r="13" fill="${badgeFill}" stroke="${badgeStroke}" stroke-width="${isRunner ? 2 : 1.5}"></circle>${iconSvg(m.icon, isRunner ? runnerFg : "#fff")}</g>`;
    if (m.name)
      g += `<text transform="translate(${x + 15},${labelY}) rotate(-90)" text-anchor="end" font-size="13" fill="${mColor}">${esc(
        m.name,
      )}</text>`;
    g += `<text x="${x}" y="${yBottom + 24}" text-anchor="middle" font-size="16" font-weight="700" fill="${mColor}">${fmtKm(
      m.dist,
    )}</text>`;
    g += `</g>`;
    parts.push(g);
  });

  parts.push(`</svg>`);
  return parts.join("");
}
