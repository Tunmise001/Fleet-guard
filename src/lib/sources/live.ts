import type { PositionSource, SourceBatch } from "./types";

/**
 * Real-time source — the production path.
 *
 * Not implemented yet: the backend has no positions endpoint (Path B is a
 * stateless CSV-per-request analyser with no persistence). This exists so the
 * seam is visible and swapping is a config change rather than a rewrite:
 * set NEXT_PUBLIC_POSITION_SOURCE=live once GET /api/v1/positions exists.
 */
export class LiveSource implements PositionSource {
  readonly kind = "live" as const;

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private backendUrl: string,
    private pollMs = 5000,
  ) {}

  start(onBatch: (b: SourceBatch) => void) {
    const poll = async () => {
      try {
        const res = await fetch(`${this.backendUrl}/api/v1/positions`);
        if (!res.ok) return;
        const data = await res.json();
        onBatch({ updates: data.positions ?? [], clock: Date.now(), snap: false });
      } catch {
        // Transient network failures are expected; the next tick retries.
      }
    };
    void poll();
    this.timer = setInterval(poll, this.pollMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
