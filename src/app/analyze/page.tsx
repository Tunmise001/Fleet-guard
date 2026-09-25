"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload, FileText, AlertTriangle, CheckCircle,
  TrendingDown, Fuel, Route, Clock, ChevronDown, ChevronUp,
  BarChart2, ArrowLeft, Loader2, Truck, Brain,
} from "lucide-react";
import Link from "next/link";

interface ScoredRow {
  trip_id?: string;
  vehicle_id?: string;
  driver_id?: string;
  anomaly_score: number;
  is_anomaly: boolean | number;
  anomaly_type?: string;
  fuel_consumed?: number;
  distance_km?: number;
  idle_minutes?: number;
  [key: string]: unknown;
}

interface AnalyzeResponse {
  total_records: number;
  anomalies_detected: number;
  anomaly_rate: number;
  top_anomalies: ScoredRow[];
  summary: {
    fuel_theft_suspected: number;
    route_deviations: number;
    excessive_idle: number;
    estimated_loss_naira: number;
  };
  ai_insight?: string;
}

const BACKEND_HOST_OF = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8080";
const BACKEND_HOST = BACKEND_HOST_OF(BACKEND);

function scoreColor(score: number) {
  if (score > 0.7) return { text: "text-danger", bar: "bg-danger", bg: "bg-danger/5 border-danger/40" };
  if (score > 0.4) return { text: "text-warning", bar: "bg-warning", bg: "bg-warning/5 border-warning/40" };
  return { text: "text-success", bar: "bg-success", bg: "bg-success/5 border-success/40" };
}

