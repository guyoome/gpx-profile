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
  showGrid: boolean;
  /** Show the regular distance labels (every 10 km, 5 km… depending on length) */
  showKmLabels: boolean;
  background: "white" | "transparent";
};

export const FONT_FAMILY = "ProfileFont, 'Arial Narrow', sans-serif";

/**
 * A runner marks a *position on the course* (where someone is), not a fixed
 * course feature like an aid station. It sits in the top rail like other
 * markers but is drawn in the chart colour's complement (opposite hue) with a
 * distinct running-figure icon and a dashed leader line, so it stands apart
 * whatever profile colour the user picks.
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
 * Complementary colour of a hex (opposite hue), with a slight saturation/
 * lightness floor so it stays visible against the plot. Falls back to a fixed
 * accent if the input can't be parsed.
 */
export function complementaryColor(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#e8732c";
  const [h, s, l] = rgbToHsl(...rgb);
  const h2 = (h + 0.5) % 1;
  const s2 = Math.max(s, 0.5);
  const l2 = Math.min(Math.max(l, 0.35), 0.6);
  return hslToHex(h2, s2, l2);
}

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

/** Marker icon as an SVG string, mirroring the component's <Icon> output. */
function iconSvg(type: MarkerIcon, color: string): string {
  const s = `stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"`;
  switch (type) {
    case "food":
      return (
        `<g>` +
        `<g transform="rotate(-40)" ${s}>` +
        `<ellipse cx="0" cy="-4" rx="2.2" ry="3" fill="#fff" stroke="none"></ellipse>` +
        `<line x1="0" y1="-1" x2="0" y2="7"></line>` +
        `</g>` +
        `<g transform="rotate(40)" ${s}>` +
        `<line x1="-1.8" y1="-7" x2="-1.8" y2="-4"></line>` +
        `<line x1="0" y1="-7" x2="0" y2="-4"></line>` +
        `<line x1="1.8" y1="-7" x2="1.8" y2="-4"></line>` +
        `<path d="M-1.8,-4 Q0,-1.5 1.8,-4"></path>` +
        `<line x1="0" y1="-2.5" x2="0" y2="7"></line>` +
        `</g>` +
        `</g>`
      );
    case "water":
      return `<path d="M0,-7 C3,-3 5,0 5,2.5 A5,5 0 0 1 -5,2.5 C-5,0 -3,-3 0,-7Z" fill="#fff"></path>`;
    case "flag":
      return (
        `<g>` +
        `<line x1="-5" y1="-7" x2="-5" y2="7" ${s}></line>` +
        `<path d="M-5,-6.5 H6 V1 H-5Z" fill="#fff"></path>` +
        `<path d="M-2.2,-6.5h2.8v3.75h-2.8z M3.4,-6.5h2.6v3.75h-2.6z M0.6,-2.75h2.8V1h-2.8z M-5,-2.75h2.8V1H-5z" fill="${color}"></path>` +
        `</g>`
      );
    case "start":
      return `<path d="M-3.5,-6 L6,0 L-3.5,6Z" fill="#fff"></path>`;
    case "runner":
      // Simple running figure: head, torso, swinging arms and striding legs.
      return (
        `<g stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none">` +
        `<circle cx="1.5" cy="-6" r="2" fill="#fff" stroke="none"></circle>` +
        `<path d="M3,-3 L-1,0 L1.5,3 L0,7"></path>` +
        `<path d="M3,-3 L5,1"></path>` +
        `<path d="M3,-3 L-2,-4"></path>` +
        `<path d="M1.5,3 L5,5"></path>` +
        `</g>`
      );
    default:
      return "";
  }
}

/**
 * Pure, framework-free SVG string for an elevation profile. This is the single
 * source of truth for the chart geometry: the ProfileChart React component
 * wraps this output, and the API route + build-time generator call it directly,
 * so every environment produces identical SVG with no React server renderer.
 */
