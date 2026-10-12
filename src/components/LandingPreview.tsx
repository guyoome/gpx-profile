"use client";

import { useEffect, useRef, useState } from "react";
import { IconMapPin, IconPalette, IconPhoto, IconStack2, type Icon } from "@tabler/icons-react";
import { track } from "@/lib/analytics";

const PREVIEW = {
  src: "/api/profile?sample=1",
  width: 1310,
  height: 300,
  alt: "Example elevation profile of the 176 km Diagonale des Fous mountain race, with start and finish markers, axes, grid and the layered line style.",
};

const FEATURES: { title: string; body: string; Icon: Icon }[] = [
  { title: "SVG or PNG", body: "Vector for print and web, or a PNG at any size.", Icon: IconPhoto },
  { title: "Custom colors", body: "Pick one color, the ridgeline shades follow.", Icon: IconPalette },
  { title: "Markers", body: "Aid stations, summits and finish flags with a label.", Icon: IconMapPin },
  { title: "Transparent background", body: "Drop the profile onto any poster or page.", Icon: IconStack2 },
];

/**
 * The "What you'll get" section shown on the landing page below the drop zone.
 * Static, non-interactive preview of a real tool output (generated at build
 * time by scripts/generate-preview.tsx). Reserves its space to avoid layout
 * shift, shows a skeleton until the image loads, and hides itself silently if
 * the image fails — the upload flow is never affected.
 */
export default function LandingPreview() {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const seen = useRef(false);

  useEffect(() => {
    track("landing_viewed");
  }, []);

  // The image can finish loading (e.g. straight from cache) before React wires
  // up onLoad, so that event may never fire and the skeleton would stay forever.
  // Reconcile against the real DOM state on mount.
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete) {
      if (img.naturalWidth > 0) setLoaded(true);
      else setFailed(true);
    }
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || seen.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !seen.current) {
            seen.current = true;
            track("preview_in_viewport");
            obs.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (failed) return null;

  return (
    <section ref={sectionRef} className="mt-16" aria-labelledby="preview-heading">
      <h2 id="preview-heading" className="mb-5 text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
        What you&rsquo;ll get
      </h2>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-8">
        <div className="relative w-full" style={{ aspectRatio: `${PREVIEW.width} / ${PREVIEW.height}` }}>
          {!loaded && (
            <div aria-hidden="true" className="absolute inset-0 rounded-lg bg-muted motion-safe:animate-pulse" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, exact intrinsic size, no optimization needed */}
          <img
            ref={imgRef}
            src={PREVIEW.src}
            width={PREVIEW.width}
            height={PREVIEW.height}
            alt={PREVIEW.alt}
            className="block h-auto w-full transition-opacity duration-300"
            decoding="async"
            fetchPriority="high"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{ opacity: loaded ? 1 : 0 }}
          />
        </div>
      </div>

      <ul className="mt-5 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ title, body, Icon }) => (
          <li key={title} className="rounded-2xl border border-border bg-card p-5">
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground"
            >
              <Icon className="size-5" stroke={1.75} />
            </span>
            <h3 className="mt-6 mb-0 text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-1 mb-0 text-[0.95rem] leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
