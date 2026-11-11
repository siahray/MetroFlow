// Basemap tiles for the driver map (CR-001: Mapbox raster tiles via a public token,
// with a keyless fallback so the map still renders with no token, TC-045).
//
// Swap providers here only: the map just draws whatever raster tile URL this returns.

import type { ThemeMode } from "../theme";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();

export type Basemap = { urlTemplate: string; attribution: string; maximumZ: number };

/** Light by day, dark Matter-style tiles in storm/night mode. */
export function basemapFor(mode: ThemeMode): Basemap {
  return MAPBOX_TOKEN
    ? {
        // Mapbox Static Tiles API; light matches the portal's desaturated look,
        // dark-v11 is its night pairing.
        urlTemplate: `https://api.mapbox.com/styles/v1/mapbox/${mode === "storm" ? "dark" : "light"}-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
        attribution: "© Mapbox © OpenStreetMap",
        maximumZ: 20,
      }
    : {
        // Keyless Carto Positron / Dark Matter (ADR-022).
        urlTemplate: `https://basemaps.cartocdn.com/${mode === "storm" ? "dark" : "light"}_all/{z}/{x}/{y}.png`,
        attribution: "© OpenStreetMap contributors © CARTO",
        maximumZ: 19,
      };
}
