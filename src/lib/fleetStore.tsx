// lib/fleetStore.tsx
"use client";
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { createPositionSource, DEFAULT_REPLAY_SPEED, type PositionSource } from "@/lib/sources";
import type { ReplayRow } from "@/lib/sources/csvReplay";
import type { Vehicle, Alert, FleetStats, GpsPoint } from "@/types/fleet";

// ---------------------------------------------------------------------------
// Types for the ML API response (matching actual backend)
// ---------------------------------------------------------------------------
interface MLScoredRecord {
  vehicle_id: string;
  timestamp: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  fuel_level_pct: number;
  fuel_delta: number;
  is_anomaly: boolean;
  score: number;
  anomaly_type: string;
}

interface MLAnomaly {
  vehicle_id: string;
  timestamp: string;
  lat: number;
  lng: number;
  score: number;
  anomaly_type: string;
  report: string;
}

interface MLSummary {
  total_rows: number;
  total_vehicles: number;
  anomaly_count: number;
  anomaly_rate_pct: number;
  avg_score?: number;
  min_score?: number;
  max_score?: number;
  breakdown?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PLATE_PREFIXES = ["LND", "FST", "KJA", "ABJ", "PHC"];
const DRIVER_NAMES = [
  "Emeka Okafor", "Tunde Adeyemi", "Chioma Nwosu",
  "Babajide Fashola", "Ngozi Ibe", "Ahmed Bello",
  "Fatima Yusuf", "Chuka Obi", "Grace Essien", "Musa Danladi",
];
const ZONES = [
  "Lagos Island", "Victoria Island", "Ikeja", "Surulere", "Lekki",
  "Apapa", "Yaba", "Maryland", "Ikoyi", "Ajah",
];

const ANOMALY_TYPE_MAP: Record<string, Alert["type"]> = {
  excessive_idle: "idle-excess",
  fuel_theft: "fuel-theft",
  private_use: "route-deviation",
  route_deviation: "route-deviation",
  unauthorized_stop: "unauthorized-stop",
  speeding: "speeding",
  anomaly: "route-deviation",
};

const SEVERITY_MAP: Record<string, Alert["severity"]> = {
  excessive_idle: "medium",
  fuel_theft: "critical",
  private_use: "high",
  route_deviation: "high",
  unauthorized_stop: "medium",
  speeding: "low",
  anomaly: "medium",
};

/**
 * Analytics derived from the actual scored rows and anomalies.
 * These two charts previously rendered hardcoded arrays from data/mockData.ts
 * that had no relationship to the dataset on screen.
 */
export interface FuelByHour {
  hour: string;
  avgFuel: number;
}
export interface AlertsByDay {
  day: string;
  critical: number;
  high: number;
  medium: number;
}

export const NAIRA_PER_LITRE = 1050;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function computeFuelByHour(rows: MLScoredRecord[]): FuelByHour[] {
  const sum = new Array(24).fill(0);
  const count = new Array(24).fill(0);

  for (const r of rows) {
    const h = new Date(r.timestamp.replace(" ", "T")).getHours();
    if (Number.isNaN(h)) continue;
    sum[h] += r.fuel_level_pct;
    count[h] += 1;
  }

  return sum
    .map((s, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      avgFuel: count[h] ? Math.round((s / count[h]) * 10) / 10 : 0,
      n: count[h],
    }))
    .filter((d) => d.n > 0)
    .map(({ hour, avgFuel }) => ({ hour, avgFuel }));
}

function computeAlertsByDay(alerts: Alert[]): AlertsByDay[] {
  const buckets = DAY_NAMES.map((day) => ({ day, critical: 0, high: 0, medium: 0 }));
  let any = false;

  for (const a of alerts) {
    const d = new Date(a.timestamp).getDay();
    if (Number.isNaN(d)) continue;
    const b = buckets[d];
    if (a.severity === "critical") b.critical += 1;
    else if (a.severity === "high") b.high += 1;
    else b.medium += 1;
    any = true;
  }

  return any ? buckets : [];
}

