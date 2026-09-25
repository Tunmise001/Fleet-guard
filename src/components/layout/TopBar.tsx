"use client";
import { Map, Bell, BarChart3, Truck, Radio, ExternalLink } from "lucide-react";
import { useFleet } from "@/lib/fleetStore";
import ThemeToggle from "@/components/ui/ThemeToggle";
import ReplayControls from "@/components/ui/ReplayControls";
import Link from "next/link";

export default function TopBar() {
  const { stats, activeTab, setActiveTab, alerts } = useFleet();
  const activeAlerts = alerts.filter((a) => !a.resolved).length;

  const tabs = [
    { id: "map" as const, label: "Live Map", icon: Map },
    { id: "alerts" as const, label: "Alerts", icon: Bell, badge: activeAlerts },
    { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
  ];

  return (
    <header className="min-h-14 shrink-0 flex flex-wrap items-center justify-between gap-y-2 px-3 sm:px-5 py-2 relative z-10 bg-surface/95 border-b border-border-base backdrop-blur-md">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="relative w-8 h-8 rounded-lg flex items-center justify-center bg-accent/10 border border-accent/20">
          <Truck size={15} className="text-accent" aria-hidden />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-success border-2 border-surface" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-fg tracking-tight leading-none">FleetGuard</h1>
          <div className="flex items-center gap-1 mt-0.5">
            <Radio size={8} className="text-success pulse-dot" aria-hidden />
            <span className="text-[10px] font-medium tracking-widest uppercase text-success">
              Live
            </span>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <nav
        role="tablist"
        aria-label="Dashboard views"
        className="flex items-center gap-1 p-1 rounded-xl bg-bg/70 border border-border-base"
      >
        {tabs.map(({ id, label, icon: Icon, badge }) => {
          const selected = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-200 ${
                selected
                  ? "bg-accent/10 border-accent/25 text-accent"
                  : "bg-transparent border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              <Icon size={13} aria-hidden />
              <span className="hidden sm:inline">{label}</span>
              {badge !== undefined && badge > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 text-[10px] rounded-full flex items-center justify-center font-bold px-1 bg-danger text-white"
                  aria-label={`${badge} unresolved`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <ReplayControls />

        <div className="hidden md:flex items-center gap-4 text-xs" aria-live="polite">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent pulse-dot" aria-hidden />
            <span className="font-data text-fg-muted">
              {stats.activeVehicles}/{stats.totalVehicles}{" "}
              <span className="text-fg-subtle">active</span>
            </span>
          </div>
          {activeAlerts > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" aria-hidden />
              <span className="font-data font-medium text-danger">{activeAlerts} alerts</span>
            </div>
          )}
          <span className="font-data text-fg-muted">
            ₦{(stats.estimatedLossNaira / 1000).toFixed(0)}k{" "}
            <span className="text-fg-subtle">flagged</span>
          </span>
        </div>

        <div className="w-px h-5 bg-border-base" aria-hidden />

        <Link
          href="/analyze"
          className="flex items-center gap-1.5 text-xs font-medium text-fg-muted hover:text-accent transition-colors"
        >
          <span className="hidden sm:inline">Analyze Logs</span>
          <ExternalLink size={11} aria-hidden />
        </Link>

        <ThemeToggle />
      </div>
    </header>
  );
}
