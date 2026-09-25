import type { AlertSeverity, AlertType } from "@/types/fleet";
import { SEVERITY } from "@/lib/status";
import { Fuel, Route, OctagonAlert, Gauge, Timer, type LucideIcon } from "lucide-react";

/** Emoji replaced with lucide icons — they render consistently and can be
 *  hidden from screen readers, which reads the adjacent text label instead. */
const TYPE: Record<AlertType, { label: string; icon: LucideIcon }> = {
  "fuel-theft": { label: "Fuel Theft", icon: Fuel },
  "route-deviation": { label: "Route Deviation", icon: Route },
  "unauthorized-stop": { label: "Unauth. Stop", icon: OctagonAlert },
  speeding: { label: "Speeding", icon: Gauge },
  "idle-excess": { label: "Idle Excess", icon: Timer },
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${SEVERITY[severity].badgeClass}`}
    >
      {SEVERITY[severity].label.toUpperCase()}
    </span>
  );
}

export function TypeBadge({ type }: { type: AlertType }) {
  const { label, icon: Icon } = TYPE[type];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-surface-3 text-fg-muted border border-border-base">
      <Icon size={11} aria-hidden />
      {label}
    </span>
  );
}
