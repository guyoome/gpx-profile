"use client";

import { useCallback, useRef, useState } from "react";
import {
  IconDownload,
  IconLock,
  IconPlayerPlay,
  IconPlus,
  IconRotate,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import ProfileChart, { type Marker, type MarkerIcon, type ChartOptions } from "@/components/ProfileChart";
import LandingPreview from "@/components/LandingPreview";
import Card from "@/components/Card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseGpx, type ParsedGpx } from "@/lib/gpx";
import { downloadPng, downloadSvg } from "@/lib/export";
import { track } from "@/lib/analytics";
import { DEFAULT_OPTIONS, defaultMarkers, newId } from "@/lib/profile-defaults";

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
  { value: "runner", label: "Runner" },
];

const GROUP_LABEL = "mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground";
const FIELD_LABEL = "flex flex-col gap-2 text-[0.95rem] font-medium text-foreground";
const FIELD_INPUT_MONO = "h-11 px-3.5 font-mono md:text-[0.95rem]";
const CHECK_LABEL = "flex items-center gap-2 text-[0.95rem] font-normal";

/** Integer with a non-breaking-space thousands separator, as in "10 357". */
const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US").replace(/,/g, "\u00a0");

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-card px-5 py-4 ring-1 ring-border">
      <p className="m-0 text-[0.95rem] text-muted-foreground">{label}</p>
      <p className="mt-1 mb-0 text-[2rem] leading-tight font-bold tracking-[-0.03em] tabular-nums">
        {value}
        <span className="ml-1.5 text-base font-normal tracking-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

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

  const addMarker = () => {
    if (!data) return;
    setMarkers((ms) => [
      ...ms,
      { id: newId(), name: "Ravito", dist: Math.round(data.totalDist * 5) / 10, icon: "food" },
    ]);
  };

  const resetStyle = () => {
    setOptions(DEFAULT_OPTIONS);
  };

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

  const maxKm = data ? Math.ceil(data.totalDist * 10) / 10 : 0;

  return (
    <main className={`mx-auto max-w-6xl px-6 pb-20 ${data ? "pt-10" : "pt-12 sm:pt-14"}`}>
      {data ? (
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-3xl font-bold tracking-[-0.03em] sm:text-[2.1rem]">
              {isExample ? data.name.replace(/\s*\(sample\)\s*$/i, "") : data.name}
              {isExample && <span className="font-normal text-muted-foreground"> (sample)</span>}
            </h1>
            {isExample && <Badge className="h-6 px-2.5 text-xs font-semibold">Example</Badge>}
          </div>
          <Button
            variant="outline"
            className="h-10 px-4 text-[0.95rem] font-medium"
            onClick={() => fileInputRef.current?.click()}
          >
            <IconUpload data-icon="inline-start" stroke={2} />
            Load another GPX
          </Button>
        </header>
      ) : (
        <header className="flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm text-muted-foreground">
            <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
            Free · runs in your browser
          </span>
          <h1 className="mt-3 mb-0 text-4xl leading-[1.12] font-bold tracking-[-0.04em] text-foreground sm:text-5xl md:text-6xl">
            Race-style{" "}
            <span className="rounded-xl bg-primary px-2 text-primary-foreground [box-decoration-break:clone]">
              elevation profiles
            </span>
            <br />
            from any GPX.
          </h1>
          <p className="mt-6 mb-0 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Drop a GPX file, add your aid stations, and export a clean ridgeline profile as SVG or PNG.
          </p>
        </header>
      )}

      {/* Single file input, used by both the drop zone and the "Load another GPX" button */}
      <input
        ref={fileInputRef}
        id="gpx-input"
        type="file"
        accept=".gpx,application/gpx+xml"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFile(f);
          e.target.value = "";
        }}
      />

      {!data && (
        <>
          {/* Drop zone: clicking anywhere opens the picker; the buttons are the keyboard path. */}
          <div
            className={`mt-12 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors sm:py-14 ${
              dragging ? "border-primary bg-primary/10" : "border-foreground/25 bg-muted/60 hover:border-primary"
            }`}
            onClick={() => fileInputRef.current?.click()}
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
            <span
              aria-hidden="true"
              className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <IconUpload className="size-6" stroke={2} />
            </span>
            <p className="mt-5 mb-0 text-lg font-semibold text-foreground">Drop a GPX file here</p>
            <p className="mt-1 mb-0 text-sm text-muted-foreground">or click to browse · .gpx · max 20 MB</p>

            <div className="mt-6 flex flex-wrap justify-center gap-3 max-sm:w-full max-sm:flex-col">
              <Button
                type="button"
                className="h-10 px-4 text-[0.95rem] font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <IconUpload data-icon="inline-start" stroke={2} />
                Browse files
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 px-4 text-[0.95rem] font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  loadExample();
                }}
                disabled={exampleLoading}
                aria-describedby="example-caption"
              >
                {exampleLoading ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                    />
                    Loading…
                  </>
                ) : (
                  <>
                    <IconPlayerPlay data-icon="inline-start" stroke={2} />
                    Try an example
                  </>
                )}
              </Button>
            </div>
            <span id="example-caption" className="mt-4 text-sm text-muted-foreground">
              Sample: {SAMPLE.name} · {SAMPLE.distanceLabel}
            </span>

            {/* Loading / error state, announced to assistive tech. */}
            <span className="sr-only" aria-live="polite">
              {exampleLoading ? "Loading the example…" : exampleError ? exampleError : ""}
            </span>
            {exampleError && (
              <span className="mt-2 max-w-[320px] text-sm text-destructive" role="alert">
                {exampleError}
              </span>
            )}
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <IconLock aria-hidden="true" className="size-4" stroke={1.75} />
            Files are processed in your browser, never uploaded.
          </p>

          <LandingPreview />

          <p className="mt-12 text-center text-sm leading-loose text-muted-foreground">
            Developers: generate a profile programmatically with the{" "}
            <a
              href="/api/profile"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-4"
            >
              HTTP API
            </a>{" "}
            —{" "}
            <code className="rounded-md bg-secondary px-2 py-1 font-mono text-[0.85rem] text-foreground">
              POST /api/profile
            </code>{" "}
            with your GPX, get an SVG back.
          </p>
        </>
      )}

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-destructive" role="alert">
          {error}
        </p>
      )}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Distance" value={data.totalDist.toFixed(1)} unit="km" />
            <Stat label="Elevation gain (D+)" value={fmtInt(data.gain)} unit="m" />
            <Stat label="Elevation loss (D−)" value={fmtInt(data.loss)} unit="m" />
            <Stat label="Altitude range" value={`${fmtInt(data.minEle)}–${fmtInt(data.maxEle)}`} unit="m" />
          </div>

          <div className="mt-6 flex flex-col gap-6">
            {/* Preview card: chart + export buttons */}
            <section
              aria-labelledby="preview-title"
              className="rounded-2xl bg-card p-6 ring-1 ring-border"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 id="preview-title" className="m-0 text-lg font-semibold tracking-tight">
                    Preview
                  </h2>
                  <p className="mt-0.5 mb-0 text-[0.95rem] text-muted-foreground">
                    {options.width} × {options.height} px · {options.lines} lines · {markers.length}{" "}
                    {markers.length === 1 ? "marker" : "markers"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 max-sm:w-full">
                  <Button
                    className="h-10 px-4 text-[0.95rem] font-semibold max-sm:flex-1"
                    onClick={() => exportAs("svg")}
                    disabled={busy}
                  >
                    <IconDownload data-icon="inline-start" stroke={2} />
                    Download SVG
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 px-4 text-[0.95rem] font-medium max-sm:flex-1"
                    onClick={() => exportAs("png")}
                    disabled={busy}
                  >
                    <IconDownload data-icon="inline-start" stroke={2} />
                    Download PNG
                  </Button>
                </div>
              </div>
              <div
                className={`mt-5 overflow-x-auto rounded-xl border border-border p-3 transition-opacity ${
                  dragging ? "opacity-60" : ""
                } ${options.background === "transparent" ? "" : "bg-white"}`}
                style={
                  options.background === "transparent"
                    ? { background: "repeating-conic-gradient(#f3f3f3 0% 25%, #fff 0% 50%) 50% / 20px 20px" }
                    : undefined
                }
              >
                <ProfileChart data={data} markers={markers} options={options} svgRef={svgRef} />
              </div>
            </section>

            {/* Style and Markers side by side on wide screens */}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[5fr_7fr]">
              <Card
                title="Style"
                actions={
                  <Button variant="ghost" className="h-9 px-3 text-[0.95rem]" onClick={resetStyle}>
                    <IconRotate data-icon="inline-start" stroke={2} />
                    Reset
                  </Button>
                }
              >
                <div className="flex flex-col gap-6">
                  <fieldset className="m-0 min-w-0 border-0 p-0">
                    <legend className={GROUP_LABEL}>Appearance</legend>
                    <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-x-7 gap-y-3 max-sm:grid-cols-1">
                      <label className={FIELD_LABEL}>
                        Color
                        <input
                          type="color"
                          className="h-11 w-14 cursor-pointer rounded-lg border border-input bg-background p-1"
                          value={options.color}
                          onChange={(e) => setOpt("color", e.target.value)}
                        />
                      </label>
                      <div className={`${FIELD_LABEL} pb-3`}>
                        <span>
                          Lines <span className="text-muted-foreground tabular-nums">{options.lines}</span>
                        </span>
                        <Slider
                          aria-label="Lines"
                          className="mt-2"
                          min={1}
                          max={80}
                          value={options.lines}
                          onValueChange={(v) => setOpt("lines", Array.isArray(v) ? v[0] : v)}
                        />
                      </div>
                      <div className={`${FIELD_LABEL} pb-3`}>
                        <span>
                          Shift{" "}
                          <span className="font-mono text-muted-foreground">{options.shift.toFixed(1)} px</span>
                        </span>
                        <Slider
                          aria-label="Shift"
                          className="mt-2"
                          min={0}
                          max={3}
                          step={0.1}
                          value={options.shift}
                          onValueChange={(v) => setOpt("shift", Array.isArray(v) ? v[0] : v)}
                        />
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="m-0 min-w-0 border-0 p-0">
                    <legend className={GROUP_LABEL}>Size</legend>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <label className={FIELD_LABEL}>
                        Width (px)
                        <Input
                          type="number"
                          className={FIELD_INPUT_MONO}
                          min={600}
                          max={4000}
                          step={10}
                          value={options.width}
                          onChange={(e) => setOpt("width", Math.max(600, +e.target.value || 600))}
                        />
                      </label>
                      <label className={FIELD_LABEL}>
                        Height (px)
                        <Input
                          type="number"
                          className={FIELD_INPUT_MONO}
                          min={200}
                          max={1500}
                          step={10}
                          value={options.height}
                          onChange={(e) => setOpt("height", Math.max(200, +e.target.value || 200))}
                        />
                      </label>
                    </div>
                  </fieldset>

                  <fieldset className="m-0 min-w-0 border-0 p-0">
                    <legend className={GROUP_LABEL}>Display</legend>
                    <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
                      <Label className={CHECK_LABEL}>
                        <Checkbox
                          className="size-5"
                          checked={options.showGrid}
                          onCheckedChange={(c) => setOpt("showGrid", c === true)}
                        />
                        Grid
                      </Label>
                      <Label className={CHECK_LABEL}>
                        <Checkbox
                          className="size-5"
                          checked={options.showKmLabels}
                          onCheckedChange={(c) => setOpt("showKmLabels", c === true)}
                        />
                        Regular km labels
                      </Label>
                      <Label className={CHECK_LABEL}>
                        <Checkbox
                          className="size-5"
                          checked={options.showGradient}
                          onCheckedChange={(c) => setOpt("showGradient", c === true)}
                        />
                        Gradient fill
                      </Label>
                      <Label className={CHECK_LABEL}>
                        <Checkbox
                          className="size-5"
                          checked={options.background === "transparent"}
                          onCheckedChange={(c) => setOpt("background", c === true ? "transparent" : "white")}
                        />
                        Transparent background
                      </Label>
                    </div>
                  </fieldset>
                </div>
              </Card>

              <Card
                title="Markers"
                helper="Waypoints found in the GPX are added automatically. Edit names, positions and icons."
                actions={
                  <Button variant="outline" className="h-10 px-4 text-[0.95rem] font-medium" onClick={addMarker}>
                    <IconPlus data-icon="inline-start" stroke={2} />
                    Add marker
                  </Button>
                }
              >
                {markers.length === 0 ? (
                  <div className="flex flex-col items-start gap-3 text-muted-foreground">
                    <p className="m-0">No markers yet. Add one to label a point on the profile.</p>
                    <Button variant="secondary" onClick={addMarker}>
                      <IconPlus data-icon="inline-start" stroke={2} />
                      Add marker
                    </Button>
                  </div>
                ) : (
                  <div className="max-h-120 overflow-y-auto">
                    <Table className="border-separate border-spacing-y-2">
                      <TableHeader className="[&_tr]:border-0">
                        <TableRow className="border-0 hover:bg-transparent">
                          <TableHead className="h-auto pl-0 font-normal text-muted-foreground">Name</TableHead>
                          <TableHead className="h-auto font-normal text-muted-foreground">Km</TableHead>
                          <TableHead className="h-auto font-normal text-muted-foreground">Icon</TableHead>
                          <TableHead aria-label="Remove" className="h-auto" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...markers]
                          .sort((a, b) => a.dist - b.dist)
                          .map((m) => (
                            <TableRow key={m.id} className="border-0 hover:bg-transparent">
                              <TableCell className="py-0 pl-0">
                                <Input
                                  aria-label="Marker name"
                                  className="h-11 min-w-32 px-3.5 md:text-[0.95rem]"
                                  value={m.name}
                                  onChange={(e) => updateMarker(m.id, { name: e.target.value })}
                                />
                              </TableCell>
                              <TableCell className="w-28 py-0">
                                <Input
                                  aria-label="Distance in km"
                                  type="number"
                                  className={`${FIELD_INPUT_MONO} w-24`}
                                  step={0.1}
                                  min={0}
                                  max={maxKm}
                                  value={m.dist}
                                  onChange={(e) => updateMarker(m.id, { dist: +e.target.value || 0 })}
                                />
                              </TableCell>
                              <TableCell className="w-44 py-0">
                                <Select
                                  items={ICONS}
                                  value={m.icon}
                                  onValueChange={(v) => updateMarker(m.id, { icon: v as MarkerIcon })}
                                >
                                  <SelectTrigger aria-label="Icon" className="h-11! w-40 px-3.5 text-[0.95rem]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ICONS.map((i) => (
                                      <SelectItem key={i.value} value={i.value}>
                                        {i.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="w-10 py-0 pr-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground"
                                  aria-label={`Remove ${m.name}`}
                                  onClick={() => setMarkers((ms) => ms.filter((x) => x.id !== m.id))}
                                >
                                  <IconX stroke={1.75} />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            </div>
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <IconLock aria-hidden="true" className="size-4" stroke={1.75} />
            Files are processed in your browser, never uploaded.
          </p>
        </>
      )}
    </main>
  );
}
