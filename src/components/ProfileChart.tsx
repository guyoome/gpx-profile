"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { ParsedGpx } from "@/lib/gpx";
import {
  buildProfileSvg,
  FONT_FAMILY,
  type ChartOptions,
  type Marker,
  type MarkerIcon,
} from "@/lib/profile-svg";

export { FONT_FAMILY };
export type { ChartOptions, Marker, MarkerIcon };

type Props = {
  data: ParsedGpx;
  markers: Marker[];
  options: ChartOptions;
  svgRef?: Ref<SVGSVGElement>;
};

/**
 * Renders the elevation profile. The SVG markup itself comes from the pure,
 * framework-free {@link buildProfileSvg} — shared with the API route and the
 * build-time generator — so every environment produces identical output. This
 * component injects that markup and exposes the live <svg> node via svgRef for
 * the browser SVG/PNG exporters.
 */
export default function ProfileChart({ data, markers, options, svgRef }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const html = buildProfileSvg(data, markers, options);

  // Re-resolve the live <svg> whenever the markup changes so the exporters
  // always get the current node.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(svgRef, () => hostRef.current?.querySelector("svg") as SVGSVGElement, [html]);

  // Apply the on-screen font family and layout styles to the injected <svg>.
  useEffect(() => {
    const svg = hostRef.current?.querySelector("svg");
    if (!svg) return;

    svg.style.color = options.color;
    svg.style.fontFamily = FONT_FAMILY;
    svg.style.display = "block";

    // Desktop: fit the profile to the container (max-width:100%, no scroll).
    // Mobile: render the profile at its full natural pixel size so it stays
    // large and legible, and let the scrollable wrapper handle the horizontal
    // overflow. Shrinking a wide profile to a phone width turns it into an
    // unreadable sliver, so we deliberately overflow and scroll instead.
    const mq = window.matchMedia("(max-width: 640px)");

    const apply = () => {
      if (mq.matches) {
        // Full size on mobile; never narrower than the viewport.
        svg.style.width = `${options.width}px`;
        svg.style.maxWidth = "none";
        svg.style.minWidth = "100%";
        svg.style.height = "auto";
      } else {
        svg.style.width = "";
        svg.style.maxWidth = "100%";
        svg.style.minWidth = "";
        svg.style.height = "auto";
      }
    };

    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [html, options.color, options.width, options.height]);

  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />;
}
