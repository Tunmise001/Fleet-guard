import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Server-side fleet analysis.
 *
 * Replaces a browser-side multipart POST straight to the backend, which took
 * ~112s against App Runner (vs 0.73s locally) behind a bare spinner — the
 * single worst thing about the demo. Doing it here means:
 *   · the browser↔backend leg and its CORS dependency disappear
 *   · the result is cached, so only the first caller pays
 *   · a slow or dead backend degrades to a checked-in snapshot instead of a
 *     red error screen mid-pitch
 *
 * Next 16 replaced `unstable_cache` with `use cache`, which needs
 * `cacheComponents: true` app-wide and cannot be used in a Route Handler body.
 * An explicit memo is smaller, predictable, and enough for a single dataset.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8080";
const CSV_NAME = "fleetguard_telemetry.csv";
const SNAPSHOT = "fleet-analysis.json";

const TTL_MS = 60 * 60 * 1000; // 1 hour
const BACKEND_TIMEOUT_MS = Number(process.env.FLEET_BACKEND_TIMEOUT_MS ?? 180_000);

type Payload = Record<string, unknown> & { source?: "live" | "snapshot" };

let cache: { at: number; body: Payload } | null = null;
let inFlight: Promise<Payload> | null = null;

async function readPublic(file: string) {
  return readFile(path.join(process.cwd(), "public", file));
}

async function fromBackend(): Promise<Payload> {
  const csv = await readPublic(CSV_NAME);

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(csv)], { type: "text/csv" }), CSV_NAME);

  const res = await fetch(`${BACKEND}/api/v1/analyze-fleet`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`Backend responded ${res.status}`);

  const data = (await res.json()) as Payload;
  if (!data || !Array.isArray(data.rows)) throw new Error("Backend response missing 'rows'");

  data.source = "live";
  return data;
}

async function fromSnapshot(): Promise<Payload> {
  const raw = await readPublic(SNAPSHOT);
  const data = JSON.parse(raw.toString("utf8")) as Payload;
  data.source = "snapshot";
  return data;
}

/** Kick off a live refresh without blocking the response. */
function refreshInBackground() {
  inFlight ??= fromBackend()
    .then((body) => {
      cache = { at: Date.now(), body };
      console.info("[api/fleet] live analysis cached");
      return body;
    })
    .catch((err) => {
      console.warn(
        `[api/fleet] live refresh failed (${err instanceof Error ? err.message : err}); snapshot stands`,
      );
      throw err;
    })
    .finally(() => {
      inFlight = null;
    });

  // Nothing awaits this path; swallow so it cannot raise unhandled rejections.
  void inFlight.catch(() => {});
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.body, {
      headers: { "x-fleet-cache": "hit", "x-fleet-source": String(cache.body.source) },
    });
  }

  // Stale-while-revalidate: answer instantly from the snapshot, then pull live
  // data in the background so the next caller gets it. The backend takes tens
  // of seconds; nobody should watch a spinner for that during a demo.
  refreshInBackground();

  try {
    const snapshot = await fromSnapshot();
    return NextResponse.json(snapshot, {
      headers: { "x-fleet-cache": "miss", "x-fleet-source": "snapshot" },
    });
  } catch (err) {
    // No snapshot on disk — fall back to waiting on the live call.
    try {
      const body = await inFlight;
      if (body) {
        return NextResponse.json(body, {
          headers: { "x-fleet-cache": "miss", "x-fleet-source": "live" },
        });
      }
    } catch {
      /* fall through */
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load fleet analysis" },
      { status: 503 },
    );
  }
}
