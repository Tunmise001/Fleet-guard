"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useFleet } from "@/lib/fleetStore";
import TopBar from "@/components/layout/TopBar";
import VehicleList from "@/components/layout/VehicleList";
import AlertsPanel from "@/components/alerts/AlertsPanel";
import AnalyticsPanel from "@/components/charts/AnalyticsPanel";
import StatCard from "@/components/ui/StatCard";
import VehiclePanel from "@/components/map/VehiclePanel";
import DebugPanel from "@/components/map/DebugPanel";
import {
  Truck,
  AlertTriangle,
  Fuel,
  TrendingDown,
  Shield,
  RefreshCw,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

const FleetMap = dynamic(() => import("@/components/map/FleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center rounded-xl bg-bg">
      <div className="text-center">
        <div className="w-8 h-8 border border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs tracking-wider text-fg-muted">Initialising map…</p>
      </div>
    </div>
  ),
});

function StatSkeleton() {
  return (
    <div className="panel p-4 animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-surface-3 mb-3" />
      <div className="h-6 w-20 rounded bg-surface-3" />
      <div className="h-3 w-24 rounded bg-surface-3 mt-2" />
    </div>
  );
}

export default function Dashboard() {
  const { stats, activeTab, isLoading, error, loadingStage, retry } = useFleet();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Skeleton of the real chrome rather than a bare spinner — the analysis
  // round trip can take a while and a lone spinner reads as "broken".
  if (isLoading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-bg">
        <div className="h-14 shrink-0 border-b border-border-base bg-surface/95" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 px-4 py-3 shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
        <div className="flex-1 px-4 pb-4">
          <div className="panel h-full flex items-center justify-center">
            <div className="text-center" role="status" aria-live="polite">
              <div className="w-8 h-8 border border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm tracking-wider text-fg-muted">{loadingStage}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg px-6">
        <div className="text-center max-w-sm" role="alert">
          <AlertTriangle className="w-10 h-10 text-danger mx-auto mb-3" aria-hidden />
          <p className="text-sm text-danger mb-1">Could not load fleet data</p>
          <p className="text-xs text-fg-muted mb-5 wrap-break-word">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
                       bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors"
          >
            <RefreshCw size={13} aria-hidden />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    // min-h-screen, not h-screen: the shell still fills the viewport, but when
    // content needs more room the document scrolls instead of clipping it.
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Background grid — near-invisible in light mode, where it would read as dirt */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <TopBar />

      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 px-3 sm:px-4 py-3 shrink-0">
        <StatCard
          label="Active Vehicles"
          value={`${stats.activeVehicles}/${stats.totalVehicles}`}
          icon={Truck}
        />
        <StatCard
          label="Alerts Today"
          value={stats.alertsToday}
          icon={AlertTriangle}
          variant="danger"
          pulse={stats.alertsToday > 0}
        />
        <StatCard
          label="Fuel Theft"
          value={`${stats.fuelTheftLiters}L`}
          icon={Fuel}
          variant="warning"
          sub="Suspected"
        />
        <StatCard
          label="Est. Loss"
          value={`₦${(stats.estimatedLossNaira / 1000).toFixed(0)}k`}
          icon={TrendingDown}
          variant="danger"
          sub="Across dataset"
        />
        <StatCard
          label="Route Compliance"
          value={`${stats.routeCompliancePercent}%`}
          icon={Shield}
          variant={stats.routeCompliancePercent > 85 ? "success" : "warning"}
          sub="Fleet average"
        />
      </div>

      {/* Main content — stacked on phones/tablets, side by side from lg up.
          `min-h-0` on the flex children is what lets their inner panes scroll
          instead of forcing the row to grow. */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 gap-2 px-3 sm:px-4 pb-4">
        {/* Vehicle list: collapsible sheet below lg, fixed rail from lg up */}
        <div
          className={`panel overflow-hidden shrink-0 order-2 lg:order-1 w-full lg:w-52 ${
            sheetOpen ? "h-64" : "h-11"
          } lg:h-auto transition-[height] duration-300`}
        >
          <button
            type="button"
            onClick={() => setSheetOpen((o) => !o)}
            aria-expanded={sheetOpen}
            className="lg:hidden w-full h-11 px-4 flex items-center justify-between text-xs font-medium text-fg-muted"
          >
            Fleet Vehicles
            {sheetOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronUp size={14} aria-hidden />}
          </button>
          <div
            className={`${sheetOpen ? "block" : "hidden"} lg:block h-[calc(100%-2.75rem)] lg:h-full`}
          >
            <VehicleList />
          </div>
        </div>

        {/* The map needs an explicit height when the page is in flow (stacked
            layout); from lg up it fills the remaining row height. */}
        {/* `flex-1` only from lg up. In a column flex container it sets
            flex-basis:0%, which overrides the explicit height and collapsed the
            map to nothing on phones and tablets. */}
        <div className="panel relative overflow-hidden order-1 lg:order-2 h-[60vh] min-h-[340px] lg:h-auto lg:min-h-0 lg:flex-1">
          {activeTab === "map" && (
            <div className="relative w-full h-full">
              <FleetMap />
              <VehiclePanel />
              <DebugPanel />
            </div>
          )}
          {activeTab === "alerts" && (
            <div className="h-full overflow-hidden animate-fade-up bg-surface">
              <AlertsPanel />
            </div>
          )}
          {activeTab === "analytics" && (
            <div className="h-full overflow-hidden animate-fade-up bg-surface">
              <AnalyticsPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
