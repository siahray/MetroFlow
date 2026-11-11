import { describe, expect, test } from "bun:test";

import { basemapFor } from "./tiles";

/** The map itself follows the theme, whichever tile provider is configured. */
describe("basemapFor", () => {
  test("storm and light get different tiles", () => {
    const light = basemapFor("light");
    const storm = basemapFor("storm");
    expect(storm.urlTemplate).not.toBe(light.urlTemplate);
    expect(light.urlTemplate).toContain("light");
    expect(storm.maximumZ).toBeGreaterThan(0);
  });
});
