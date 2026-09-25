"use client";
import { useFleet } from "@/lib/fleetStore";
import { Truck, Bike, Package, Wifi, WifiOff, ChevronRight } from "lucide-react";
import { STATUS } from "@/lib/status";
import type { Vehicle } from "@/types/fleet";

const vehicleIcon = { truck: Truck, van: Package, motorcycle: Bike };

/** Literal classes — Tailwind cannot scan a computed string. */
function fuelBarClass(pct: number) {
  if (pct < 20) return "bg-danger";
  if (pct < 40) return "bg-warning";
  return "bg-accent";
}

export default function VehicleList() {
  const { vehicles, selectedVehicle, setSelectedVehicle, setActiveTab, alerts } = useFleet();

  function handleSelect(v: Vehicle) {
    setSelectedVehicle(v);
    setActiveTab("map");
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-4 py-3 shrink-0 border-b border-border-base">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-fg-subtle">
          Fleet Vehicles
        </p>
        <p className="text-xs mt-0.5 text-fg-muted">
          {vehicles.filter((v) => v.status !== "offline").length} active
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {vehicles.length === 0 && (
          <p className="px-4 py-6 text-xs text-fg-muted text-center">No vehicles in this dataset.</p>
        )}

        {vehicles.map((v) => {
          const Icon = vehicleIcon[v.vehicleType];
          const activeAlerts = alerts.filter((a) => a.vehicleId === v.id && !a.resolved).length;
          const isSelected = selectedVehicle?.id === v.id;
          const fuelPct = Math.round(v.currentFuel);
          const isAlert = v.status === "alert";

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => handleSelect(v)}
              aria-pressed={isSelected}
              className={`group w-full text-left px-3 py-3 relative border-b border-border-base/50 border-l-2 transition-colors duration-200 hover:bg-surface-2 ${
                isSelected ? "border-l-accent bg-accent/5" : "border-l-transparent"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    isAlert
                      ? "bg-danger/10 border-danger/20"
                      : isSelected
                        ? "bg-accent/10 border-accent/20"
                        : "bg-surface-2 border-border-base"
                  }`}
                >
                  <Icon
                    size={14}
                    className={isAlert ? "text-danger" : isSelected ? "text-accent" : "text-fg-muted"}
                    aria-hidden
                  />
                  <span className="absolute -bottom-0.5 -right-0.5">
                    {v.status === "offline" ? (
                      <WifiOff size={8} className="text-fg-subtle" aria-hidden />
                    ) : (
                      <Wifi size={8} className="text-accent" aria-hidden />
                    )}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS[v.status].dotClass} ${
                        isAlert ? "animate-pulse" : ""
                      }`}
                      aria-hidden
                    />
                    <p className="text-xs font-mono font-semibold text-fg truncate leading-none">
                      {v.plateNumber}
                    </p>
                    <span className="sr-only">{STATUS[v.status].label}</span>
                  </div>
                  <p className="text-[10px] truncate text-fg-muted">{v.driverName}</p>
                </div>

                {activeAlerts > 0 ? (
                  <span
                    className="shrink-0 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center bg-danger/15 text-danger border border-danger/30"
                    aria-label={`${activeAlerts} unresolved alerts`}
                  >
                    {activeAlerts}
                  </span>
                ) : (
                  <ChevronRight size={12} className="shrink-0 text-fg-subtle" aria-hidden />
                )}
              </div>

              <div className="mt-2.5 flex items-center gap-2 pl-[42px]">
                <div className="flex-1 h-1 rounded-full overflow-hidden bg-surface-2 border border-border-base/50">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${fuelBarClass(fuelPct)}`}
                    style={{ width: `${fuelPct}%` }}
                  />
                </div>
                <span className="font-data text-[10px] shrink-0 w-10 text-right text-fg-muted">
                  {Math.round(v.currentPosition.speed)} km/h
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
