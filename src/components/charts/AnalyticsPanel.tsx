"use client";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTheme } from "next-themes";
import { useFleet } from "@/lib/fleetStore";
import { palette, toMode } from "@/lib/theme";

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (active && payload?.length) {
    return (
      <div className="bg-surface border border-border-base rounded-lg p-3 text-xs shadow-lg">
        <p className="text-fg-muted mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function fuelText(pct: number) {
  if (pct < 20) return "text-danger";
  if (pct < 40) return "text-warning";
  return "text-success";
}
function fuelBar(pct: number) {
  if (pct < 20) return "bg-danger";
  if (pct < 40) return "bg-warning";
  return "bg-success";
}

export default function AnalyticsPanel() {
  const { vehicles, stats, fuelByHour, alertsByDay } = useFleet();
  const { resolvedTheme } = useTheme();
  const mode = toMode(resolvedTheme);
  const c = palette[mode];

  const vehicleFuelData = vehicles.map((v) => ({
    name: v.plateNumber.split("-")[1] ?? v.plateNumber,
    fuel: Math.round(v.currentFuel),
  }));

  const axisTick = { fill: c.chartAxis, fontSize: 10 };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6">
      <div>
        <h3 className="text-xs text-fg-muted uppercase tracking-wider mb-3">
          Average Fuel Level by Hour
        </h3>
        <div className="bg-surface-2 rounded-xl p-3">
          {fuelByHour.length === 0 ? (
            <p className="text-xs text-fg-muted py-8 text-center">No telemetry for this period.</p>
          ) : (
            // Keyed on mode so the SVG gradients are rebuilt on theme change —
            // gradient ids are document-global and would otherwise go stale.
            <ResponsiveContainer width="100%" height={180} key={mode}>
              <AreaChart data={fuelByHour}>
                <defs>
                  <linearGradient id={`fuelGrad-${mode}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c.accent} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={c.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                <XAxis dataKey="hour" tick={axisTick} />
                <YAxis tick={axisTick} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: c.fgMuted }} />
                <Area
                  type="monotone"
                  dataKey="avgFuel"
                  name="Avg fuel (%)"
                  stroke={c.accent}
                  strokeWidth={2}
                  fill={`url(#fuelGrad-${mode})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xs text-fg-muted uppercase tracking-wider mb-3">
          Anomalies by Day of Week
        </h3>
        <div className="bg-surface-2 rounded-xl p-3">
          {alertsByDay.length === 0 ? (
            <p className="text-xs text-fg-muted py-8 text-center">No anomalies detected.</p>
          ) : (
            <ResponsiveContainer width="100%" height={160} key={mode}>
              <BarChart data={alertsByDay} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                <XAxis dataKey="day" tick={axisTick} />
                <YAxis tick={axisTick} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: c.fgMuted }} />
                <Bar dataKey="critical" name="Critical" fill={c.danger} radius={[2, 2, 0, 0]} />
                <Bar dataKey="high" name="High" fill={c.warning} radius={[2, 2, 0, 0]} />
                <Bar dataKey="medium" name="Medium" fill={c.neutral} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xs text-fg-muted uppercase tracking-wider mb-3">Vehicle Fuel Levels</h3>
        <div className="space-y-2">
          {vehicleFuelData.length === 0 && (
            <p className="text-xs text-fg-muted">No vehicles in this dataset.</p>
          )}
          {vehicleFuelData.map((v) => (
            <div key={v.name} className="bg-surface-2 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono text-fg">{v.name}</span>
                <span className={`text-xs font-bold ${fuelText(v.fuel)}`}>{v.fuel}%</span>
              </div>
              <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${fuelBar(v.fuel)}`}
                  style={{ width: `${v.fuel}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-2 rounded-xl p-4">
        <h3 className="text-xs text-fg-muted uppercase tracking-wider mb-3">Financial Impact</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-fg-muted">Fuel theft losses</span>
            <span className="text-sm font-bold text-danger">
              ₦{stats.estimatedLossNaira.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-fg-muted">Suspected theft (L)</span>
            <span className="text-sm font-bold text-warning">{stats.fuelTheftLiters}L</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-fg-muted">Route compliance</span>
            <span className="text-sm font-bold text-accent">{stats.routeCompliancePercent}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-fg-muted">Avg fuel efficiency</span>
            <span className="text-sm font-bold text-fg">{stats.avgFuelEfficiency} km/L</span>
          </div>
        </div>
      </div>
    </div>
  );
}
