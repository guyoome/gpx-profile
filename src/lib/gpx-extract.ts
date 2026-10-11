import { buildProfile, type ParsedGpx, type RawPoint, type RawWaypoint } from "@/lib/gpx";

/**
 * DOM-free GPX extraction for server/Node contexts (route handler, build-time
 * generator) where `DOMParser` is unavailable. It tokenizes the point and
 * waypoint tags and hands the raw values to the shared, DOM-free
 * {@link buildProfile} — the exact geometry/stat code the browser upload path
 * uses — so every environment produces identical output.
 *
 * Falls back from <trkpt> to <rtept> like the browser parser.
 */
export function parseGpxText(xml: string): ParsedGpx {
  const points: RawPoint[] = [];
  let ptRe = /<trkpt\b[^>]*?\blat="([-\d.]+)"[^>]*?\blon="([-\d.]+)"[^>]*?>([\s\S]*?)<\/trkpt>/g;
  let hasTrk = false;
  for (let m; (m = ptRe.exec(xml)); ) {
    hasTrk = true;
    const ele = /<ele>\s*([-\d.]+)\s*<\/ele>/.exec(m[3]);
    points.push({ lat: parseFloat(m[1]), lon: parseFloat(m[2]), ele: ele ? parseFloat(ele[1]) : NaN });
  }
  if (!hasTrk) {
    ptRe = /<rtept\b[^>]*?\blat="([-\d.]+)"[^>]*?\blon="([-\d.]+)"[^>]*?>([\s\S]*?)<\/rtept>/g;
    for (let m; (m = ptRe.exec(xml)); ) {
      const ele = /<ele>\s*([-\d.]+)\s*<\/ele>/.exec(m[3]);
      points.push({ lat: parseFloat(m[1]), lon: parseFloat(m[2]), ele: ele ? parseFloat(ele[1]) : NaN });
    }
  }

  const waypoints: RawWaypoint[] = [];
  const wptRe = /<wpt\b[^>]*?\blat="([-\d.]+)"[^>]*?\blon="([-\d.]+)"[^>]*?>([\s\S]*?)<\/wpt>/g;
  for (let m; (m = wptRe.exec(xml)); ) {
    const nm = /<name>([\s\S]*?)<\/name>/.exec(m[3]);
    waypoints.push({ lat: parseFloat(m[1]), lon: parseFloat(m[2]), name: nm ? nm[1].trim() : "Waypoint" });
  }

  const trkName = /<trk>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(xml);
  const metaName = /<metadata>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(xml);
  const name = (trkName?.[1] ?? metaName?.[1] ?? "Parcours").trim();

  return buildProfile(points, waypoints, name);
}
