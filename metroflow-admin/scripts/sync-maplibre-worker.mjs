/**
 * Publish the MapLibre worker where the bundler cannot rewrite it.
 *
 * `maplibre-gl` starts its worker from a URL derived from `import.meta.url`.
 * Turbopack bundles the library into a hashed chunk, so that derivation points
 * at `/_next/static/chunks/maplibre-gl-worker.mjs`, which does not exist and
 * leaves a blank map with "Worker failed to load". The library exposes
 * `setWorkerUrl`, so this script copies the worker into `public/` and the map
 * points at that stable path before it constructs anything.
 *
 * Runs from `dev` and `build`, so an upgraded `maplibre-gl` cannot silently
 * leave a stale worker behind.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageJson = require.resolve("maplibre-gl/package.json");
const source = join(dirname(packageJson), "dist", "maplibre-gl-worker.mjs");
const target = join(fileURLToPath(new URL("../public", import.meta.url)), "maplibre-gl-worker.mjs");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`[maplibre] worker copied to ${target}`);
