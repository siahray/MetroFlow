import { setAccessToken } from "@rnmapbox/maps";

// The night/day theme toggle otherwise only changed this app's own chrome;
// the basemap itself stayed the same bright style regardless, which read as
// "the toggle doesn't do anything" since the map is most of the screen.
// `navigation-night-v1` is Mapbox's own style tuned for driving in the dark.
export const MAPBOX_STYLE_DAY = "mapbox://styles/mapbox/streets-v12";
export const MAPBOX_STYLE_NIGHT = "mapbox://styles/mapbox/navigation-night-v1";

// The public (pk.) token, at module scope so the native SDK call starts
// before the first MapView mounts. `setAccessToken` crosses the native
// bridge and is genuinely async -- mounting <MapView> before it resolves
// lets the SDK's first tile/style request race an empty token, which the
// native SDK then reports as "Invalid token" (with its own Retry button)
// even after the real token lands a moment later. `mapboxReady` gates each
// mount on that promise instead of firing it and hoping. Unset means a
// blank basemap, not a crash -- resolves immediately either way.
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
export const mapboxReady: Promise<void> = MAPBOX_ACCESS_TOKEN
  ? setAccessToken(MAPBOX_ACCESS_TOKEN).then(
      () => undefined,
      () => undefined,
    )
  : Promise.resolve();
