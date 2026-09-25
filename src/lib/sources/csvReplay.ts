import type { PositionSource, PositionUpdate, SourceBatch } from "./types";

export interface ReplayRow {
  vehicle_id: string;
  timestamp: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  fuel_level_pct: number;
}

const TICK_MS = 1000;

/** Dataset time with no fixes due; beyond this the clock skips ahead.
 *  Vehicles park overnight between trips — truthful, but 23 hours of an empty
 *  map is not a demo. */
const IDLE_SKIP_MS = 5 * 60 * 1000;

export function parseTimestamp(ts: string): number {
  // Backend emits "YYYY-MM-DD HH:MM:SS" (no zone); treat as local time.
  return new Date(ts.replace(" ", "T")).getTime();
}

/**
 * Replays the real recorded telemetry through a virtual clock.
 *
 * Telemetry is sampled every 30 seconds along real Lagos roads (OSRM geometry;
 * see ml/src/generate/roads.py), so consecutive fixes are a median 187 m apart
 * and the motion is genuinely continuous. Positions are read straight from the
 * rows — nothing between fixes is invented.
 */
export class CsvReplaySource implements PositionSource {
  readonly kind = "replay" as const;

  private byVehicle = new Map<string, ReplayRow[]>();
  private cursor = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private onBatch: ((b: SourceBatch) => void) | null = null;

  private t0 = 0;
  private tEnd = 0;
  private clock = 0;
  private speed: number;

  constructor(rows: ReplayRow[], speedMultiplier: number) {
    this.speed = speedMultiplier;

    for (const r of rows) {
      const list = this.byVehicle.get(r.vehicle_id);
      if (list) list.push(r);
      else this.byVehicle.set(r.vehicle_id, [r]);
    }

    let min = Infinity;
    let max = -Infinity;
    for (const [id, list] of this.byVehicle) {
      list.sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
      this.cursor.set(id, 0);
      min = Math.min(min, parseTimestamp(list[0].timestamp));
      max = Math.max(max, parseTimestamp(list[list.length - 1].timestamp));
    }

    this.t0 = Number.isFinite(min) ? min : 0;
    this.tEnd = Number.isFinite(max) ? max : 0;
    this.clock = this.t0;
  }

  /** Dataset span, for honest labelling in the UI. */
  get range() {
    return { from: this.t0, to: this.tEnd };
  }

  setSpeed(multiplier: number) {
    this.speed = multiplier;
  }

  start(onBatch: (b: SourceBatch) => void) {
    this.onBatch = onBatch;
    this.stop();
    this.emit(true); // paint the first fix immediately
    this.timer = setInterval(() => this.advance(), TICK_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Earliest fix strictly after `t`, across all vehicles. */
  private nextFixAfter(t: number): number | null {
    let best: number | null = null;
    for (const [id, list] of this.byVehicle) {
      let i = this.cursor.get(id) ?? 0;
      while (i < list.length && parseTimestamp(list[i].timestamp) <= t) i++;
      if (i < list.length) {
        const ts = parseTimestamp(list[i].timestamp);
        if (best === null || ts < best) best = ts;
      }
    }
    return best;
  }

  private advance() {
    if (this.speed <= 0) return; // paused

    this.clock += TICK_MS * this.speed;

    let snap = false;
    if (this.clock > this.tEnd) {
      // Loop so the demo never runs dry.
      this.clock = this.t0;
      for (const id of this.cursor.keys()) this.cursor.set(id, 0);
      snap = true;
    } else {
      // Trips are separated by overnight gaps — real, but dead air on screen.
      // If nothing is due for a while, jump the clock to the next fix.
      const next = this.nextFixAfter(this.clock);
      if (next !== null && next - this.clock > IDLE_SKIP_MS) {
        this.clock = next;
        snap = true;
      }
    }
    this.emit(snap);
  }

  private emit(snap: boolean) {
    if (!this.onBatch) return;

    const updates: PositionUpdate[] = [];

    for (const [id, list] of this.byVehicle) {
      let i = this.cursor.get(id) ?? 0;
      let moved = false;

      // Advance to the last fix at or before the clock.
      while (i + 1 < list.length && parseTimestamp(list[i + 1].timestamp) <= this.clock) {
        i++;
        moved = true;
      }
      this.cursor.set(id, i);

      if (!moved && !snap) continue;

      const r = list[i];
      updates.push({
        vehicleId: id,
        lat: r.lat,
        lng: r.lng,
        speedKmh: r.speed_kmh,
        fuelPct: r.fuel_level_pct,
        timestamp: parseTimestamp(r.timestamp),
      });
    }

    if (updates.length > 0 || snap) {
      this.onBatch({ updates, clock: this.clock, snap });
    }
  }
}
