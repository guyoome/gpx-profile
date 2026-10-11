"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import styles from "@/app/page.module.css";

const PREVIEW = {
  src: "/sample-preview.svg",
  width: 1310,
  height: 300,
  alt: "Example elevation profile of the 176 km Diagonale des Fous mountain race, with start and finish markers, axes, grid and the layered line style.",
};

const CAPABILITIES = ["Exports as SVG or PNG", "Custom colors", "Markers", "Transparent background"];

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
    <section ref={sectionRef} className={styles.previewSection} aria-labelledby="preview-heading">
      <h2 id="preview-heading" className={styles.previewHeading}>
        What you&rsquo;ll get
      </h2>

      <div className={styles.previewCard} style={{ aspectRatio: `${PREVIEW.width} / ${PREVIEW.height}` }}>
        {!loaded && <div className={styles.previewSkeleton} aria-hidden="true" />}
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, exact intrinsic size, no optimization needed */}
        <img
          ref={imgRef}
          src={PREVIEW.src}
          width={PREVIEW.width}
          height={PREVIEW.height}
          alt={PREVIEW.alt}
          className={styles.previewImg}
          decoding="async"
          fetchPriority="high"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{ opacity: loaded ? 1 : 0 }}
        />
      </div>

      <ul className={styles.previewChips}>
        {CAPABILITIES.map((c) => (
          <li key={c} className={styles.chip}>
            {c}
          </li>
        ))}
      </ul>
    </section>
  );
}