export function buildProfileSvg(data: ParsedGpx, markers: Marker[], options: ChartOptions): string {
  const { color, width: W, height: H, lines: N, shift, showGrid, showKmLabels, background } = options;
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

  const gridColor = color;
  const clipId = "plot-clip";
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${esc(
      FONT_FAMILY,
    )}">`,
  );

  if (background === "white") parts.push(`<rect width="${W}" height="${H}" fill="#fff"></rect>`);

  parts.push(
    `<defs><clipPath id="${clipId}"><rect x="${x0}" y="0" width="${x1 - x0}" height="${yBottom}"></rect></clipPath></defs>`,
  );

  // Grid
  if (showGrid) {
    let g = `<g stroke="${gridColor}" stroke-opacity="0.35" stroke-width="1">`;
    for (const e of eleTicks) g += `<line x1="${x0}" x2="${x1}" y1="${yOf(e)}" y2="${yOf(e)}"></line>`;
    for (const d of kmTicks.slice(1))
      g += `<line x1="${xOf(d)}" x2="${xOf(d)}" y1="${yBottom}" y2="${yTop - 20}"></line>`;
    g += `</g>`;
    parts.push(g);
  }

  // Profile (fill + stacked lines, drawn back-to-front)
  let prof = `<g clip-path="url(#${clipId})">`;
  prof += `<path d="${fillPath}" fill="${color}" fill-opacity="0.05"></path>`;
  for (let i = paths.length - 1; i >= 0; i--) {
    const strokeOpacity = i === 0 ? 1 : 0.9 - 0.55 * (i / N);
    const strokeWidth = i === 0 ? 2.2 : 1;
    prof += `<path d="${paths[i]}" fill="none" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}" stroke-linejoin="round"></path>`;
  }
  prof += `</g>`;
  parts.push(prof);

  // Axes
  parts.push(
    `<g stroke="${color}" stroke-width="3" stroke-linecap="round" fill="none">` +
      `<line x1="${x0}" y1="${yBottom}" x2="${x1 + 18}" y2="${yBottom}"></line>` +
      `<line x1="${x0}" y1="${yBottom}" x2="${x0}" y2="${yTop - 20}"></line>` +
      `</g>`,
  );
  parts.push(`<path d="M${x1 + 26},${yBottom} l-10,-5 v10z" fill="${color}"></path>`);
  parts.push(`<path d="M${x0},${yTop - 28} l-5,10 h10z" fill="${color}"></path>`);
  parts.push(
    `<text x="${x0 - 10}" y="${yTop - 22}" text-anchor="end" font-size="14" fill="${color}">Alt(m)</text>`,
  );
  parts.push(`<text x="${x1 + 32}" y="${yBottom + 5}" font-size="14" fill="${color}">Dist (km)</text>`);

  // Altitude labels
  for (const e of eleTicks)
    parts.push(
      `<text x="${x0 - 10}" y="${yOf(e) + 5}" text-anchor="end" font-size="15" fill="${color}">${e}</text>`,
    );

  // Regular km labels, skipped when too close to a marker label
  if (showKmLabels) {
    for (const d of kmTicks) {
      const x = xOf(d);
      if (markerXs.some((mx) => Math.abs(mx - x) < 24)) continue;
      parts.push(
        `<text x="${x}" y="${yBottom + 24}" text-anchor="middle" font-size="16" fill="${color}" fill-opacity="0.8">${fmtKm(
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
    // A runner uses the chart colour's complement but sits in the top rail at
    // the same height as every other marker, with a dashed leader line.
    const mColor = isRunner ? complementaryColor(color) : color;
    const iconY = 22;
    const labelY = hasIcon ? iconY + 22 : yTop - 14;
    let g = `<g>`;
    if (x > x0 + 0.5)
      g += `<line x1="${x}" x2="${x}" y1="${yBottom}" y2="${hasIcon ? iconY + 12 : yTop - 20}" stroke="${mColor}" stroke-width="2"${
        isRunner ? ` stroke-dasharray="4 3"` : ""
      }></line>`;
    if (hasIcon)
      g += `<g transform="translate(${x},${iconY})"><circle r="13" fill="${mColor}" stroke="#fff" stroke-width="1.5"></circle>${iconSvg(
        m.icon,
        mColor,
      )}</g>`;
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
