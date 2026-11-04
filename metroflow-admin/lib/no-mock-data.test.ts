import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The portal must show only what the API returns. These strings were invented sample content
// that once shipped in the UI; this fails if any of it comes back.
const BANNED: [RegExp, string][] = [
  [/Sector Delta/i, "invented sector label"],
  [/AI Confidence/i, "there is no AI scoring"],
  [/98\.5%/, "invented confidence figure"],
  [/RESCUE_UNITS|DISTRESS_BEACON|MISSION_MILESTONES/, "removed sample-data constants"],
  [/San Pedro|Rizal Ave|Malaya Overpass|Depot Delta/i, "invented place names"],
  [
    /MDRRMC (Pasig|Operations|Operational Grid)|Station 4|NODE PH-NCR/i,
    "invented organisation or station",
  ],
  [/8888-FLOW|CDMO/, "invented contact"],
  [/156\.\d+ ?MHz|Marine/i, "invented radio channel"],
  [/"(1\.2 km|35 cm|12 mins|45 cm)"/, "invented fallback value"],
  [
    /CIT-8821|14\.5995|Verified GPS|Geolocation verified|14 minutes ago \(High Priority\)/,
    "invented verification or elapsed-time claim",
  ],
  [
    /Water Rising|0\.2 ft|25–60 cm \(Estimated\)|75 cm \(Impassable\)|Native Mobile/,
    "invented telemetry or fallback depth",
  ],
  [/Distress Beacon|GPS \(Road Node Match\)/, "invented verification claim"],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("no sample data in the portal", () => {
  const root = join(import.meta.dir, "..");
  const files = ["app", "components", "lib"].flatMap((d) => sourceFiles(join(root, d)));

  test("scans the portal sources", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const [pattern, why] of BANNED) {
    test(`has no ${why}`, () => {
      const hits = files.filter((f) => pattern.test(readFileSync(f, "utf8")));
      expect(hits.map((f) => f.replace(root + "/", ""))).toEqual([]);
    });
  }
});
