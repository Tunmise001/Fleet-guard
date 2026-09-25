/**
 * A position source feeds vehicle locations into the fleet store.
 *
 * It emits POSITIONS ONLY, deliberately. Vehicle `status` is the anomaly
 * model's output; an earlier client-side simulator overwrote it on every tick
 * ("speed > 3 ? on-route : status"), silently erasing the ML result. Keeping
 * status out of this type makes that class of bug unrepresentable.
 */
export interface PositionUpdate {
  vehicleId: string;
  lat: number;
  lng: number;
  speedKmh: number;
  fuelPct: number;
  /** Epoch ms of the fix itself, from the telemetry — not wall-clock now. */
  timestamp: number;
}

export interface SourceBatch {
  updates: PositionUpdate[];
  /** Virtual clock position, epoch ms. */
  clock: number;
  /** True when the cursor jumped (replay looped or seeked) — consumers should
   *  snap rather than animate, or they draw a line across the city. */
  snap: boolean;
}

export interface PositionSource {
  readonly kind: "replay" | "live";
  start(onBatch: (batch: SourceBatch) => void): void;
  stop(): void;
  /** Replay only. 0 pauses. */
  setSpeed?(multiplier: number): void;
}
