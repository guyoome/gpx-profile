"use client";

import { useCallback, useRef, useState } from "react";
import ProfileChart, { type Marker, type MarkerIcon } from "@/components/ProfileChart";
import LandingPreview from "@/components/LandingPreview";
import { parseGpx, type ParsedGpx } from "@/lib/gpx";
import { downloadPng, downloadSvg } from "@/lib/export";
import { track } from "@/lib/analytics";
import { DEFAULT_OPTIONS, defaultMarkers, newId } from "@/lib/profile-defaults";
import type { ChartOptions } from "@/components/ProfileChart";
import styles from "./page.module.css";

const SAMPLE = {
  url: "/sample-diagonale-des-fous.gpx",
  name: "Diagonale des Fous",
  distanceLabel: "176.9 km",
  fileName: "diagonale-des-fous",
};

const ICONS: { value: MarkerIcon; label: string }[] = [
  { value: "none", label: "No icon" },
  { value: "food", label: "Aid station" },
  { value: "water", label: "Water" },
  { value: "flag", label: "Finish flag" },
  { value: "start", label: "Start" },
];

export default function Home() {
  const [data, setData] = useState<ParsedGpx | null>(null);
  const [fileName, setFileName] = useState("profile");
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [options, setOptions] = useState<ChartOptions>(DEFAULT_OPTIONS);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isExample, setIsExample] = useState(false);
  const [exampleLoading, setExampleLoading] = useState(false);
  const [exampleError, setExampleError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** True once an example has been rendered, to detect a later real upload. */
  const cameFromExample = useRef(false);

  const applyParsed = useCallback((parsed: ParsedGpx, name: string, fromExample: boolean) => {
    setData(parsed);
    setMarkers(defaultMarkers(parsed));
    setOptions(DEFAULT_OPTIONS);
    setFileName(name);
    setIsExample(fromExample);
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      setError(null);
      setExampleError(null);
      try {
        if (cameFromExample.current) {
          track("upload_after_example");
          cameFromExample.current = false;
        }
        const parsed = parseGpx(await file.text());
        applyParsed(parsed, file.name.replace(/\.gpx$/i, "") || "profile", false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read this file.");
      }
    },
    [applyParsed],
  );

  const loadExample = useCallback(async () => {
    if (exampleLoading) return;
    track("example_clicked");
    setExampleError(null);
    setError(null);
    setExampleLoading(true);
    const started = performance.now();
    try {
      // Same pipeline as a real upload: fetch the bundled asset, then parseGpx.
      const res = await fetch(SAMPLE.url, { cache: "force-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseGpx(await res.text());
      applyParsed(parsed, SAMPLE.fileName, true);
      cameFromExample.current = true;
      track("example_loaded", { load_ms: Math.round(performance.now() - started) });
    } catch (e) {
      setExampleError("Couldn't load the example. Please try again or upload your own file.");
      track("example_error", { message: e instanceof Error ? e.message : "unknown" });
    } finally {
      setExampleLoading(false);
    }
  }, [applyParsed, exampleLoading]);

  const setOpt = <K extends keyof ChartOptions>(k: K, v: ChartOptions[K]) => {
    setOptions((o) => ({ ...o, [k]: v }));
    if (isExample) track("example_style_changed", { setting: String(k) });
  };

  const updateMarker = (id: string, patch: Partial<Marker>) =>
    setMarkers((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const exportAs = async (kind: "svg" | "png") => {
    if (!svgRef.current) return;
    setBusy(true);
    try {
      if (kind === "svg") await downloadSvg(svgRef.current, `${fileName}-profile.svg`);
      else await downloadPng(svgRef.current, `${fileName}-profile.png`);
      if (isExample) track("example_exported", { kind });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={`${styles.main} ${!data ? styles.landing : ""} ${dragging ? styles.dragging : ""}`}>
      <h1 className={styles.title}>GPX → Elevation profile</h1>
      {!data && (
        <p className={styles.subtitle}>Upload a GPX file, get a race-style elevation profile as SVG or PNG.</p>
      )}

      {/* Single file input, used by both the drop zone and the "Load another GPX" button */}
      <input
        ref={fileInputRef}
        id="gpx-input"
        type="file"
        accept=".gpx,application/gpx+xml"
        className={styles.hiddenInput}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFile(f);
          e.target.value = "";
        }}
      />

      {!data && (
        <>
          <label
            htmlFor="gpx-input"
            className={`${styles.drop} ${dragging ? styles.dropActive : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) loadFile(f);
            }}
          >
            <strong>Drop a GPX file here</strong>
            <span>or click to browse</span>
            <span className={styles.dropHint}>.gpx · max 20 MB</span>
          </label>
          <p className={styles.privacy}>🔒 Files are processed in your browser, never uploaded.</p>

          {/* Example loader, kept outside the drop zone so the two actions don't compete */}
          <div className={styles.exampleArea}>
            <span className={styles.divider} aria-hidden="true">
              or
            </span>

            <button
              type="button"
              className={styles.exampleBtn}
              onClick={loadExample}
              disabled={exampleLoading}
              aria-describedby="example-caption"
            >
              {exampleLoading ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Loading…
                </>
              ) : (
                <>
                  <span aria-hidden="true">▶</span> Try an example
                </>
              )}
            </button>
            <span id="example-caption" className={styles.exampleCaption}>
              Sample: {SAMPLE.name} · {SAMPLE.distanceLabel}
            </span>

            {/* Loading / error state, announced to assistive tech. */}
            <span className={styles.srStatus} aria-live="polite">
              {exampleLoading ? "Loading the example…" : exampleError ? exampleError : ""}
            </span>
            {exampleError && (
              <span className={styles.exampleError} role="alert">
                {exampleError}
              </span>
            )}
          </div>

          <LandingPreview />
        </>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {data && (
        <>
          <div className={styles.toolbar}>
            <p className={styles.stats}>
              <b>{data.name}</b>
              {isExample && <span className={styles.badge}>Example</span>} · {data.totalDist.toFixed(1)} km · D+{" "}
              {Math.round(data.gain)} m · D− {Math.round(data.loss)} m · {Math.round(data.minEle)}–
              {Math.round(data.maxEle)} m
            </p>
            <button className={styles.secondary} onClick={() => fileInputRef.current?.click()}>
              Load another GPX
            </button>
          </div>

          <div className={styles.preview}>
            <ProfileChart data={data} markers={markers} options={options} svgRef={svgRef} />
          </div>

          <div className={styles.actions}>
            <button onClick={() => exportAs("svg")} disabled={busy}>
              Download SVG
            </button>
            <button onClick={() => exportAs("png")} disabled={busy}>
              Download PNG
            </button>
          </div>

          <section className={styles.panel}>
            <h2>Style</h2>
            <div className={styles.grid}>
              <label>
                Color
                <input type="color" value={options.color} onChange={(e) => setOpt("color", e.target.value)} />
              </label>
              <label>
                Lines ({options.lines})
                <input
                  type="range"
                  min={1}
                  max={80}
                  value={options.lines}
                  onChange={(e) => setOpt("lines", +e.target.value)}
                />
              </label>
              <label>
                Shift ({options.shift.toFixed(1)} px)
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.1}
                  value={options.shift}
                  onChange={(e) => setOpt("shift", +e.target.value)}
                />
              </label>
              <label>
                Width
                <input
                  type="number"
                  min={600}
                  max={4000}
                  step={10}
                  value={options.width}
                  onChange={(e) => setOpt("width", Math.max(600, +e.target.value || 600))}
                />
              </label>
              <label>
                Height
                <input
                  type="number"
                  min={200}
                  max={1500}
                  step={10}
                  value={options.height}
                  onChange={(e) => setOpt("height", Math.max(200, +e.target.value || 200))}
                />
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={options.showGrid} onChange={(e) => setOpt("showGrid", e.target.checked)} />
                Grid
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={options.showKmLabels}
                  onChange={(e) => setOpt("showKmLabels", e.target.checked)}
                />
                Regular km labels
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={options.background === "transparent"}
                  onChange={(e) => setOpt("background", e.target.checked ? "transparent" : "white")}
                />
                Transparent background
              </label>
            </div>
          </section>

          <section className={styles.panel}>
            <h2>Markers</h2>
            <p className={styles.hint}>
              Waypoints found in the GPX are added automatically. Edit names, distances and icons below.
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Km</th>
                  <th>Icon</th>
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {[...markers]
                  .sort((a, b) => a.dist - b.dist)
                  .map((m) => (
                    <tr key={m.id}>
                      <td>
                        <input
                          aria-label="Marker name"
                          value={m.name}
                          onChange={(e) => updateMarker(m.id, { name: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          aria-label="Distance in km"
                          type="number"
                          step={0.1}
                          min={0}
                          max={Math.ceil(data.totalDist * 10) / 10}
                          value={m.dist}
                          onChange={(e) => updateMarker(m.id, { dist: +e.target.value || 0 })}
                        />
                      </td>
                      <td>
                        <select
                          aria-label="Icon"
                          value={m.icon}
                          onChange={(e) => updateMarker(m.id, { icon: e.target.value as MarkerIcon })}
                        >
                          {ICONS.map((i) => (
                            <option key={i.value} value={i.value}>
                              {i.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          className={styles.remove}
                          aria-label={`Remove ${m.name}`}
                          onClick={() => setMarkers((ms) => ms.filter((x) => x.id !== m.id))}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <button
              className={styles.secondary}
              onClick={() =>
                setMarkers((ms) => [
                  ...ms,
                  { id: newId(), name: "Ravito", dist: Math.round(data.totalDist * 5) / 10, icon: "food" },
                ])
              }
            >
              + Add marker
            </button>
          </section>
        </>
      )}
    </main>
  );
}
