/**
 * Minimal, dependency-free analytics shim.
 *
 * Events are pushed to `window.dataLayer` (GTM-style) when present, and mirrored
 * to the console in development. Swap the sink here if a real provider is added
 * later — callers only use the typed `track` function below.
 */

export type AnalyticsEvent =
  | "example_clicked"
  | "example_loaded"
  | "example_error"
  | "example_style_changed"
  | "example_exported"
  | "upload_after_example";

type Props = Record<string, string | number | boolean | undefined>;

export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (typeof window === "undefined") return;
  const payload = { event, ...props };

  const w = window as typeof window & { dataLayer?: unknown[] };
  w.dataLayer?.push(payload);

  if (process.env.NODE_ENV !== "production") {
    console.debug("[analytics]", payload);
  }
}
