"use client";
import { useEffect, useId, useRef, useState } from "react";
import { X, Brain, CheckCircle, MapPin, Clock, Fuel, TrendingDown, AlertOctagon } from "lucide-react";
import { useFleet } from "@/lib/fleetStore";
import { SeverityBadge, TypeBadge } from "@/components/ui/Badge";
import { format } from "date-fns";
import InsightText from "@/components/ui/InsightText";
import type { Alert } from "@/types/fleet";

interface AlertDrawerProps {
  alert: Alert;
  onClose: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const NAIRA_PER_LITRE = 1050;

export default function AlertDrawer({ alert, onClose }: AlertDrawerProps) {
  const { resolveAlert, vehicles } = useFleet();
  const [aiAnalysis, setAiAnalysis] = useState<string>(alert.aiAnalysis || "");
  const [aiError, setAiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const vehicle = vehicles.find((v) => v.id === alert.vehicleId);
  const historyCount = vehicle?.alerts.length ?? 0;

  // Escape to close, Tab cycles within the dialog, focus restored on unmount.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null,
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  async function fetchAIAnalysis() {
    setLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert, vehicleHistory: `${historyCount} alerts this month` }),
      });
      if (!res.ok) throw new Error(`Analysis service returned ${res.status}`);
      const data = await res.json();
      setAiAnalysis(data.analysis ?? "");
    } catch (err) {
      // Kept distinct from a successful analysis — the old version rendered the
      // failure message in the same style as a real result.
      setAiError(err instanceof Error ? err.message : "Could not reach the analysis service");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative panel rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
      >
        <div
          className={`sticky top-0 bg-surface p-5 border-b border-border-base flex items-start justify-between z-10 ${
            alert.resolved ? "opacity-60" : ""
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={alert.severity} />
              <TypeBadge type={alert.type} />
              {alert.resolved && (
                <span className="text-xs text-success bg-success/15 border border-success/30 px-2 py-0.5 rounded-full">
                  Resolved
                </span>
              )}
            </div>
            <h2 id={titleId} className="text-fg font-bold text-base">
              {alert.vehiclePlate} · {alert.driverName}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close alert details"
            className="text-fg-muted hover:text-fg transition-colors shrink-0"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-start gap-3">
            <AlertOctagon
              size={16}
              className={alert.severity === "critical" ? "text-danger" : "text-warning"}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <InsightText text={alert.description} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-2 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-fg-muted text-xs mb-1">
                <Clock size={11} aria-hidden />
                <span>Detected</span>
              </div>
              <p className="text-sm text-fg">
                {format(alert.timestamp, "d MMM yyyy, HH:mm")}
              </p>
            </div>
            <div className="bg-surface-2 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-fg-muted text-xs mb-1">
                <MapPin size={11} aria-hidden />
                <span>Location</span>
              </div>
              <p className="text-fg font-mono text-xs">
                {alert.location.lat.toFixed(4)}, {alert.location.lng.toFixed(4)}
              </p>
            </div>
            {alert.fuelLost !== undefined && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-danger text-xs mb-1">
                  <Fuel size={11} aria-hidden />
                  <span>Fuel Lost</span>
                </div>
                <p className="text-sm text-danger font-bold">{alert.fuelLost.toFixed(1)}L</p>
                <p className="text-xs text-danger/80">
                  ₦{Math.round(alert.fuelLost * NAIRA_PER_LITRE).toLocaleString()}
                </p>
              </div>
            )}
            {alert.deviationKm !== undefined && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-warning text-xs mb-1">
                  <TrendingDown size={11} aria-hidden />
                  <span>Deviation</span>
                </div>
                <p className="text-sm text-warning font-bold">{alert.deviationKm.toFixed(1)}km</p>
              </div>
            )}
            {alert.stopDurationMin !== undefined && (
              <div className="bg-surface-2 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-fg-muted text-xs mb-1">
                  <Clock size={11} aria-hidden />
                  <span>Stop duration</span>
                </div>
                <p className="text-sm text-fg font-bold">{Math.round(alert.stopDurationMin)} min</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-accent/30 bg-accent/5 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-accent/20">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-accent" aria-hidden />
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                  AI Analysis
                </span>
              </div>
              <button
                type="button"
                onClick={fetchAIAnalysis}
                disabled={loading}
                className="text-xs text-accent hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {loading ? "Analyzing…" : "Re-analyze"}
              </button>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="flex items-center gap-2 text-accent" role="status">
                  <div className="w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin" />
                  <span className="text-xs">Querying FleetGuard AI…</span>
                </div>
              ) : aiError ? (
                <div role="alert" className="space-y-2">
                  <p className="text-sm text-danger">{aiError}</p>
                  <button
                    type="button"
                    onClick={fetchAIAnalysis}
                    className="text-xs text-accent hover:opacity-80"
                  >
                    Try again
                  </button>
                </div>
              ) : aiAnalysis ? (
                <InsightText text={aiAnalysis} />
              ) : (
                <button
                  type="button"
                  onClick={fetchAIAnalysis}
                  className="w-full py-2 text-sm text-accent hover:opacity-80 transition-opacity"
                >
                  Generate AI analysis →
                </button>
              )}
            </div>
          </div>

          {!alert.resolved && (
            <button
              type="button"
              onClick={() => {
                resolveAlert(alert.id);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-success/10 border border-success/40 text-success hover:bg-success/20 transition-colors text-sm font-medium"
            >
              <CheckCircle size={16} aria-hidden />
              Mark as Resolved
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