function deriveStatus(record: MLScoredRecord): Vehicle["status"] {
  if (record.is_anomaly && record.anomaly_type !== "normal") return "alert";
  if (record.speed_kmh < 1) return "idle";
  if (record.speed_kmh < 3) return "idle";
  return "on-route";
}

const EARTH_KM_PER_DEG = 111.32;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = b.lat - a.lat;
  const dLng = (b.lng - a.lng) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(dLat, dLng) * EARTH_KM_PER_DEG;
}

/** The vehicle's real trailing fixes, newest last. Replaces a generator that
 *  invented 15-25 interpolated points around the current position. */
function routeHistoryFromRows(rows: MLScoredRecord[], limit = 40): GpsPoint[] {
  return rows.slice(-limit).map((r) => ({
    lat: r.lat,
    lng: r.lng,
    timestamp: new Date(r.timestamp.replace(" ", "T")).getTime(),
    speed: r.speed_kmh,
    fuelLevel: r.fuel_level_pct,
  }));
}

/** Distance covered over the final 24h of this vehicle's data. */
function distanceLast24h(rows: MLScoredRecord[]): number {
  if (rows.length < 2) return 0;
  const last = new Date(rows[rows.length - 1].timestamp.replace(" ", "T")).getTime();
  const cutoff = last - 24 * 60 * 60 * 1000;
  const recent = rows.filter(
    (r) => new Date(r.timestamp.replace(" ", "T")).getTime() >= cutoff,
  );
  let km = 0;
  for (let i = 1; i < recent.length; i++) km += haversineKm(recent[i - 1], recent[i]);
  return Math.round(km);
}

/** Total distance across every fix we have for this vehicle. */
function totalDistance(rows: MLScoredRecord[]): number {
  let km = 0;
  for (let i = 1; i < rows.length; i++) km += haversineKm(rows[i - 1], rows[i]);
  return Math.round(km);
}

function getLatestRecords(records: MLScoredRecord[]): MLScoredRecord[] {
  if (!records || !Array.isArray(records)) {
    console.error("getLatestRecords: records is not an array", records);
    return [];
  }
  const latest: Map<string, MLScoredRecord> = new Map();
  records.forEach((r) => {
    const existing = latest.get(r.vehicle_id);
    if (!existing || new Date(r.timestamp) > new Date(existing.timestamp)) {
      latest.set(r.vehicle_id, r);
    }
  });
  return Array.from(latest.values());
}

function mapVehicle(
  record: MLScoredRecord,
  index: number,
  vehicleRows: MLScoredRecord[],
): Vehicle {
  const status = deriveStatus(record);
  const baseLat = record.lat;
  const baseLng = record.lng;

  return {
    id: record.vehicle_id,
    plateNumber: `${PLATE_PREFIXES[index % PLATE_PREFIXES.length]}-${String(100 + index).slice(1)}-${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(65 + ((index + 1) % 26))}`,
    driverName: DRIVER_NAMES[index % DRIVER_NAMES.length],
    driverPhone: `+234 80${String(300000000 + index * 1234567).slice(0, 8)}`,
    vehicleType: index % 3 === 0 ? "truck" : index % 3 === 1 ? "van" : "motorcycle",
    status,
    currentPosition: {
      lat: baseLat,
      lng: baseLng,
      timestamp: Date.now(),
      speed: record.speed_kmh,
      fuelLevel: record.fuel_level_pct,
    },
    routeHistory: routeHistoryFromRows(vehicleRows),
    // No planned route exists in this dataset; an invented triangle around the
    // current position was previously drawn as though it were one.
    plannedRoute: [],
    fuelCapacity: index % 3 === 0 ? 100 : index % 3 === 1 ? 80 : 20,
    currentFuel: record.fuel_level_pct,
    lastFixAt: new Date(record.timestamp.replace(" ", "T")).getTime(),
    totalDistance: totalDistance(vehicleRows),
    todayDistance: distanceLast24h(vehicleRows),
    alerts: [],
    assignedZone: ZONES[index % ZONES.length],
  };
}

