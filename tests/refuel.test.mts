import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { detectRefuels, litresFor, type FuelRow } from "../src/lib/refuel.ts";

/** Parse the real generated telemetry, including its `refuel` ground truth. */
function loadCsv() {
  const text = readFileSync("public/fleetguard_telemetry.csv", "utf8").trim();
  const [head, ...lines] = text.split(/\r?\n/);
  const cols = head.split(",");
  return lines.map((l) => {
    const c = l.split(",");
    const o: Record<string, string> = {};
    cols.forEach((k, i) => (o[k] = c[i]));
    return {
      vehicle_id: o.vehicle_id,
      timestamp: o.timestamp,
      lat: Number(o.lat),
      lng: Number(o.lng),
      fuel_level_pct: Number(o.fuel_level_pct),
      refuel: Number(o.refuel ?? 0),
    };
  });
}

const rows = loadCsv();

/** Ground-truth events: contiguous runs where refuel === 1, per vehicle. */
function truthEvents(rs: ReturnType<typeof loadCsv>) {
  const out: { vehicleId: string; startedAt: number; endedAt: number }[] = [];
  const by = new Map<string, typeof rs>();
  for (const r of rs) (by.get(r.vehicle_id) ?? by.set(r.vehicle_id, []).get(r.vehicle_id)!).push(r);
  for (const [vid, list] of by) {
    list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    let run: typeof list = [];
    const flush = () => {
      if (run.length) {
        out.push({
          vehicleId: vid,
          startedAt: new Date(run[0].timestamp.replace(" ", "T")).getTime(),
          endedAt: new Date(run.at(-1)!.timestamp.replace(" ", "T")).getTime(),
        });
        run = [];
      }
    };
    for (const r of list) (r.refuel === 1 ? run.push(r) : flush());
    flush();
  }
  return out;
}

const truth = truthEvents(rows);
const detected = detectRefuels(rows as FuelRow[]);

test("the dataset actually contains refuels to find", () => {
  assert.ok(truth.length > 0, "no ground-truth refuel events in the CSV");
});

test("detects every real refuel, with no false positives", () => {
  assert.equal(detected.length, truth.length,
    `detected ${detected.length}, ground truth ${truth.length}`);

  // Each detected event must overlap a ground-truth event for the same vehicle.
  for (const d of detected) {
    const match = truth.find(
      (t) => t.vehicleId === d.vehicleId &&
             d.endedAt >= t.startedAt - 60_000 &&
             d.startedAt <= t.endedAt + 60_000,
    );
    assert.ok(match, `detected event at ${new Date(d.startedAt).toISOString()} for ${d.vehicleId} matches no real refuel`);
  }
});

test("gains are physically sensible", () => {
  for (const d of detected) {
    assert.ok(d.gainPct >= 5, `gain too small: ${d.gainPct}`);
    assert.ok(d.endPct <= 100.001, `tank over 100%: ${d.endPct}`);
    assert.ok(d.endPct > d.startPct);
  }
});

test("does not fire on ordinary driving", () => {
  // Take each vehicle's fixes BEFORE its first refuel. Filtering refuel rows
  // out instead would splice the pre- and post-fill levels together and
  // manufacture the exact discontinuity under test.
  const cutoff = new Map<string, number>();
  for (const t of truth) {
    const prev = cutoff.get(t.vehicleId);
    if (prev === undefined || t.startedAt < prev) cutoff.set(t.vehicleId, t.startedAt);
  }
  const consumption = rows.filter((r) => {
    const c = cutoff.get(r.vehicle_id);
    return c === undefined || new Date(r.timestamp.replace(" ", "T")).getTime() < c;
  }) as FuelRow[];

  assert.ok(consumption.length > 1000, "not enough pre-refuel data to be meaningful");
  assert.equal(detectRefuels(consumption).length, 0);
});

test("litres conversion", () => {
  assert.equal(litresFor(50, 100), 50);
  assert.equal(litresFor(62.5, 80), 50);
});
