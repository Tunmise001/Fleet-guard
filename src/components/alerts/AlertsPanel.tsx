"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle, SlidersHorizontal } from "lucide-react";
import { useFleet } from "@/lib/fleetStore";
import { SeverityBadge, TypeBadge } from "@/components/ui/Badge";
import AlertDrawer from "./AlertDrawer";
import { format } from "date-fns";
import type { Alert, AlertSeverity } from "@/types/fleet";

/** First sentence of the report, with markup stripped — the cards show a
 *  two-line preview and raw ** / ## made it unreadable. */
function plainSummary(text: string): string {
  const body = text
    .replace(/^\s*#{1,6}[^*\n]*/, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return body.split(/(?<=\.)\s/)[0] ?? body;
}

export default function AlertsPanel() {
  const { alerts } = useFleet();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filter, setFilter] = useState<AlertSeverity | "all">("all");
  const [showResolved, setShowResolved] = useState(false);

  const filtered = alerts.filter((a) => {
    if (!showResolved && a.resolved) return false;
    if (filter !== "all" && a.severity !== filter) return false;
    return true;
  });

  const activeCount = alerts.filter((a) => !a.resolved).length;

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b border-border-base shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-danger/10 border border-danger/20 flex items-center justify-center">
            <AlertTriangle size={13} className="text-danger" />
          </div>
          <div>
            <span className="text-sm font-semibold text-fg">Alerts</span>
            {activeCount > 0 && (
              <span className="ml-2 text-[10px] font-bold bg-danger/20 text-danger border border-danger/30 px-2 py-0.5 rounded-full">
                {activeCount} active
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal size={12} className="text-fg-muted" aria-hidden />
          <select
            aria-label="Filter by severity"
            value={filter}
            onChange={(e) => setFilter(e.target.value as AlertSeverity | "all")}
            className="text-xs bg-surface-2 border border-border-base rounded-lg px-2.5 py-1.5 text-fg-muted transition-colors"
          >
            <option value="all">All severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            type="button"
            aria-pressed={showResolved}
            onClick={() => setShowResolved((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
              showResolved
                ? "bg-success/10 border-success/30 text-success"
                : "bg-surface-2 border-border-base text-fg-muted hover:text-fg"
            }`}
          >
            <CheckCircle size={11} />
            Resolved
          </button>
        </div>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-fg-muted">
            <div className="w-10 h-10 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mb-3">
              <CheckCircle size={18} className="text-success" />
            </div>
            <p className="text-sm text-fg-muted">No alerts matching filter</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filtered.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => setSelectedAlert(alert)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group ${
                  alert.resolved
                    ? "opacity-40 bg-surface-2/30 border-border-base/30 hover:opacity-60"
                    : alert.severity === "critical"
                    ? "bg-danger/5 border-danger/40 hover:border-danger/60 hover:bg-danger/10"
                    : alert.severity === "high"
                    ? "bg-warning/5 border-warning/40 hover:border-warning/60"
                    : "bg-surface-2/60 border-border-base hover:border-border-strong"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <SeverityBadge severity={alert.severity} />
                    <TypeBadge type={alert.type} />
                  </div>
                  <span className="text-[10px] text-fg-muted shrink-0 font-data">
                    {format(alert.timestamp, "d MMM yyyy, HH:mm")}
                  </span>
                </div>

                <p className="text-sm font-semibold text-fg mb-0.5 font-mono tracking-tight">
                  {alert.vehiclePlate}
                  <span className="text-fg-muted font-sans font-normal ml-2 text-xs">
                    {alert.driverName}
                  </span>
                </p>
                <p className="text-xs text-fg-muted line-clamp-2 leading-relaxed">
                  {plainSummary(alert.description)}
                </p>

                {alert.fuelLost !== undefined && !alert.resolved && (
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <div className="h-px flex-1 bg-danger/40" />
                    <p className="text-xs text-danger font-data font-semibold">
                      ₦{Math.round(alert.fuelLost * 1050).toLocaleString()} est. loss
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedAlert && (
        <AlertDrawer alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}
    </div>
  );
}