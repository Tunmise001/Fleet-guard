"use client";
import { useState } from "react";
import { Pause, Play, FastForward, Info, X } from "lucide-react";
import { useFleet } from "@/lib/fleetStore";
import { DEFAULT_REPLAY_SPEED } from "@/lib/sources";

/**
 * Real-time multipliers. Telemetry is sampled every 30s, so 30x is about one
 * fix per vehicle per second.
 */
const SPEEDS = [
  { label: "30×", value: DEFAULT_REPLAY_SPEED, title: "30x real time - about 1 fix per second" },
  { label: "60×", value: DEFAULT_REPLAY_SPEED * 2, title: "60x real time - about 2 fixes per second" },
  { label: "120×", value: DEFAULT_REPLAY_SPEED * 4, title: "120x real time - about 4 fixes per second" },
];

export default function ReplayControls() {
  const { replayClock, replaySpeed, setReplaySpeed, dataSource } = useFleet();
  const [showInfo, setShowInfo] = useState(false);

  const paused = replaySpeed === 0;
  const clockLabel = replayClock
    ? new Date(replayClock).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="relative flex items-center gap-2">
      <span className="hidden lg:inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-full bg-warning/10 text-warning border border-warning/30">
        Demo
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          aria-label="About this dataset"
          aria-expanded={showInfo}
          className="hover:opacity-70"
        >
          <Info size={10} aria-hidden />
        </button>
      </span>

      <div className="hidden lg:flex items-center gap-1">
        <button
          type="button"
          onClick={() => setReplaySpeed(paused ? DEFAULT_REPLAY_SPEED : 0)}
          aria-label={paused ? "Resume replay" : "Pause replay"}
          className="w-6 h-6 grid place-items-center rounded-md border border-border-base bg-surface-2 text-fg-muted hover:text-accent transition-colors"
        >
          {paused ? <Play size={11} aria-hidden /> : <Pause size={11} aria-hidden />}
        </button>

        {SPEEDS.map((s) => (
          <button
            key={s.label}
            type="button"
            title={s.title}
            onClick={() => setReplaySpeed(s.value)}
            aria-pressed={replaySpeed === s.value}
            aria-label={s.title}
            className={`px-1.5 h-6 rounded-md text-[10px] font-data border transition-colors ${
              replaySpeed === s.value
                ? "bg-accent/10 border-accent/30 text-accent"
                : "bg-surface-2 border-border-base text-fg-muted hover:text-fg"
            }`}
          >
            {s.label}
          </button>
        ))}

        <span
          className="ml-1 font-data text-[10px] text-fg-muted tabular-nums"
          title="Replay position in the recorded dataset"
        >
          <FastForward size={9} className="inline mr-1" aria-hidden />
          {clockLabel}
        </span>
      </div>

      {showInfo && (
        <div className="absolute top-8 right-0 z-50 w-72 panel p-3 text-xs text-fg-muted space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-fg">About this data</p>
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              aria-label="Close"
              className="text-fg-muted hover:text-fg"
            >
              <X size={12} aria-hidden />
            </button>
          </div>
          <p>
            <span className="text-fg">Source:</span>{" "}
            <code className="font-data">public/fleetguard_telemetry.csv</code> — 10 vehicles across
            Lagos, 6 trips each, 7,200 fixes sampled every 30 seconds. Every row is scored by the
            IsolationForest model, then replayed through a virtual clock.
          </p>
          <p>
            Routes follow real road geometry (OpenStreetMap via OSRM), so vehicles travel on actual
            streets. Positions, speed and fuel are read straight from the rows — nothing between
            fixes is interpolated.
          </p>
          <p>Overnight gaps between trips are skipped so the map keeps moving.</p>
          <p className="pt-1 border-t border-border-base">
            Scoring:{" "}
            {dataSource === "live" ? (
              <span className="text-success">live backend</span>
            ) : (
              <span className="text-warning">cached snapshot (backend unreachable)</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
