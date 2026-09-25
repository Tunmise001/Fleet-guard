"use client";
import { useEffect, useRef } from "react";
// Pinned to maplibre-gl v5: v6 loads its worker via
// `new Worker(new URL("maplibre-gl-worker.mjs", import.meta.url))`, and
// Turbopack emits that file content-hashed without rewriting the runtime
// string — so the worker 404s and no tile ever decodes (blank map, working
// markers). v5 inlines the worker, so there is nothing to resolve.
import { Map as MlMap, Marker, NavigationControl, LngLatBounds, type GeoJSONSource } from "maplibre-gl";
import { useTheme } from "next-themes";
import { useFleet } from "@/lib/fleetStore";
import { STATUS, statusHex } from "@/lib/status";
import { poiLayers, POI_SOURCE } from "@/lib/mapPois";
import { MAP_STYLE, MAP_CENTER, MAP_ZOOM, MAP_ATTRIBUTION, toMode, type Mode } from "@/lib/theme";
import type { Vehicle } from "@/types/fleet";

const TRACKS_SOURCE = "fleet-tracks";
const TRACKS_LAYER = "fleet-tracks-line";

/** Beyond this, a position change is a replay seek or a sparse-fix jump, not
 *  driving — tweening it would draw a straight line across the city. */
const SNAP_DEGREES = 0.02;

const GLYPH: Record<Vehicle["vehicleType"], string> = {
  truck: "🚛",
  motorcycle: "🏍",
  van: "🚐",
};

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface Tracked {
  marker: Marker;
  el: HTMLDivElement;
  cur: { lat: number; lng: number };
  target: { lat: number; lng: number };
}

/** How many recent fixes to show behind each vehicle. */
const TRAIL_LENGTH = 6;

/**
 * Breadcrumbs, not a path.
 *
 * Each fix is a discrete tracker ping, so each is drawn as its own dot, fading
 * with age, rather than joined into a line. (Under the original sparse dataset
 * — fixes a median 13 km apart — joining them drew a starburst of straight
 * segments across Lagos. The current 30s road-walk data is ~190 m between
 * fixes, but breadcrumbs remain the honest rendering: we record positions, not
 * the path taken between them.)
 */
function tracksGeoJSON(vehicles: Vehicle[], mode: Mode): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const v of vehicles) {
    const recent = v.routeHistory.slice(-TRAIL_LENGTH);
    recent.forEach((p, i) => {
      // Newest (last) is brightest; oldest fades out.
      const age = recent.length - 1 - i;
      features.push({
        type: "Feature",
        properties: {
          color: statusHex(v.status, mode),
          opacity: Math.max(0.12, 0.55 - age * 0.09),
          radius: Math.max(2, 4.5 - age * 0.5),
        },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      });
    });
  }

  return { type: "FeatureCollection", features };
}

