/**
 * Palette for consumers Tailwind cannot reach: Recharts props (fill/stroke/tick)
 * and MapLibre style + layer paint values.
 *
 * These values intentionally duplicate the custom properties in
 * src/app/globals.css. Reading them back via getComputedStyle would thrash
 * layout, return empty strings during SSR and first paint, and feed
 * whitespace-padded values into SVG gradients. Edit both files together.
 */

export type Mode = "light" | "dark";

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  neutral: string;
  chartGrid: string;
  chartAxis: string;
}

export const palette: Record<Mode, Palette> = {
  light: {
    bg: "#f6f8fb",
    surface: "#ffffff",
    surface2: "#eef2f7",
    border: "#d8e0ea",
    fg: "#0b1a2b",
    fgMuted: "#4a5b70",
    fgSubtle: "#64748b",
    accent: "#0e7490",
    success: "#047857",
    warning: "#b45309",
    danger: "#dc2626",
    neutral: "#64748b",
    chartGrid: "#e2e8f0",
    chartAxis: "#64748b",
  },
  dark: {
    bg: "#020d18",
    surface: "#0a1628",
    surface2: "#0f1f35",
    border: "#1e3254",
    fg: "#e2e8f0",
    fgMuted: "#94a3b8",
    fgSubtle: "#7689a3",
    accent: "#22d3ee",
    success: "#34d399",
    warning: "#fbbf24",
    danger: "#f87171",
    neutral: "#94a3b8",
    chartGrid: "#1e293b",
    chartAxis: "#64748b",
  },
};

/** Narrow next-themes' `resolvedTheme: string | undefined` to a Mode. */
export function toMode(resolved: string | undefined): Mode {
  return resolved === "light" ? "light" : "dark";
}

/**
 * OpenFreeMap basemap styles — keyless, no account, full OSM street labels.
 * Verified against Lagos: ~175KB of vector data at z14.
 *
 * This is a free community service with no SLA. If it degrades, MapTiler's
 * `streets-v2`/`dataviz-dark` are drop-in replacements (they need an API key).
 */
/**
 * `liberty` carries the full POI set (restaurants, shops, landmarks, transit);
 * `positron` does not. There is no dark equivalent, so dark keeps the minimal
 * basemap and has liberty's POI layers injected over it — see lib/mapPois.ts.
 */
export const MAP_STYLE: Record<Mode, string> = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/liberty",
};

/** OpenFreeMap's terms require attribution. */
export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · ' +
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

/** Lagos — [lng, lat]. MapLibre reverses Leaflet's order. */
export const MAP_CENTER: [number, number] = [3.3792, 6.5244];
export const MAP_ZOOM = 12;
