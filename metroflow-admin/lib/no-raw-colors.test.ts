import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// MapLibre paint specs and the DOM popup need literal colours, so the map
// palette lives in lib/network.ts (BACKLOG U-3). Every other screen names a
// colour through a Tailwind class; this fails if a hex literal creeps back in.
const PALETTE = "lib/network.ts";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("no raw colours outside the map palette", () => {
  const root = join(import.meta.dir, "..");
  const files = ["app", "components", "lib"]
    .flatMap((dir) => sourceFiles(join(root, dir)))
    .map((file) => file.replace(`${root}/`, ""))
    .filter((file) => file !== PALETTE);

  test("scans the portal sources", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  test("has no hex colour literals", () => {
    const hits = files.filter((file) =>
      /#[0-9a-fA-F]{3,8}\b/.test(readFileSync(join(root, file), "utf8")),
    );
    expect(hits).toEqual([]);
  });
});
