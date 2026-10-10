import type { Ref } from "react";
import { elevationAt, type ParsedGpx } from "@/lib/gpx";

export type MarkerIcon = "none" | "food" | "water" | "flag" | "start";

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

const MARGIN = { top: 62, right: 95, bottom: 48, left: 70 };

function niceStep(range: number, maxTicks: number, steps: number[]) {
  return steps.find((s) => range / s <= maxTicks) ?? steps[steps.length - 1];
}

function fmtKm(d: number) {
  const r = Math.round(d * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function Icon({ type, color }: { type: MarkerIcon; color: string }) {
  const s = { stroke: "#fff", strokeWidth: 1.6, strokeLinecap: "round" as const, fill: "none" };
  switch (type) {
    case "food":
      // Crossed fork & spoon
      return (
        <g>
          <g transform="rotate(-40)" {...s}>
            <ellipse cx={0} cy={-4} rx={2.2} ry={3} fill="#fff" stroke="none" />
            <line x1={0} y1={-1} x2={0} y2={7} />
          </g>
          <g transform="rotate(40)" {...s}>
            <line x1={-1.8} y1={-7} x2={-1.8} y2={-4} />
            <line x1={0} y1={-7} x2={0} y2={-4} />
            <line x1={1.8} y1={-7} x2={1.8} y2={-4} />
            <path d="M-1.8,-4 Q0,-1.5 1.8,-4" />
            <line x1={0} y1={-2.5} x2={0} y2={7} />
          </g>
        </g>
      );
    case "water":
      return <path d="M0,-7 C3,-3 5,0 5,2.5 A5,5 0 0 1 -5,2.5 C-5,0 -3,-3 0,-7Z" fill="#fff" />;
    case "flag":
      return (
        <g>
          <line x1={-5} y1={-7} x2={-5} y2={7} {...s} />
          <path d="M-5,-6.5 H6 V1 H-5Z" fill="#fff" />
          {/* checkered squares */}
          <path d="M-2.2,-6.5h2.8v3.75h-2.8z M3.4,-6.5h2.6v3.75h-2.6z M0.6,-2.75h2.8V1h-2.8z M-5,-2.75h2.8V1H-5z" fill={color} />
        </g>
      );
    case "start":
      return <path d="M-3.5,-6 L6,0 L-3.5,6Z" fill="#fff" />;
    default:
      return null;
  }
}

type Props = {
  data: ParsedGpx;
  markers: Marker[];
  options: ChartOptions;
  svgRef?: Ref<SVGSVGElement>;
};

export default function ProfileChart({ data, markers, options, svgRef }: Props) {
  const { color, width: W, height: H, lines: N, shift, showGrid, showKmLabels, background } = options;
  const x0 = MARGIN.left;
  const x1 = W - MARGIN.right;
  const yBottom = H - MARGIN.bottom;
  const yTop = MARGIN.top;

  // --- Scales -------------------------------------------------------------
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

  // --- Stacked contour lines ---------------------------------------------
  // Line i is the profile scaled toward the base by (1 - i/N) and shifted right by i*shift.
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

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      style={{ color, fontFamily: FONT_FAMILY, maxWidth: "100%", height: "auto" }}
      fontFamily={FONT_FAMILY}
    >
      {background === "white" && <rect width={W} height={H} fill="#fff" />}
      <defs>
        <clipPath id={clipId}>
          <rect x={x0} y={0} width={x1 - x0} height={yBottom} />
        </clipPath>
      </defs>

      {/* Grid */}
      {showGrid && (
        <g stroke={gridColor} strokeOpacity={0.35} strokeWidth={1}>
          {eleTicks.map((e) => (
            <line key={`h${e}`} x1={x0} x2={x1} y1={yOf(e)} y2={yOf(e)} />
          ))}
          {kmTicks.slice(1).map((d) => (
            <line key={`v${d}`} x1={xOf(d)} x2={xOf(d)} y1={yBottom} y2={yTop - 20} />
          ))}
        </g>
      )}

      {/* Profile */}
      <g clipPath={`url(#${clipId})`}>
        <path d={fillPath} fill={color} fillOpacity={0.05} />
        {paths
          .map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={color}
              strokeOpacity={i === 0 ? 1 : 0.9 - 0.55 * (i / N)}
              strokeWidth={i === 0 ? 2.2 : 1}
              strokeLinejoin="round"
            />
          ))
          .reverse()}
      </g>

      {/* Axes */}
      <g stroke={color} strokeWidth={3} strokeLinecap="round" fill="none">
        <line x1={x0} y1={yBottom} x2={x1 + 18} y2={yBottom} />
        <line x1={x0} y1={yBottom} x2={x0} y2={yTop - 20} />
      </g>
      <path d={`M${x1 + 26},${yBottom} l-10,-5 v10z`} fill={color} />
      <path d={`M${x0},${yTop - 28} l-5,10 h10z`} fill={color} />
      <text x={x0 - 10} y={yTop - 22} textAnchor="end" fontSize={14} fill={color}>
        Alt(m)
      </text>
      <text x={x1 + 32} y={yBottom + 5} fontSize={14} fill={color}>
        Dist (km)
      </text>

      {/* Altitude labels */}
      {eleTicks.map((e) => (
        <text key={`el${e}`} x={x0 - 10} y={yOf(e) + 5} textAnchor="end" fontSize={15} fill={color}>
          {e}
        </text>
      ))}

      {/* Regular km labels, skipped when too close to a marker label */}
      {showKmLabels && kmTicks.map((d) => {
        const x = xOf(d);
        if (markerXs.some((mx) => Math.abs(mx - x) < 24)) return null;
        return (
          <text key={`km${d}`} x={x} y={yBottom + 24} textAnchor="middle" fontSize={16} fill={color} fillOpacity={0.8}>
            {fmtKm(d)}
          </text>
        );
      })}

      {/* Markers */}
      {sorted.map((m, i) => {
        const x = markerXs[i];
        const hasIcon = m.icon !== "none";
        const iconY = 22;
        const labelY = hasIcon ? iconY + 22 : yTop - 14;
        return (
          <g key={m.id}>
            {x > x0 + 0.5 && (
              <line x1={x} x2={x} y1={yBottom} y2={hasIcon ? iconY + 12 : yTop - 20} stroke={color} strokeWidth={2} />
            )}
            {hasIcon && (
              <g transform={`translate(${x},${iconY})`}>
                <circle r={13} fill={color} stroke="#fff" strokeWidth={1.5} />
                <Icon type={m.icon} color={color} />
              </g>
            )}
            {m.name && (
              <text
                transform={`translate(${x + 15},${labelY}) rotate(-90)`}
                textAnchor="end"
                fontSize={13}
                fill={color}
              >
                {m.name}
              </text>
            )}
            <text x={x} y={yBottom + 24} textAnchor="middle" fontSize={16} fontWeight={700} fill={color}>
              {fmtKm(m.dist)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
