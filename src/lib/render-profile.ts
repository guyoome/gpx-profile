import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildProfileSvg, type ChartOptions, type Marker } from "@/lib/profile-svg";
import { parseGpxText } from "@/lib/gpx-extract";
import { DEFAULT_OPTIONS, defaultMarkers } from "@/lib/profile-defaults";

/** Bounds mirror the editor UI inputs so the API can't request absurd sizes. */
const BOUNDS = {
  width: { min: 600, max: 4000 },
  height: { min: 200, max: 1500 },
  lines: { min: 1, max: 80 },
  shift: { min: 0, max: 3 },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/**
 * Merge caller-supplied style over the shared defaults, coercing and clamping
 * each field so the result is always a valid ChartOptions regardless of input.
 */
export function resolveOptions(input: Partial<ChartOptions> | undefined): ChartOptions {
  const o = { ...DEFAULT_OPTIONS, ...(input ?? {}) };
  return {
    color: typeof o.color === "string" ? o.color : DEFAULT_OPTIONS.color,
    width: clamp(Math.round(+o.width || DEFAULT_OPTIONS.width), BOUNDS.width.min, BOUNDS.width.max),
    height: clamp(Math.round(+o.height || DEFAULT_OPTIONS.height), BOUNDS.height.min, BOUNDS.height.max),
    lines: clamp(Math.round(+o.lines || DEFAULT_OPTIONS.lines), BOUNDS.lines.min, BOUNDS.lines.max),
    shift: clamp(+o.shift, BOUNDS.shift.min, BOUNDS.shift.max) || 0,
    showGrid: Boolean(o.showGrid),
    showAxes: Boolean(o.showAxes),
    showKmLabels: Boolean(o.showKmLabels),
    showGradient: Boolean(o.showGradient),
    background: o.background === "transparent" ? "transparent" : "white",
  };
}

let fontDataUrl: string | null = null;
function loadFontDataUrl(): string {
  if (fontDataUrl) return fontDataUrl;
  const file = join(process.cwd(), "public", "fonts", "SairaCondensed-SemiBold.ttf");
  fontDataUrl = `data:font/ttf;base64,${readFileSync(file).toString("base64")}`;
  return fontDataUrl;
}

export type RenderInput = {
  gpx: string;
  options?: Partial<ChartOptions>;
  /** Explicit markers; when omitted, derived from the GPX waypoints. */
  markers?: Marker[];
  /** Embed the font so the SVG is self-contained and pixel-faithful. */
  embedFont?: boolean;
};

export type RenderResult = {
  svg: string;
  meta: { name: string; totalDist: number; gain: number; loss: number; minEle: number; maxEle: number; markers: number };
};

/**
 * Server-side render of a GPX into a profile SVG, reusing the exact same
 * buildProfile + ProfileChart pipeline as the browser and the build-time
 * preview generator. Throws on invalid/empty GPX (same messages as the UI).
 */
export function renderProfileSvg(input: RenderInput): RenderResult {
  const data = parseGpxText(input.gpx);
  const options = resolveOptions(input.options);
  const markers = input.markers?.length ? input.markers : defaultMarkers(data);

  let svg = buildProfileSvg(data, markers, options);

  if (input.embedFont) {
    const face =
      `<style>@font-face{font-family:ProfileFont;` +
      `src:url(${loadFontDataUrl()}) format("truetype");}</style>`;
    svg = svg.replace(/(<svg[^>]*>)/, `$1${face}`);
  }

  const out = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg + "\n";
  return {
    svg: out,
    meta: {
      name: data.name,
      totalDist: data.totalDist,
      gain: data.gain,
      loss: data.loss,
      minEle: data.minEle,
      maxEle: data.maxEle,
      markers: markers.length,
    },
  };
}
