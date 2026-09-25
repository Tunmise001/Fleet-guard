/**
 * Refuel detection from telemetry.
 *
 * A tank level only rises when fuel goes in. So a sustained rise in
 * `fuel_level_pct` is a refuel event, and the question the wallet answers is
 * whether anybody paid for it: a refuel with no matching wallet transaction is
 * either an unlogged fill-up or fuel bought off-book.
 *
 * This is deliberately independent of the anomaly model. The model scores
 * *behaviour*; this reads a physical quantity. The dataset carries a `refuel`
 * ground-truth column so the detector can be validated rather than trusted —
 * see tests/refuel.test.mts.
 */

export interface FuelRow {
  vehicle_id: string;
  timestamp: string;
  lat: number;
  lng: number;
  fuel_level_pct: number;
}

export interface RefuelEvent {
  vehicleId: string;
  /** Epoch ms of the first fix in the rise. */
  startedAt: number;
  /** Epoch ms of the last fix in the rise. */
  endedAt: number;
  startPct: number;
  endPct: number;
  /** Percentage points added to the tank. */
  gainPct: number;
  /** Where the vehicle was when it finished filling. */
  lat: number;
  lng: number;
}

/**
 * A single fix can wobble by a fraction of a point on a real sensor, so a rise
 * only counts once it clears this. Tuned against the generated data, where a
 * genuine fill-up adds 7-11 points per 30s fix.
 */
const MIN_STEP_PCT = 0.4;

/** Total gain below this is sensor noise or tank slosh, not a fill-up. */
const MIN_EVENT_GAIN_PCT = 5;

/** A gap longer than this ends an event even if the level is still climbing. */
const MAX_GAP_MS = 15 * 60 * 1000;

function parseTs(ts: string): number {
  return new Date(ts.replace(" ", "T")).getTime();
}

/**
 * Groups consecutive rising fixes per vehicle into refuel events.
 * Rows need not be sorted; they are sorted per vehicle internally.
 */
export function detectRefuels(rows: FuelRow[]): RefuelEvent[] {
  const byVehicle = new Map<string, FuelRow[]>();
  for (const r of rows) {
    const list = byVehicle.get(r.vehicle_id);
    if (list) list.push(r);
    else byVehicle.set(r.vehicle_id, [r]);
  }

  const events: RefuelEvent[] = [];

  for (const [vehicleId, list] of byVehicle) {
    list.sort((a, b) => parseTs(a.timestamp) - parseTs(b.timestamp));

    let run: FuelRow[] = [];

    const flush = () => {
      if (run.length < 2) {
        run = [];
        return;
      }
      const first = run[0];
      const last = run[run.length - 1];
      const gain = last.fuel_level_pct - first.fuel_level_pct;
      if (gain >= MIN_EVENT_GAIN_PCT) {
        events.push({
          vehicleId,
          startedAt: parseTs(first.timestamp),
          endedAt: parseTs(last.timestamp),
          startPct: first.fuel_level_pct,
          endPct: last.fuel_level_pct,
          gainPct: Math.round(gain * 10) / 10,
          lat: last.lat,
          lng: last.lng,
        });
      }
      run = [];
    };

    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      const rising = cur.fuel_level_pct - prev.fuel_level_pct >= MIN_STEP_PCT;
      const contiguous = parseTs(cur.timestamp) - parseTs(prev.timestamp) <= MAX_GAP_MS;

      if (rising && contiguous) {
        // Seed the run with the fix *before* the first rise — that is the
        // level the tank actually started from.
        if (run.length === 0) run.push(prev);
        run.push(cur);
      } else {
        flush();
      }
    }
    flush();
  }

  return events.sort((a, b) => a.startedAt - b.startedAt);
}

/** Percentage points -> litres, given the vehicle's tank size. */
export function litresFor(gainPct: number, tankCapacityL: number): number {
  return Math.round(((gainPct / 100) * tankCapacityL) * 10) / 10;
}