function SummaryCard({ label, value, sub, icon: Icon, variant = "default" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; variant?: "default" | "danger" | "warning" | "success";
}) {
  const cfg = {
    default: { bg: "bg-surface border-border-base", icon: "text-accent bg-accent/10 border-accent/20", value: "text-fg", accent: "via-accent/30" },
    danger:  { bg: "bg-surface border-danger/40", icon: "text-danger bg-danger/10 border-danger/20", value: "text-danger", accent: "via-danger/30" },
    warning: { bg: "bg-surface border-warning/40", icon: "text-warning bg-warning/10 border-warning/20", value: "text-warning", accent: "via-warning/30" },
    success: { bg: "bg-surface border-success/40", icon: "text-success bg-success/10 border-success/20", value: "text-success", accent: "via-success/30" },
  }[variant];

  return (
    <div className={`relative rounded-xl border p-5 overflow-hidden ${cfg.bg}`}>
      <div className={`absolute top-0 left-4 right-4 h-px bg-linear-to-r from-transparent ${cfg.accent} to-transparent`} />
      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-3 ${cfg.icon}`}>
        <Icon size={15} />
      </div>
      <p className={`text-2xl font-bold font-data leading-none ${cfg.value}`}>{value}</p>
      <p className="text-xs text-fg-muted mt-1.5 font-medium">{label}</p>
      {sub && <p className="text-[10px] text-fg-subtle mt-0.5">{sub}</p>}
    </div>
  );
}

function AnomalyRow({ row, idx }: { row: ScoredRow; idx: number }) {
  const [open, setOpen] = useState(false);
  const score = row.anomaly_score ?? 0;
  const c = scoreColor(score);
  const plate = row.vehicle_id ?? row.trip_id ?? `Row ${idx + 1}`;
  const driver = row.driver_id ?? "—";
  const type = row.anomaly_type ?? (row.is_anomaly ? "Anomaly" : "Normal");
  const pct = Math.round(score * 100);

  const extraFields = Object.entries(row).filter(
    ([k]) => !["anomaly_score","is_anomaly","anomaly_type","vehicle_id","trip_id","driver_id"].includes(k)
  );

  return (
    <div className={`border rounded-xl overflow-hidden ${c.bg} transition-all duration-200`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-white/3 transition-colors"
      >
        <span className="text-[10px] text-fg-subtle font-data w-5 shrink-0">{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-fg truncate leading-none">{plate}</p>
          <p className="text-[10px] text-fg-muted mt-0.5">{driver} · <span className="text-fg-muted">{type}</span></p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-20 h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
          </div>
          <span className={`text-xs font-data font-bold w-8 text-right ${c.text}`}>{pct}%</span>
        </div>
        {open
          ? <ChevronUp size={13} className="text-fg-muted shrink-0" />
          : <ChevronDown size={13} className="text-fg-muted shrink-0" />
        }
      </button>

      {open && extraFields.length > 0 && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-border-base/40">
          {extraFields.map(([k, v]) => (
            <div key={k} className="bg-surface-2/60 rounded-lg p-2.5">
              <p className="text-[9px] text-fg-muted uppercase tracking-wider mb-0.5 capitalize">
                {k.replace(/_/g, " ")}
              </p>
              <p className="text-xs text-fg font-data font-medium truncate">{String(v ?? "—")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnalyzePage() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [health, setHealth] = useState<"checking" | "up" | "down">("checking");

  // The status dot used to be hardcoded green (and named the wrong port for the
  // deployed backend). Check it for real.
  useEffect(() => {
    const ac = new AbortController();
    fetch(`${BACKEND}/api/v1/healthz`, { signal: ac.signal })
      .then((r) => setHealth(r.ok ? "up" : "down"))
      .catch(() => setHealth("down"));
    return () => ac.abort();
  }, []);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".csv")) { setError("Please upload a .csv file."); return; }
    setFile(f); setError(null); setResult(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  async function analyze() {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BACKEND}/api/v1/analyze-fleet`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.text()) || `Server error ${res.status}`);
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not reach the backend at ${BACKEND_HOST}.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-fg relative">
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      {/* Nav */}
      <header className="relative z-10 min-h-14 border-b border-border-base bg-surface/90 backdrop-blur-xl flex flex-wrap items-center justify-between gap-y-2 px-4 sm:px-6 py-2">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-fg-muted hover:text-fg transition-colors text-xs font-medium"
          >
            <ArrowLeft size={13} />
            Live Monitor
          </Link>
          <div className="w-px h-4 bg-border-base" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <BarChart2 size={12} className="text-accent" />
            </div>
            <span className="text-sm font-semibold text-fg">Analyze Logs</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              health === "up"
                ? "bg-success pulse-dot"
                : health === "down"
                  ? "bg-danger"
                  : "bg-warning animate-pulse"
            }`}
            aria-hidden
          />
          <span className="text-[10px] text-fg-muted font-medium" aria-live="polite">
            {health === "up"
              ? `Backend connected · ${BACKEND_HOST}`
              : health === "down"
                ? `Backend unreachable · ${BACKEND_HOST}`
                : "Checking backend…"}
          </span>
        </div>
      </header>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Page title */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Truck size={14} className="text-accent" />
            <span className="text-[10px] text-accent font-bold uppercase tracking-[0.2em]">FleetGuard ML</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-fg tracking-tight">Fleet Log Analysis</h1>
          <p className="text-fg-muted text-sm mt-1.5 leading-relaxed">
            Upload a trip telemetry CSV. An unsupervised IsolationForest scores every row for
            anomalies.
          </p>
        </div>

        {/* Upload zone */}
        {!result && (
          <button
            type="button"
            aria-label="Choose a CSV file, or drop one here"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative w-full block border-2 border-dashed rounded-2xl p-8 sm:p-14 text-center cursor-pointer transition-all duration-300 overflow-hidden ${
              dragging
                ? "border-accent bg-accent/5"
                : file
                ? "border-success/50 bg-success/3"
                : "border-border-base hover:border-border-strong bg-surface/50 hover:bg-surface/80"
            }`}
          >
            {/* Background glow when dragging */}
            {dragging && (
              <div className="absolute inset-0 bg-linear-to-b from-accent/5 to-transparent pointer-events-none" />
            )}

            <input ref={inputRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

            {file ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-4">
                  <FileText size={22} className="text-success" />
                </div>
                <p className="text-fg font-semibold text-base">{file.name}</p>
                <p className="text-fg-muted text-sm mt-1">
                  {(file.size / 1024).toFixed(1)} KB · Ready to analyze
                </p>
                <p className="text-fg-subtle text-xs mt-3">Click to change file</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border-base flex items-center justify-center mx-auto mb-4">
                  <Upload size={20} className="text-fg-muted" />
                </div>
                <p className="text-fg font-semibold">Drop your telemetry CSV here</p>
                <p className="text-fg-muted text-sm mt-1">or click to browse files</p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs text-fg-subtle bg-surface-2 border border-border-base rounded-lg px-3 py-1.5">
                  <FileText size={11} />
                  ml/data/mock/fleetguard_telemetry.csv
                </div>
              </>
            )}
          </button>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-3 bg-danger/5 border border-danger/50 rounded-xl p-4 animate-fade-up">
            <div className="w-7 h-7 rounded-lg bg-danger/10 border border-danger/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={13} className="text-danger" />
            </div>
            <div>
              <p className="text-sm text-danger font-semibold">Analysis failed</p>
              <p className="text-xs text-danger/80 mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Run button */}
        {file && !result && (
          <button
            onClick={analyze}
            disabled={loading}
            className="mt-5 w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 relative overflow-hidden group
              bg-accent hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed
              shadow-[0_0_30px_rgba(34,211,238,0.15)] hover:shadow-[0_0_40px_rgba(34,211,238,0.25)]"
          >
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Running IsolationForest model…
              </>
            ) : (
              <>
                <BarChart2 size={16} />
                Run Anomaly Detection
              </>
            )}
          </button>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-fade-up">
            {/* Result header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-fg tracking-tight">Analysis Results</h2>
                <p className="text-xs text-fg-muted mt-0.5 font-data">{file?.name}</p>
              </div>
              <button
                onClick={() => { setResult(null); setFile(null); }}
                className="flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg border border-border-base hover:border-border-strong rounded-lg px-3 py-2 transition-all"
              >
                <Upload size={12} />
                New file
              </button>
            </div>

            {/* Anomaly rate banner */}
            <div className={`rounded-xl border p-4 flex items-center gap-4 ${
              result.anomaly_rate > 0.1
                ? "bg-danger/5 border-danger/40"
                : "bg-success/5 border-success/40"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                result.anomaly_rate > 0.1 ? "bg-danger/10 border border-danger/20" : "bg-success/10 border border-success/20"
              }`}>
                {result.anomaly_rate > 0.1
                  ? <AlertTriangle size={18} className="text-danger" />
                  : <CheckCircle size={18} className="text-success" />
                }
              </div>
              <div>
                <p className={`text-sm font-semibold ${result.anomaly_rate > 0.1 ? "text-danger" : "text-success"}`}>
                  {(result.anomaly_rate * 100).toFixed(1)}% anomaly rate detected
                </p>
                <p className="text-xs text-fg-muted">
                  {result.anomalies_detected} of {result.total_records.toLocaleString()} trips flagged by the ML model
                </p>
              </div>
              <div className="ml-auto">
                <div className="w-32 h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${result.anomaly_rate > 0.1 ? "bg-danger" : "bg-success"}`}
                    style={{ width: `${Math.min(result.anomaly_rate * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="Total Records" value={result.total_records.toLocaleString()} icon={FileText} sub="rows processed" />
              <SummaryCard label="Anomalies Found" value={result.anomalies_detected} icon={AlertTriangle} variant="danger" sub="flagged trips" />
              <SummaryCard label="Est. Financial Loss" value={`₦${(result.summary.estimated_loss_naira / 1000).toFixed(0)}k`} icon={TrendingDown} variant="warning" sub="from anomalies" />
              <SummaryCard label="Route Deviations" value={result.summary.route_deviations} icon={Route} variant={result.summary.route_deviations > 0 ? "warning" : "success"} sub="off-route trips" />
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Fuel, color: "text-danger bg-danger/10 border-danger/20", label: "Fuel Theft Suspected", value: `${result.summary.fuel_theft_suspected} trips`, vColor: "text-danger" },
                { icon: Clock, color: "text-warning bg-warning/10 border-warning/20", label: "Excessive Idle", value: `${result.summary.excessive_idle} trips`, vColor: "text-warning" },
                { icon: CheckCircle, color: "text-success bg-success/10 border-success/20", label: "Clean Trips", value: `${result.total_records - result.anomalies_detected}`, vColor: "text-success" },
              ].map(({ icon: Icon, color, label, value, vColor }) => (
                <div key={label} className="bg-surface border border-border-base rounded-xl p-4 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${color}`}>
                    <Icon size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] text-fg-muted leading-none">{label}</p>
                    <p className={`text-sm font-bold font-data mt-1 ${vColor}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Insight */}
            {result.ai_insight && (
              <div className="bg-accent/3 border border-accent/40 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-accent/30">
                  <div className="w-6 h-6 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                    <Brain size={12} className="text-accent" />
                  </div>
                  <span className="text-[10px] font-bold text-accent uppercase tracking-[0.15em]">AI Insight</span>
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent pulse-dot" />
                </div>
                <p className="text-sm text-fg-muted leading-relaxed p-4">{result.ai_insight}</p>
              </div>
            )}

            {/* Anomaly list */}
            {result.top_anomalies?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[10px] font-bold text-fg-muted uppercase tracking-[0.15em]">
                    Top Anomalies
                  </p>
                  <div className="flex-1 h-px bg-border-base" />
                  <span className="text-[10px] text-fg-muted font-data">{result.top_anomalies.length} shown</span>
                </div>
                <div className="space-y-2">
                  {result.top_anomalies.map((row, i) => (
                    <AnomalyRow key={i} row={row} idx={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}