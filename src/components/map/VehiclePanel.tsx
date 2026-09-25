"use client";
import { X, Navigation, Fuel, Clock, Phone, MapPin, Radio } from "lucide-react";
import { useFleet } from "@/lib/fleetStore";
import { SeverityBadge } from "@/components/ui/Badge";
import { STATUS } from "@/lib/status";
import { format } from "date-fns";
import InsightText from "@/components/ui/InsightText";

function fuelClass(pct: number) {
  if (pct < 20) return "text-danger";
  if (pct < 40) return "text-warning";
  return "text-accent";
}
function fuelBar(pct: number) {
  if (pct < 20) return "bg-danger";
  if (pct < 40) return "bg-warning";
  return "bg-accent";
}

export default function VehiclePanel() {
  const { vehicles, selectedVehicle, setSelectedVehicle, alerts, replayClock } = useFleet();
  if (!selectedVehicle) return null;

  // selectedVehicle is a snapshot taken at click time; resolve it against the
  // live array so speed and fuel keep updating while the panel is open.
  const v = vehicles.find((x) => x.id === selectedVehicle.id) ?? selectedVehicle;

  const vehicleAlerts = alerts.filter((a) => a.vehicleId === v.id && !a.resolved);
  const status = STATUS[v.status];
  const fuel = Math.round(v.currentPosition.fuelLevel);

  // Age measured against the replay clock, i.e. in dataset time — the wall
  // clock would report "8 months ago" for every fix.
  const ageMin =
    v.lastFixAt && replayClock ? Math.max(0, Math.round((replayClock - v.lastFixAt) / 60000)) : null;
  const fixAge =
    ageMin === null
      ? "—"
      : ageMin < 1
        ? "just now"
        : ageMin < 60
          ? `${ageMin} min ago`
          : `${Math.floor(ageMin / 60)}h ${ageMin % 60}m ago`;

  return (
    // max-h + inner scroll: AI analysis text is unbounded and was running off
    // the bottom of the map with no way to read the rest.
    <div className="absolute top-4 right-4 w-72 max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] z-1000 animate-fade-up flex">
      <div className="bg-surface/95 backdrop-blur-xl border border-border-base rounded-2xl overflow-y-auto overscroll-contain shadow-lg w-full">
        <div className="h-px bg-linear-to-r from-transparent via-accent/40 to-transparent" aria-hidden />

        <div className="flex items-center justify-between px-4 py-3 border-b border-border-base">
          <div>
            <p className="font-mono font-bold text-fg text-sm tracking-wider">{v.plateNumber}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-xs font-medium ${status.textClass}`}>● {status.label}</span>
              <span className="text-fg-subtle">·</span>
              <span className="text-xs text-fg-muted capitalize">{v.vehicleType}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedVehicle(null)}
            aria-label="Close vehicle details"
            className="w-6 h-6 rounded-lg bg-surface-2 border border-border-base flex items-center justify-center text-fg-muted hover:text-fg hover:border-border-strong transition-colors"
          >
            <X size={12} aria-hidden />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-border-base flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-surface-2 border border-border-base flex items-center justify-center text-xs font-bold text-accent font-mono shrink-0">
            {v.driverName
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg truncate">{v.driverName}</p>
            <div className="flex items-center gap-1 text-[10px] text-fg-muted">
              <Phone size={9} aria-hidden />
              <span className="font-data">{v.driverPhone}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border-base border-b border-border-base">
          {[
            {
              icon: Navigation,
              label: "Speed",
              value: `${Math.round(v.currentPosition.speed)}`,
              unit: "km/h",
            },
            { icon: Clock, label: "Today", value: `${v.todayDistance}`, unit: "km" },
          ].map(({ icon: Icon, label, value, unit }) => (
            <div key={label} className="bg-surface px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={11} className="text-accent" aria-hidden />
                <span className="text-[10px] text-fg-muted uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-fg font-data font-bold text-lg leading-none">
                {value}
                <span className="text-xs text-fg-muted font-normal ml-1">{unit}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-b border-border-base">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Fuel size={11} className="text-warning" aria-hidden />
              <span className="text-[10px] text-fg-muted uppercase tracking-wider">Fuel Level</span>
            </div>
            <span className={`text-xs font-data font-bold ${fuelClass(fuel)}`}>{fuel}%</span>
          </div>
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden border border-border-base/50">
            <div
              className={`h-full rounded-full transition-all duration-700 ${fuelBar(fuel)}`}
              style={{ width: `${fuel}%` }}
            />
          </div>
        </div>

        <div className="px-4 py-2.5 flex items-center gap-1.5 border-b border-border-base">
          <MapPin size={10} className="text-fg-muted" aria-hidden />
          <span className="text-[10px] text-fg-muted">Zone:</span>
          <span className="text-[10px] text-fg">{v.assignedZone}</span>
        </div>

        {/* Fixes arrive a median 61 minutes apart in this dataset, so the age of
            the last one is real operational information, not decoration. */}
        <div className="px-4 py-2.5 flex items-center gap-1.5 border-b border-border-base">
          <Radio size={10} className="text-fg-muted" aria-hidden />
          <span className="text-[10px] text-fg-muted">Last fix:</span>
          <span className="text-[10px] text-fg font-data">{fixAge}</span>
        </div>

        {vehicleAlerts.length > 0 && (
          <div className="p-3 space-y-2">
            <p className="text-[10px] font-bold text-fg-muted uppercase tracking-[0.12em] px-1">
              Active Alerts
            </p>
            {vehicleAlerts.slice(0, 2).map((alert) => (
              <div key={alert.id} className="bg-danger/5 border border-danger/40 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <SeverityBadge severity={alert.severity} />
                  {/* Absolute time, not "over 1 year ago": these events are
                      dated within the recorded dataset, so a relative age
                      against today's wall clock says nothing useful. */}
                  <span className="text-[10px] text-fg-muted font-data">
                    {format(alert.timestamp, "d MMM yyyy, HH:mm")}
                  </span>
                </div>
                <InsightText text={alert.description} />
                {alert.fuelLost !== undefined && (
                  <p className="text-xs text-danger font-data font-semibold mt-2">
                    ₦{Math.round(alert.fuelLost * 1050).toLocaleString()} estimated loss
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="h-px bg-linear-to-r from-transparent via-accent/20 to-transparent" aria-hidden />
      </div>
    </div>
  );
}
