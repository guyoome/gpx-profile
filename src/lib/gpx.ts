export type TrackPoint = {
  lat: number;
  lon: number;
  ele: number;
  /** Cumulative distance from start, in km */
  dist: number;
};

export type Waypoint = {
  name: string;
  /** Distance along the track, in km */
  dist: number;
  ele: number;
};

export type ParsedGpx = {
  name: string;
  points: TrackPoint[];
  waypoints: Waypoint[];
  totalDist: number;
  minEle: number;
  maxEle: number;
  gain: number;
  loss: number;
};

const R = 6371; // Earth radius, km

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Children by local name, ignoring XML namespaces. */
function byTag(root: Document | Element, tag: string): Element[] {
  return Array.from(root.getElementsByTagNameNS("*", tag));
}

function childText(el: Element, tag: string): string | null {
  const c = byTag(el, tag)[0];
  return c?.textContent?.trim() || null;
}

/** Distance-weighted moving average to remove GPS/barometric noise. */
function smoothElevation(points: TrackPoint[], windowKm = 0.1): number[] {
  const out: number[] = new Array(points.length);
  let lo = 0;
  let hi = 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const d = points[i].dist;
    while (hi < points.length && points[hi].dist <= d + windowKm / 2) {
      sum += points[hi].ele;
      hi++;
    }
    while (points[lo].dist < d - windowKm / 2) {
      sum -= points[lo].ele;
      lo++;
    }
    out[i] = sum / (hi - lo);
  }
  return out;
}

/** A raw GPX point before distance/smoothing is applied. */
export type RawPoint = { lat: number; lon: number; ele: number };
/** A raw GPX waypoint, projected onto the track later. */
export type RawWaypoint = { name: string; lat: number; lon: number };

/**
 * Pure, DOM-free core: turns raw points/waypoints into a {@link ParsedGpx}.
 * Shared by the browser parser and the build-time preview generator so both
 * produce byte-identical geometry.
 */
export function buildProfile(raw: RawPoint[], rawWaypoints: RawWaypoint[], name: string): ParsedGpx {
  const usable = raw.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (usable.length < 2) throw new Error("No track found in this GPX file.");
  if (!usable.some((p) => Number.isFinite(p.ele))) {
    throw new Error("This GPX has no elevation data (<ele> tags).");
  }

  // Fill missing elevations with the previous known value.
  let lastEle = usable.find((p) => Number.isFinite(p.ele))!.ele;
  const points: TrackPoint[] = [];
  let dist = 0;
  usable.forEach((p, i) => {
    if (i > 0) dist += haversine(usable[i - 1].lat, usable[i - 1].lon, p.lat, p.lon);
    if (Number.isFinite(p.ele)) lastEle = p.ele;
    points.push({ lat: p.lat, lon: p.lon, ele: lastEle, dist });
  });

  const smoothed = smoothElevation(points);
  smoothed.forEach((e, i) => (points[i].ele = e));

  let gain = 0;
  let loss = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;
  for (let i = 0; i < points.length; i++) {
    minEle = Math.min(minEle, points[i].ele);
    maxEle = Math.max(maxEle, points[i].ele);
    if (i > 0) {
      const d = points[i].ele - points[i - 1].ele;
      if (d > 0) gain += d;
      else loss -= d;
    }
  }

  // Waypoints: project each one on the nearest track point.
  const waypoints: Waypoint[] = rawWaypoints
    .map((w) => {
      if (!Number.isFinite(w.lat) || !Number.isFinite(w.lon)) return null;
      let best = points[0];
      let bestD = Infinity;
      for (const p of points) {
        const d = haversine(w.lat, w.lon, p.lat, p.lon);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      // Ignore waypoints further than 500 m from the track.
      if (bestD > 0.5) return null;
      return { name: w.name || "Waypoint", dist: best.dist, ele: best.ele };
    })
    .filter((w): w is Waypoint => w !== null)
    .sort((a, b) => a.dist - b.dist);

  return { name, points, waypoints, totalDist: dist, minEle, maxEle, gain, loss };
}

export function parseGpx(xml: string): ParsedGpx {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("Invalid GPX file (XML parse error).");
  }

  // Track points first, fall back to route points.
  let ptEls = byTag(doc, "trkpt");
  if (ptEls.length === 0) ptEls = byTag(doc, "rtept");

  const raw: RawPoint[] = ptEls.map((el) => ({
    lat: parseFloat(el.getAttribute("lat") ?? ""),
    lon: parseFloat(el.getAttribute("lon") ?? ""),
    ele: parseFloat(childText(el, "ele") ?? "NaN"),
  }));

  const rawWaypoints: RawWaypoint[] = byTag(doc, "wpt").map((el) => ({
    name: childText(el, "name") ?? "Waypoint",
    lat: parseFloat(el.getAttribute("lat") ?? ""),
    lon: parseFloat(el.getAttribute("lon") ?? ""),
  }));

  const name =
    childText(byTag(doc, "trk")[0] ?? doc.documentElement, "name") ??
    childText(doc.documentElement, "name") ??
    "Parcours";

  return buildProfile(raw, rawWaypoints, name);
}

/** Linear interpolation of elevation at a given distance (km). */
export function elevationAt(points: TrackPoint[], d: number): number {
  if (d <= points[0].dist) return points[0].ele;
  const last = points[points.length - 1];
  if (d >= last.dist) return last.ele;
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].dist < d) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const t = b.dist === a.dist ? 0 : (d - a.dist) / (b.dist - a.dist);
  return a.ele + (b.ele - a.ele) * t;
}