export default function FleetMap() {
  const { vehicles, alerts, selectedVehicle, setSelectedVehicle, setSelectedAlert } = useFleet();
  const { resolvedTheme } = useTheme();
  const mode = toMode(resolvedTheme);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const tracked = useRef<Record<string, Tracked>>({});
  const rafRef = useRef<number>(0);
  const styleReady = useRef(false);
  const didFit = useRef(false);
  const warnedPosition = useRef(false);

  // Latest values for use inside stable callbacks without re-running effects.
  const latest = useRef({ vehicles, alerts, mode, setSelectedVehicle, setSelectedAlert });
  latest.current = { vehicles, alerts, mode, setSelectedVehicle, setSelectedAlert };

  const selectedId = selectedVehicle?.id ?? null;

  // ── Init + teardown ────────────────────────────────────────────────────
  // Runs once. Dashboard unmounts this component on every tab switch, so
  // without map.remove() each switch leaks a WebGL context — browsers cap at
  // roughly 16, after which the map silently stops rendering.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MlMap({
      container: containerRef.current,
      style: MAP_STYLE[latest.current.mode],
      center: MAP_CENTER, // [lng, lat] — reversed from Leaflet
      zoom: MAP_ZOOM,
      attributionControl: { compact: true, customAttribution: MAP_ATTRIBUTION },
    });
    mapRef.current = map;

    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    // Registered with .on (not .once) so it also runs after every setStyle,
    // which is what makes it the single hook covering theme switches too.
    map.on("style.load", () => {
      styleReady.current = true;
      ensurePoiLayers(map, latest.current.mode);
      addTrackLayers(map);
      syncTracks(map);
    });

    // One shared rAF loop for every marker. All state lives in refs — writing
    // to React state here would re-render the tree at 60fps.
    const tick = () => {
      for (const t of Object.values(tracked.current)) {
        const dLat = t.target.lat - t.cur.lat;
        const dLng = t.target.lng - t.cur.lng;
        if (Math.abs(dLat) > 1e-7 || Math.abs(dLng) > 1e-7) {
          t.cur.lat += dLat * 0.12;
          t.cur.lng += dLng * 0.12;
          t.marker.setLngLat([t.cur.lng, t.cur.lat]);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // MapLibre only listens for window resizes, so it misses container-driven
    // size changes — the responsive breakpoint switching between the stacked
    // and side-by-side layouts, or the vehicle sheet opening.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      for (const t of Object.values(tracked.current)) t.marker.remove();
      tracked.current = {};
      styleReady.current = false;
      map.remove();
      mapRef.current = null;
    };
     
  }, []);

  /**
   * Adds liberty's POI layers to the dark basemap.
   *
   * A no-op in light mode: `liberty` already ships these layers, correctly
   * coloured, so the id guard skips every one of them.
   *
   * Uses `style.load` rather than `transformStyle` deliberately —
   * `transformStyle` exists to carry the `fleet-tracks` GeoJSON source (which
   * holds live data) across a setStyle. POI layers have no data to carry; they
   * read from the incoming style's own vector source.
   */
  function ensurePoiLayers(map: MlMap, mode: Mode) {
    if (!map.getSource(POI_SOURCE)) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[FleetMap] no "${POI_SOURCE}" source; skipping POI layers`);
      }
      return;
    }

    // On a theme switch transformStyle has already appended TRACKS_LAYER last,
    // so POIs must be inserted *below* it or they draw over the vehicle trails.
    const before = map.getLayer(TRACKS_LAYER) ? TRACKS_LAYER : undefined;

    for (const def of poiLayers(mode)) {
      if (map.getLayer(def.id)) continue;
      map.addLayer(def, before);
    }
  }

  function addTrackLayers(map: MlMap) {
    if (!map.getSource(TRACKS_SOURCE)) {
      map.addSource(TRACKS_SOURCE, { type: "geojson", data: EMPTY_FC });
    }
    if (!map.getLayer(TRACKS_LAYER)) {
      map.addLayer({
        id: TRACKS_LAYER,
        type: "circle",
        source: TRACKS_SOURCE,
        paint: {
          "circle-color": ["get", "color"],
          "circle-opacity": ["get", "opacity"],
          "circle-radius": ["get", "radius"],
        },
      });
    }
  }

  function syncTracks(map: MlMap) {
    const src = map.getSource(TRACKS_SOURCE) as GeoJSONSource | undefined;
    src?.setData(tracksGeoJSON(latest.current.vehicles, latest.current.mode));
  }

  // ── Markers follow the store ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();

    for (const v of vehicles) {
      seen.add(v.id);
      const pos = { lat: v.currentPosition.lat, lng: v.currentPosition.lng };
      let t = tracked.current[v.id];

      if (!t) {
        const el = document.createElement("div");
        el.className = "veh-marker";
        el.textContent = GLYPH[v.vehicleType];
        el.setAttribute("role", "button");
        el.tabIndex = 0;
        const select = () => {
          const vv = latest.current.vehicles.find((x) => x.id === v.id) ?? v;
          latest.current.setSelectedVehicle(vv);
          const a = latest.current.alerts.find((x) => x.vehicleId === v.id && !x.resolved);
          if (a) latest.current.setSelectedAlert(a);
        };
        el.addEventListener("click", select);
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            select();
          }
        });

        const marker = new Marker({ element: el }).setLngLat([pos.lng, pos.lat]).addTo(map);
        t = { marker, el, cur: { ...pos }, target: { ...pos } };
        tracked.current[v.id] = t;

        // MapLibre positions markers only through `.maplibregl-marker
        // { position: absolute }`. Any same-specificity rule declared later
        // silently overrides it and the marker falls into document flow —
        // it then ignores pan and zoom entirely, which looks like bad data.
        if (process.env.NODE_ENV !== "production" && !warnedPosition.current) {
          const computed = getComputedStyle(el).position;
          if (computed !== "absolute") {
            warnedPosition.current = true;
            console.error(
              `[FleetMap] marker computed position is "${computed}", expected "absolute". ` +
                `A CSS rule is overriding .maplibregl-marker; markers will not track the map.`,
            );
          }
        }
      }

      // Mutate only what changed — rebuilding innerHTML is what made the old
      // implementation's status colour and alert ring go permanently stale.
      t.el.dataset.status = v.status;
      t.el.dataset.selected = String(v.id === selectedId);
      t.el.style.setProperty("--marker-color", statusHex(v.status, mode));
      t.el.setAttribute("aria-label", `${v.plateNumber}, ${STATUS[v.status].label}`);

      const jumped =
        Math.abs(pos.lat - t.cur.lat) > SNAP_DEGREES || Math.abs(pos.lng - t.cur.lng) > SNAP_DEGREES;
      t.target = { ...pos };
      if (jumped) {
        t.cur = { ...pos };
        t.marker.setLngLat([pos.lng, pos.lat]);
      }
    }

    for (const [id, t] of Object.entries(tracked.current)) {
      if (!seen.has(id)) {
        t.marker.remove();
        delete tracked.current[id];
      }
    }

    if (styleReady.current) syncTracks(map);
  }, [vehicles, selectedId, mode]);

  // ── Frame the fleet once, on first data ────────────────────────────────
  // A hardcoded centre/zoom strands the user wherever the data isn't — if the
  // dataset moves city, or they zoom off, the vehicles are simply lost.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || didFit.current || vehicles.length === 0) return;
    didFit.current = true;

    const bounds = new LngLatBounds();
    for (const v of vehicles) bounds.extend([v.currentPosition.lng, v.currentPosition.lat]);
    if (bounds.isEmpty()) return;

    map.fitBounds(bounds, { padding: 64, maxZoom: 13, duration: 0 });
  }, [vehicles]);

  // ── Theme switch ───────────────────────────────────────────────────────
  // setStyle() replaces the whole style object, destroying custom sources and
  // layers. transformStyle merges them into the incoming style atomically, so
  // the tracks survive with their data intact. DOM markers are unaffected —
  // they are siblings of the canvas, not style state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady.current) return;

    map.setStyle(MAP_STYLE[mode], {
      diff: false,
      transformStyle: (previous, next) => {
        const carried = previous?.sources?.[TRACKS_SOURCE];
        return {
          ...next,
          sources: {
            ...next.sources,
            [TRACKS_SOURCE]: carried ?? { type: "geojson", data: EMPTY_FC },
          },
          layers: [
            ...next.layers,
            {
              id: TRACKS_LAYER,
              type: "circle",
              source: TRACKS_SOURCE,
              paint: {
                "circle-color": ["get", "color"],
                "circle-opacity": ["get", "opacity"],
                "circle-radius": ["get", "radius"],
              },
            },
          ],
        };
      },
    });

    map.once("styledata", () => syncTracks(map));
  }, [mode]);

  // ── Fly to selection ───────────────────────────────────────────────────
  // Keyed on the id, not the vehicle object: the object identity changes on
  // every position update, which would re-trigger flyTo continuously.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const v = vehicles.find((x) => x.id === selectedId);
    if (!v) return;
    map.flyTo({
      center: [v.currentPosition.lng, v.currentPosition.lat],
      // 15, not 14: POI layers have minzoom 15, and selecting a vehicle is
      // the moment the user asks "where is this, what is around it".
      zoom: Math.max(map.getZoom(), 15),
      duration: 1200,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded-xl" />

      <div className="absolute bottom-8 left-4 glass border border-border-base rounded-lg p-3 text-xs space-y-1.5 pointer-events-none">
        {Object.entries(STATUS).map(([status, cfg]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${cfg.dotClass}`} aria-hidden />
            <span className="text-fg-muted">{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
