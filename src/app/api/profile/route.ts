import type { NextRequest } from "next/server";
import type { ChartOptions, Marker } from "@/lib/profile-svg";
import { checkRateLimit, sweep } from "@/lib/rate-limit";

/** Reject GPX payloads larger than this (matches the UI's 20 MB guidance). */
const MAX_GPX_BYTES = 20 * 1024 * 1024;

type Body = {
  gpx?: string;
  options?: Partial<ChartOptions>;
  markers?: Marker[];
  format?: "svg";
};

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "") || req.headers.get("x-real-ip") || "unknown";
}

function json(body: unknown, status: number, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  sweep();
  const rl = checkRateLimit(clientKey(req));
  const rlHeaders = {
    "x-ratelimit-limit": String(rl.limit),
    "x-ratelimit-remaining": String(rl.remaining),
  };
  if (!rl.ok) {
    return json({ error: "Rate limit exceeded. Try again later." }, 429, {
      ...rlHeaders,
      "retry-after": String(rl.retryAfter),
    });
  }

  const contentType = req.headers.get("content-type") ?? "";

  let gpx: string;
  let options: Partial<ChartOptions> | undefined;
  let markers: Marker[] | undefined;

  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as Body;
      if (typeof body.gpx !== "string" || body.gpx.trim() === "") {
        return json({ error: "Request body must include a non-empty 'gpx' string." }, 400, rlHeaders);
      }
      gpx = body.gpx;
      options = body.options;
      markers = body.markers;
    } else if (contentType.includes("xml") || contentType.includes("gpx")) {
      // Raw GPX body; style stays at defaults.
      gpx = await req.text();
    } else {
      return json(
        {
          error:
            "Unsupported Content-Type. Send application/json with a 'gpx' field, or application/gpx+xml with the raw file.",
        },
        415,
        rlHeaders,
      );
    }
  } catch {
    return json({ error: "Could not read request body (invalid JSON?)." }, 400, rlHeaders);
  }

  if (Buffer.byteLength(gpx, "utf8") > MAX_GPX_BYTES) {
    return json({ error: "GPX payload too large (max 20 MB)." }, 413, rlHeaders);
  }

  try {
    const { renderProfileSvg } = await import("@/lib/render-profile");
    const { svg, meta } = renderProfileSvg({ gpx, options, markers, embedFont: true });
    return new Response(svg, {
      status: 200,
      headers: {
        ...rlHeaders,
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "no-store",
        // Expose a few computed stats without needing to parse the SVG.
        "x-profile-name": encodeURIComponent(meta.name),
        "x-profile-distance-km": meta.totalDist.toFixed(1),
        "x-profile-markers": String(meta.markers),
      },
    });
  } catch (e) {
    // Parsing/validation errors from buildProfile are user-facing and safe.
    const message = e instanceof Error ? e.message : "Could not render the profile.";
    return json({ error: message }, 422, rlHeaders);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const sample = req.nextUrl.searchParams.get("sample");
  if (sample) {
    // Render the bundled sample at the default style, on the fly, through the
    // same pipeline as every other request. Cacheable so the landing page pays
    // the render cost at most once per revalidation window.
    try {
      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const { renderProfileSvg } = await import("@/lib/render-profile");
      const gpx = await readFile(join(process.cwd(), "public", "sample-diagonale-des-fous.gpx"), "utf8");
      // No embedded font: the landing shows this via <img>, where the fallback
      // stack renders, and skipping the font keeps the response small.
      const { svg } = renderProfileSvg({ gpx, embedFont: false });
      return new Response(svg, {
        status: 200,
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not render the sample.";
      return json({ error: message }, 500);
    }
  }

  return json(
    {
      service: "gpx-profile",
      endpoint: "POST /api/profile",
      body: "application/json { gpx: string, options?: ChartOptions, markers?: Marker[] } — or raw GPX with Content-Type application/gpx+xml",
      sample: "GET /api/profile?sample=1 renders the bundled sample as image/svg+xml",
      returns: "image/svg+xml",
    },
    200,
  );
}
