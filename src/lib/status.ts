import type { VehicleStatus, AlertSeverity } from "@/types/fleet";
import { palette, type Mode, type Palette } from "@/lib/theme";

/**
 * Single source of truth for status colour.
 *
 * Replaces three divergent copies that had genuinely drifted — `idle` was
 * #94a3b8 in FleetMap and #475569 in VehicleList, and VehiclePanel expressed
 * the same concept as Tailwind class names.
 */

type Token = "accent" | "neutral" | "danger" | "fgSubtle" | "warning" | "success";

export const STATUS: Record<
  VehicleStatus,
  { token: Token; label: string; dotClass: string; textClass: string }
> = {
  "on-route": { token: "accent", label: "On Route", dotClass: "bg-accent", textClass: "text-accent" },
  idle: { token: "neutral", label: "Idle", dotClass: "bg-neutral", textClass: "text-neutral" },
  alert: { token: "danger", label: "Alert", dotClass: "bg-danger", textClass: "text-danger" },
  offline: { token: "fgSubtle", label: "Offline", dotClass: "bg-fg-subtle", textClass: "text-fg-subtle" },
};

/**
 * Hex for canvas/WebGL consumers (MapLibre markers and line paint).
 * Class-based consumers should use `STATUS[s].dotClass` / `.textClass` —
 * those are literal strings because Tailwind v4 cannot scan a template.
 */
export function statusHex(status: VehicleStatus, mode: Mode): string {
  const token = STATUS[status].token;
  return palette[mode][token as keyof Palette];
}

export const SEVERITY: Record<AlertSeverity, { token: Token; label: string; badgeClass: string }> = {
  critical: {
    token: "danger",
    label: "Critical",
    badgeClass: "bg-danger/15 text-danger border border-danger/40",
  },
  high: {
    token: "warning",
    label: "High",
    badgeClass: "bg-warning/15 text-warning border border-warning/40",
  },
  medium: {
    token: "warning",
    label: "Medium",
    badgeClass: "bg-warning/10 text-warning border border-warning/25",
  },
  low: {
    token: "neutral",
    label: "Low",
    badgeClass: "bg-surface-3 text-fg-muted border border-border-base",
  },
};

export function severityHex(severity: AlertSeverity, mode: Mode): string {
  return palette[mode][SEVERITY[severity].token as keyof Palette];
}
