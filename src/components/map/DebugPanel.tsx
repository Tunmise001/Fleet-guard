"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useFleet } from "@/lib/fleetStore";

/**
 * Diagnostics overlay — open any page with `?debug` to show it.
 *
 * Traces the pipeline end to end so a wrong position can be attributed to a
 * specific stage rather than guessed at:
 *
 *   Python backend  →  store (vehicles[])  →  MapLibre marker DOM
 *
 * The "marker CSS" row exists because of a real bug: a `.veh-marker` rule set
 * `position: relative`, overriding MapLibre's `.maplibregl-marker { position:
 * absolute }`, which dropped every marker out of the map's coordinate space
 * and into normal document flow. Nothing in the data looked wrong — only the
 * computed style did.
 */
const subscribe = () => () => {};
const useDebugEnabled = () =>
  useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).has("debug"),
    () => false,
  );

interface MarkerProbe {
  count: number;
  position: string;
  sample: string;
}

export default function DebugPanel() {
  const enabled = useDebugEnabled();
  const { vehicles, dataSource, replayClock, replaySpeed, alerts } = useFleet();
  const [probe, setProbe] = useState<MarkerProbe | null>(null);

  // Inspect the live DOM rather than trusting what we think we rendered.
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const els = document.querySelectorAll<HTMLElement>(".veh-marker");
      const first = els[0];
      setProbe({
        count: els.length,
        position: first ? getComputedStyle(first).position : "—",
        sample: first ? (first.style.transform || "(no transform)") : "—",
      });
    }, 1000);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  const lats = vehicles.map((v) => v.currentPosition.lat);
  const lngs = vehicles.map((v) => v.currentPosition.lng);
  const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(4) : "—");

  const positionOk = probe?.position === "absolute";

  return (
    <div className="absolute bottom-4 right-4 z-1000 w-[22rem] max-h-[70%] overflow-auto panel p-3 text-[11px] font-data space-y-2">
      <p className="font-semibold text-fg text-xs">Diagnostics</p>

      <div className="space-y-1">
        <Row label="Analysis source" value={dataSource} />
        <Row label="Vehicles in store" value={String(vehicles.length)} />
        <Row label="Alerts" value={String(alerts.length)} />
        <Row
          label="Store lat range"
          value={vehicles.length ? `${fmt(Math.min(...lats))} .. ${fmt(Math.max(...lats))}` : "—"}
        />
        <Row
          label="Store lng range"
          value={vehicles.length ? `${fmt(Math.min(...lngs))} .. ${fmt(Math.max(...lngs))}` : "—"}
        />
        <Row
          label="Replay clock"
          value={replayClock ? new Date(replayClock).toISOString().slice(0, 16).replace("T", " ") : "—"}
        />
        <Row label="Replay speed" value={`${replaySpeed}× real time`} />
      </div>

      <div className="pt-2 border-t border-border-base space-y-1">
        <p className="text-fg-muted">Marker DOM</p>
        <Row label="Elements" value={String(probe?.count ?? 0)} />
        <Row
          label="computed position"
          value={probe?.position ?? "—"}
          bad={probe != null && !positionOk}
        />
        {probe && !positionOk && (
          <p className="text-danger leading-snug">
            Must be <code>absolute</code>. Anything else takes markers out of the map&apos;s
            coordinate space — they stack in document flow and ignore pan/zoom.
          </p>
        )}
        <Row label="transform" value={probe?.sample ?? "—"} />
      </div>

      <div className="pt-2 border-t border-border-base space-y-1">
        <p className="text-fg-muted">Per vehicle (store → map)</p>
        {vehicles.slice(0, 6).map((v) => (
          <div key={v.id} className="flex justify-between gap-2">
            <span className="text-fg-muted shrink-0">{v.plateNumber}</span>
            <span className="text-fg truncate">
              {fmt(v.currentPosition.lat)}, {fmt(v.currentPosition.lng)}
            </span>
          </div>
        ))}
        {vehicles.length > 6 && <p className="text-fg-subtle">+{vehicles.length - 6} more</p>}
      </div>
    </div>
  );
}

function Row({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-fg-muted shrink-0">{label}</span>
      <span className={`truncate ${bad ? "text-danger font-bold" : "text-fg"}`}>{value}</span>
    </div>
  );
}
