import { CsvReplaySource, type ReplayRow } from "./csvReplay";
import { LiveSource } from "./live";
import type { PositionSource } from "./types";

export type { PositionSource, PositionUpdate, SourceBatch } from "./types";
export { CsvReplaySource } from "./csvReplay";
export { LiveSource } from "./live";

/**
 * Multiplier against real time. Telemetry is now sampled every 30 seconds, so
 * 30x surfaces roughly one fix per vehicle per second — continuous movement
 * rather than the teleporting of the old sparse dataset.
 */
export const DEFAULT_REPLAY_SPEED = Number(process.env.NEXT_PUBLIC_REPLAY_SPEED ?? 30);

export function createPositionSource(rows: ReplayRow[]): PositionSource {
  if (process.env.NEXT_PUBLIC_POSITION_SOURCE === "live") {
    return new LiveSource(process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8080");
  }
  return new CsvReplaySource(rows, DEFAULT_REPLAY_SPEED);
}
