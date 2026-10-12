import type { ChartOptions, Marker } from "@/lib/profile-svg";
import type { ParsedGpx } from "@/lib/gpx";

/** The default style used for a fresh upload, the example, and the landing preview. */
export const DEFAULT_OPTIONS: ChartOptions = {
  // Lime, matching the shadcn theme primary (oklch(0.841 0.238 128.85)).
  color: "#9ae600",
  width: 1310,
  height: 300,
  lines: 15,
  shift: 0.8,
  showGrid: true,
  showKmLabels: true,
  showGradient: true,
  background: "white",
};

let idSeq = 0;
export const newId = () => `m${++idSeq}`;

/**
 * Markers derived from a parsed GPX: a start, the mid-course waypoints found in
 * the file, and a finish. Shared by the editor and the preview generator.
 */
export function defaultMarkers(data: ParsedGpx): Marker[] {
  const round = (d: number) => Math.round(d * 10) / 10;
  return [
    { id: newId(), name: "Départ", dist: 0, icon: "none" },
    ...data.waypoints
      .filter((w) => w.dist > 0.2 && w.dist < data.totalDist - 0.2)
      .map((w) => ({ id: newId(), name: w.name, dist: round(w.dist), icon: "food" as const })),
    { id: newId(), name: "Arrivée", dist: round(data.totalDist), icon: "flag" },
  ];
}