function mapAlerts(
  anomalies: MLAnomaly[],
  vehicleMap: Map<string, Vehicle>,
  rowIndex: Map<string, MLScoredRecord>
): Alert[] {
  if (!anomalies || !Array.isArray(anomalies)) return [];
  return anomalies.map((a, i) => {
    const vehicle = vehicleMap.get(a.vehicle_id);

    // Derived from the scored row this anomaly came from, not invented.
    // fuel_delta is a change in percentage points; convert to litres using the
    // vehicle's tank capacity. Only a DROP counts as loss.
    const row = rowIndex.get(`${a.vehicle_id}|${a.timestamp}`);
    const drop = row && row.fuel_delta < 0 ? Math.abs(row.fuel_delta) : 0;
    const fuelLost =
      a.anomaly_type === "fuel_theft" && drop > 0 && vehicle
        ? Math.round(((drop / 100) * vehicle.fuelCapacity) * 10) / 10
        : undefined;

    return {
      id: `ml-alert-${a.vehicle_id}-${i}`,
      vehicleId: a.vehicle_id,
      vehiclePlate: vehicle?.plateNumber ?? a.vehicle_id,
      driverName: vehicle?.driverName ?? "Unknown",
      type: ANOMALY_TYPE_MAP[a.anomaly_type] ?? "route-deviation",
      severity: SEVERITY_MAP[a.anomaly_type] ?? "medium",
      timestamp: new Date(a.timestamp).getTime(),
      location: { lat: a.lat, lng: a.lng },
      description: a.report,
      aiAnalysis: a.report,
      fuelLost,
      // deviationKm needs zone_distance_deg and stopDurationMin needs
      // idle_minutes; the analyze-fleet response carries neither, so they stay
      // undefined and the UI omits them rather than showing a made-up figure.
      deviationKm: undefined,
      stopDurationMin: undefined,
      resolved: false,
    };
  });
}

function computeStats(
  vehicles: Vehicle[],
  alerts: Alert[],
  summary: MLSummary
): FleetStats {
  const totalVehicles = summary.total_vehicles;
  const activeVehicles = vehicles.filter((v) => v.status === "on-route").length;
  const alertsToday = alerts.filter((a) => !a.resolved).length;
  const fuelTheftLiters = alerts
    .filter((a) => a.type === "fuel-theft" && !a.resolved)
    .reduce((sum, a) => sum + (a.fuelLost ?? 0), 0);
  const estimatedLossNaira = Math.round(fuelTheftLiters * NAIRA_PER_LITRE);
  const routeCompliancePercent = totalVehicles > 0
    ? Math.round(((totalVehicles - alerts.filter((a) => a.type === "route-deviation" && !a.resolved).length) / totalVehicles) * 100)
    : 100;
  const avgFuelEfficiency = vehicles.length > 0
    ? Math.round(vehicles.reduce((sum, v) => sum + v.currentPosition.fuelLevel, 0) / vehicles.length)
    : 0;

  return {
    totalVehicles,
    activeVehicles,
    alertsToday,
    fuelTheftLiters: Math.round(fuelTheftLiters * 10) / 10,
    estimatedLossNaira,
    routeCompliancePercent,
    avgFuelEfficiency,
  };
}

