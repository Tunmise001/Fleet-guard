"use client";
import { LucideIcon } from "lucide-react";

type Variant = "default" | "danger" | "warning" | "success";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  variant?: Variant;
  pulse?: boolean;
}

/**
 * Variant classes are written out literally — Tailwind v4 scans source for
 * static strings, so `text-${token}` would produce no CSS at all.
 */
const VARIANT: Record<
  Variant,
  { border: string; iconBox: string; icon: string; value: string; sub: string; rule: string }
> = {
  default: {
    border: "border-border-base",
    iconBox: "bg-accent/10 border-accent/25",
    icon: "text-accent",
    value: "text-fg",
    sub: "text-fg-subtle",
    rule: "from-transparent via-accent/40 to-transparent",
  },
  danger: {
    border: "border-danger/40",
    iconBox: "bg-danger/10 border-danger/25",
    icon: "text-danger",
    value: "text-danger",
    sub: "text-danger/60",
    rule: "from-transparent via-danger/50 to-transparent",
  },
  warning: {
    border: "border-warning/40",
    iconBox: "bg-warning/10 border-warning/25",
    icon: "text-warning",
    value: "text-warning",
    sub: "text-warning/60",
    rule: "from-transparent via-warning/50 to-transparent",
  },
  success: {
    border: "border-success/40",
    iconBox: "bg-success/10 border-success/25",
    icon: "text-success",
    value: "text-success",
    sub: "text-success/60",
    rule: "from-transparent via-success/50 to-transparent",
  },
};

export default function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  variant = "default",
  pulse = false,
}: StatCardProps) {
  const v = VARIANT[variant];

  return (
    <div
      className={`panel relative overflow-hidden p-4 transition-colors duration-300 ${v.border}`}
    >
      {/* Top accent rule */}
      <div
        className={`absolute top-0 left-4 right-4 h-px bg-linear-to-r ${v.rule}`}
        aria-hidden
      />

      {pulse && (
        <span className="absolute top-3 right-3 flex h-2 w-2" aria-hidden>
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
        </span>
      )}

      <div
        className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-3 ${v.iconBox}`}
      >
        <Icon size={15} className={v.icon} aria-hidden />
      </div>

      <p className={`text-2xl font-bold tracking-tight leading-none font-data ${v.value}`}>
        {value}
      </p>

      <p className="text-xs mt-1.5 font-medium text-fg-muted">{label}</p>

      {sub && <p className={`text-xs mt-0.5 ${v.sub}`}>{sub}</p>}
    </div>
  );
}
