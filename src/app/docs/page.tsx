import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API Reference · GPX Elevation Profile",
  description:
    "HTTP API for generating race-style elevation profiles from a GPX file. POST /api/profile returns an SVG.",
};

/** Inline code token, styled like the snippets used on the landing page. */
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

/** A fenced code block with a monospace body and horizontal scroll. */
function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border bg-card p-4 font-mono text-[0.85rem] leading-relaxed text-foreground">
      {children}
    </pre>
  );
}

function Method() {
  return (
    <span className="inline-flex items-center rounded-md bg-primary px-2 py-0.5 font-mono text-xs font-semibold text-primary-foreground">
      POST
    </span>
  );
}

type Param = {
  name: string;
  type: string;
  required?: boolean;
  description: React.ReactNode;
};

function ParamTable({ rows }: { rows: Param[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-[0.95rem]">
        <thead>
          <tr className="border-b border-border bg-muted/60 text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Field</th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border last:border-0 align-top">
              <td className="whitespace-nowrap px-4 py-3">
                <code className="font-mono text-[0.85em] text-foreground">{r.name}</code>
                {r.required ? (
                  <span className="ml-2 text-xs font-medium text-primary">required</span>
                ) : (
                  <span className="ml-2 text-xs text-muted-foreground">optional</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-[0.85em] text-muted-foreground">
                {r.type}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-14 scroll-mt-20 text-2xl font-bold tracking-[-0.02em] text-foreground">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-8 text-lg font-semibold tracking-tight text-foreground">{children}</h3>
  );
}

const CHART_OPTIONS: Param[] = [
  { name: "color", type: "string", description: 'Hex chart colour, e.g. "#9ae600".' },
  { name: "width", type: "number", description: "Image width in px (min 600)." },
  { name: "height", type: "number", description: "Image height in px (min 200)." },
  { name: "lines", type: "number", description: "Number of stacked contour (ridgeline) lines." },
  { name: "shift", type: "number", description: "Horizontal shift between consecutive lines, in px." },
  {
    name: "strokeWidth",
    type: "number",
    description: "Stroke width of the top ridgeline in px (0.5–8); stacked contour lines scale with it.",
  },
  { name: "showGrid", type: "boolean", description: "Draw the background grid." },
  {
    name: "showAxes",
    type: "boolean",
    description: 'Draw the X and Y axes: lines, arrowheads, "Alt (m)"/"Dist (km)" captions and altitude tick labels.',
  },
  {
    name: "showKmLabels",
    type: "boolean",
    description: "Draw regular distance labels along the x-axis.",
  },
  {
    name: "showGradient",
    type: "boolean",
    description: "Soft gradient fill and shaded lines; off = flat lines in the picked colour.",
  },
  { name: 'background', type: '"white" | "transparent"', description: "Background fill of the SVG." },
];

const MARKER_FIELDS: Param[] = [
  { name: "id", type: "string", required: true, description: "Unique marker id." },
  { name: "name", type: "string", required: true, description: "Label shown at the marker." },
  { name: "dist", type: "number", required: true, description: "Position along the course, in km." },
  {
    name: "icon",
    type: '"none" | "food" | "water" | "flag" | "start" | "runner"',
    required: true,
    description: "Badge icon. A runner marks a position on the course rather than a fixed feature.",
  },
];

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
      <nav className="mb-10 text-sm">
        <Link
          href="/"
          className="font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          ← Back to the app
        </Link>
      </nav>

      <header>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm text-muted-foreground">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          API Reference
        </span>
        <h1 className="mt-4 mb-0 text-4xl font-bold tracking-[-0.03em] text-foreground sm:text-5xl">
          Profile API
        </h1>
        <p className="mt-5 mb-0 text-lg leading-relaxed text-muted-foreground">
          Generate a race-style elevation profile from a GPX file over HTTP. Send your GPX to{" "}
          <Code>POST /api/profile</Code> and get an <Code>image/svg+xml</Code> response back — the same
          rendering pipeline the web app uses.
        </p>
      </header>

      {/* Quick reference */}
      <section className="mt-10 flex flex-col gap-2.5 rounded-2xl bg-card p-5 ring-1 ring-border">
        <div className="flex items-center gap-3">
          <Method />
          <code className="font-mono text-[0.95rem] text-foreground">/api/profile</code>
          <span className="text-sm text-muted-foreground">Render a profile from your GPX</span>
        </div>
      </section>

      {/* POST */}
      <H2 id="post-profile">
        <span className="mr-2 align-middle">
          <Method />
        </span>
        /api/profile
      </H2>
      <p className="mt-4 text-muted-foreground">
        Renders an elevation profile and returns it as an SVG document. Two request shapes are accepted,
        selected by the <Code>Content-Type</Code> header.
      </p>

      <H3>JSON body</H3>
      <p className="mt-3 text-muted-foreground">
        Send <Code>Content-Type: application/json</Code> with a body containing your GPX plus optional
        styling. This is the only way to customise <Code>options</Code> and <Code>markers</Code>.
      </p>
      <ParamTable
        rows={[
          {
            name: "gpx",
            type: "string",
            required: true,
            description: "The raw GPX file contents as a non-empty string.",
          },
          {
            name: "options",
            type: "ChartOptions",
            description: (
              <>
                Partial style overrides. Any field omitted falls back to the default style. See{" "}
                <a href="#chart-options" className="underline underline-offset-2">
                  ChartOptions
                </a>
                .
              </>
            ),
          },
          {
            name: "markers",
            type: "Marker[]",
            description: (
              <>
                Course markers to draw. When omitted, no custom markers are added. See{" "}
                <a href="#marker" className="underline underline-offset-2">
                  Marker
                </a>
                .
              </>
            ),
          },
          { name: "format", type: '"svg"', description: "Reserved; SVG is currently the only output." },
        ]}
      />

      <H3>Raw GPX body</H3>
      <p className="mt-3 text-muted-foreground">
        Send <Code>Content-Type: application/gpx+xml</Code> (or any <Code>*/xml</Code>) with the raw file
        as the body. The profile is rendered at the default style; <Code>options</Code> and{" "}
        <Code>markers</Code> cannot be set this way.
      </p>

      <H3>Response</H3>
      <p className="mt-3 text-muted-foreground">
        On success: <Code>200 OK</Code> with <Code>Content-Type: image/svg+xml; charset=utf-8</Code> and
        the SVG as the body. A few computed stats are exposed as response headers so you don&apos;t have to
        parse the SVG:
      </p>
      <ParamTable
        rows={[
          {
            name: "x-profile-name",
            type: "header",
            description: "URL-encoded track name from the GPX.",
          },
          {
            name: "x-profile-distance-km",
            type: "header",
            description: "Total distance in km, to one decimal.",
          },
          { name: "x-profile-markers", type: "header", description: "Number of markers rendered." },
          {
            name: "x-ratelimit-limit",
            type: "header",
            description: "Max requests allowed in the current window.",
          },
          {
            name: "x-ratelimit-remaining",
            type: "header",
            description: "Requests remaining in the current window.",
          },
        ]}
      />

      <H3>Examples</H3>
      <p className="mt-3 mb-2 text-muted-foreground">Raw GPX, default style:</p>
      <Pre>{`curl -X POST https://gpx-profile.vercel.app/api/profile \\
  -H "Content-Type: application/gpx+xml" \\
  --data-binary @track.gpx \\
  -o profile.svg`}</Pre>

      <p className="mt-5 mb-2 text-muted-foreground">JSON body with custom style and markers:</p>
      <Pre>{`curl -X POST https://gpx-profile.vercel.app/api/profile \\
  -H "Content-Type: application/json" \\
  -o profile.svg \\
  -d '{
    "gpx": "<gpx>...</gpx>",
    "options": { "color": "#9ae600", "width": 1310, "height": 300, "showGradient": true },
    "markers": [
      { "id": "m1", "name": "Start",  "dist": 0,    "icon": "start" },
      { "id": "m2", "name": "Aid 1",  "dist": 42.5, "icon": "food"  },
      { "id": "m3", "name": "Finish", "dist": 90,   "icon": "flag"  }
    ]
  }'`}</Pre>

      <p className="mt-5 mb-2 text-muted-foreground">From JavaScript (reading GPX text in the browser):</p>
      <Pre>{`const gpx = await file.text();
const res = await fetch("/api/profile", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ gpx, options: { color: "#9ae600" } }),
});
if (!res.ok) throw new Error((await res.json()).error);
const svg = await res.text();`}</Pre>

      {/* Types */}
      <H2 id="chart-options">ChartOptions</H2>
      <p className="mt-4 text-muted-foreground">
        Passed as <Code>options</Code> in the JSON body. Every field is optional; omitted fields keep their
        default.
      </p>
      <div className="mt-4">
        <ParamTable rows={CHART_OPTIONS} />
      </div>

      <H2 id="marker">Marker</H2>
      <p className="mt-4 text-muted-foreground">
        Each entry in the <Code>markers</Code> array labels a point along the course.
      </p>
      <div className="mt-4">
        <ParamTable rows={MARKER_FIELDS} />
      </div>

      {/* Limits & errors */}
      <H2 id="limits">Limits &amp; rate limiting</H2>
      <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-muted-foreground marker:text-border">
        <li>
          Maximum GPX payload size is <strong className="font-semibold text-foreground">20 MB</strong>.
        </li>
        <li>
          Requests are rate limited per client IP to{" "}
          <strong className="font-semibold text-foreground">30 requests per minute</strong> (fixed window).
          The <Code>x-ratelimit-limit</Code> and <Code>x-ratelimit-remaining</Code> headers report the
          current budget; a <Code>429</Code> response includes a <Code>retry-after</Code> header.
        </li>
      </ul>

      <H2 id="errors">Error responses</H2>
      <p className="mt-4 text-muted-foreground">
        Errors are returned as JSON (<Code>Content-Type: application/json</Code>) with an{" "}
        <Code>error</Code> message and an appropriate status code.
      </p>
      <div className="mt-4">
        <ParamTable
          rows={[
            {
              name: "400",
              type: "Bad Request",
              description: "Missing/empty gpx field, or an unreadable/invalid JSON body.",
            },
            {
              name: "413",
              type: "Payload Too Large",
              description: "GPX body exceeds the 20 MB limit.",
            },
            {
              name: "415",
              type: "Unsupported Media Type",
              description: "Content-Type is neither application/json nor an XML/GPX type.",
            },
            {
              name: "422",
              type: "Unprocessable Entity",
              description: "The GPX could not be parsed or rendered (details in the error message).",
            },
            {
              name: "429",
              type: "Too Many Requests",
              description: "Rate limit exceeded; retry after the window resets.",
            },
          ]}
        />
      </div>
      <Pre>{`{ "error": "Request body must include a non-empty 'gpx' string." }`}</Pre>
    </main>
  );
}
