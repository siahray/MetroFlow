// Basemap tiles for the driver map (CR-001: Mapbox raster tiles via a public token,
// with a keyless fallback so the map still renders with no token, TC-045).
//
// Swap providers here only: the map just draws whatever raster tile URL this returns.

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();

export type Basemap = { urlTemplate: string; attribution: string; maximumZ: number };

export const basemap: Basemap = MAPBOX_TOKEN
  ? {
      // Mapbox Static Tiles API, light style (matches the portal's desaturated look).
      urlTemplate: `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
      attribution: "© Mapbox © OpenStreetMap",
      maximumZ: 20,
    }
  : {
      // Keyless Carto Positron (ADR-022).
      urlTemplate: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      attribution: "© OpenStreetMap contributors © CARTO",
      maximumZ: 19,
    };