const DEFAULT_STATS: FleetStats = {
  totalVehicles: 0,
  activeVehicles: 0,
  alertsToday: 0,
  fuelTheftLiters: 0,
  estimatedLossNaira: 0,
  routeCompliancePercent: 100,
  avgFuelEfficiency: 0,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface FleetContextType {
  vehicles: Vehicle[];
  alerts: Alert[];
  stats: FleetStats;
  selectedVehicle: Vehicle | null;
  selectedAlert: Alert | null;
  activeTab: "map" | "alerts" | "analytics";
  fuelByHour: FuelByHour[];
  alertsByDay: AlertsByDay[];
  /** Virtual replay clock (epoch ms) — 0 when no source is running. */
  /** Whether the analysis came from the live backend or the cached snapshot. */
  dataSource: "live" | "snapshot";
  replayClock: number;
  replaySpeed: number;
  setReplaySpeed: (multiplier: number) => void;
  isLoading: boolean;
  loadingStage: string;
  error: string | null;
  setSelectedVehicle: (v: Vehicle | null) => void;
  setSelectedAlert: (a: Alert | null) => void;
  setActiveTab: (tab: "map" | "alerts" | "analytics") => void;
  resolveAlert: (alertId: string) => void;
  retry: () => void;
}


const FleetContext = createContext<FleetContextType | null>(null);

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<FleetStats>(DEFAULT_STATS);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [activeTab, setActiveTab] = useState<"map" | "alerts" | "analytics">("map");
  const [fuelByHour, setFuelByHour] = useState<FuelByHour[]>([]);
  const [alertsByDay, setAlertsByDay] = useState<AlertsByDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState("Loading telemetry…");
  const [error, setError] = useState<string | null>(null);
  // State, not a ref: a ref made the error screen a dead end that only a full
  // page reload could recover from. Bumping this re-runs the fetch effect.
  const [retryToken, setRetryToken] = useState(0);

  // Replay plumbing
  const replayRowsRef = useRef<ReplayRow[]>([]);
  const sourceRef = useRef<PositionSource | null>(null);
  const [replayEpoch, setReplayEpoch] = useState(0);
  const [replayClock, setReplayClock] = useState(0);
  const [replaySpeed, setReplaySpeedState] = useState(DEFAULT_REPLAY_SPEED);
  const [dataSource, setDataSource] = useState<"live" | "snapshot">("live");

  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  // ── 1. Fetch ML-scored fleet data ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchAnalyzedFleet() {
      setIsLoading(true);
      setError(null);
      setLoadingStage("Loading telemetry…");

      try {
        // Analysis runs server-side in /api/fleet: cached, and it falls back to
        // a checked-in snapshot if the backend is slow or down.
        setLoadingStage("Scoring records with the anomaly model…");

        const response = await fetch("/api/fleet");
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Analysis failed (${response.status}): ${errText.slice(0, 200)}`);
        }

        const data = await response.json();

        // Safety check
        if (!data || !data.rows || !Array.isArray(data.rows)) {
          console.error("Unexpected API response shape:", data);
          throw new Error("API response missing 'rows' array");
        }

        if (!cancelled) setLoadingStage("Building fleet view…");
        setDataSource(data.source === "live" ? "live" : "snapshot");

        // Get latest record per vehicle
        const latestRecords = getLatestRecords(data.rows);

        if (latestRecords.length === 0) {
          throw new Error("No vehicle records found in ML response");
        }

        // Map to frontend types
        const rowsByVehicle = new Map<string, MLScoredRecord[]>();
        for (const r of data.rows as MLScoredRecord[]) {
          const list = rowsByVehicle.get(r.vehicle_id);
          if (list) list.push(r);
          else rowsByVehicle.set(r.vehicle_id, [r]);
        }
        for (const list of rowsByVehicle.values()) {
          list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        }

        const mappedVehicles = latestRecords.map((r, i) =>
          mapVehicle(r, i, rowsByVehicle.get(r.vehicle_id) ?? [r]),
        );

        // Build vehicle lookup for alerts
        const vehicleMap = new Map<string, Vehicle>();
        mappedVehicles.forEach((v) => vehicleMap.set(v.id, v));

        // Map anomalies
        // Index every scored row so alert figures can be derived from the
        // actual telemetry rather than generated.
        const rowIndex = new Map<string, MLScoredRecord>();
        for (const r of data.rows as MLScoredRecord[]) {
          rowIndex.set(`${r.vehicle_id}|${r.timestamp}`, r);
        }

        const mappedAlerts = mapAlerts(data.anomalies ?? [], vehicleMap, rowIndex);

        // Attach alerts to their vehicles
        mappedVehicles.forEach((v) => {
          v.alerts = mappedAlerts.filter((a) => a.vehicleId === v.id);
        });

        // Set any vehicle with an unresolved alert to "alert" status
        mappedVehicles.forEach((v) => {
          if (v.alerts.some((a) => !a.resolved) && v.status !== "alert") {
            v.status = "alert";
          }
        });

        const computedStats = computeStats(mappedVehicles, mappedAlerts, data.summary);

        if (cancelled) return;
        setVehicles(mappedVehicles);
        setAlerts(mappedAlerts);
        setStats(computedStats);
        setFuelByHour(computeFuelByHour(data.rows as MLScoredRecord[]));
        setAlertsByDay(computeAlertsByDay(mappedAlerts));
        replayRowsRef.current = data.rows as ReplayRow[];
        setReplayEpoch((e) => e + 1);
        setIsLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        console.error("Failed to fetch analyzed fleet:", err);
        setError(err instanceof Error ? err.message : "Failed to load fleet data");
        setIsLoading(false);
      }
    }

    fetchAnalyzedFleet();
    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  // ── 2. Position replay ───────────────────────────────────────────────
  // Replaces a client-side random walk that invented movement and, worse,
  // overwrote each vehicle's ML-derived status on every tick. The source now
  // replays the real recorded fixes; it cannot emit status at all (see
  // lib/sources/types.ts).
  useEffect(() => {
    const rows = replayRowsRef.current;
    if (rows.length === 0) return;

    const source = createPositionSource(rows);
    sourceRef.current = source;

    source.start(({ updates, clock }) => {
      setReplayClock(clock);
      if (updates.length === 0) return;

      const byId = new Map(updates.map((u) => [u.vehicleId, u]));

      setVehicles((prev) =>
        prev.map((v) => {
          const u = byId.get(v.id);
          if (!u) return v;

          const point: GpsPoint = {
            lat: u.lat,
            lng: u.lng,
            timestamp: u.timestamp,
            speed: u.speedKmh,
            fuelLevel: u.fuelPct,
          };

          // NOTE: `status` is deliberately absent — it belongs to the model.
          return {
            ...v,
            currentPosition: point,
            currentFuel: u.fuelPct,
            lastFixAt: u.timestamp,
            routeHistory: [...v.routeHistory.slice(-99), point],
          };
        }),
      );
    });

    return () => {
      source.stop();
      sourceRef.current = null;
    };
  }, [replayEpoch]);

  const setReplaySpeed = useCallback((multiplier: number) => {
    sourceRef.current?.setSpeed?.(multiplier);
    setReplaySpeedState(multiplier);
  }, []);

  // ── 3. Resolve alert ─────────────────────────────────────────────────
  const resolveAlert = useCallback((alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
    );
    setStats((prev) => ({
      ...prev,
      alertsToday: Math.max(0, prev.alertsToday - 1),
    }));
  }, []);

  return (
    <FleetContext.Provider
      value={{
        vehicles,
        alerts,
        stats,
        selectedVehicle,
        selectedAlert,
        activeTab,
        fuelByHour,
        alertsByDay,
        dataSource,
        replayClock,
        replaySpeed,
        setReplaySpeed,
        isLoading,
        loadingStage,
        error,
        setSelectedVehicle,
        setSelectedAlert,
        setActiveTab,
        resolveAlert,
        retry,
      }}
    >
      {children}
    </FleetContext.Provider>
  );
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be used within FleetProvider");
  return ctx;
}