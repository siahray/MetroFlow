import { describe, expect, test } from "bun:test";

import { basemapFor } from "./tiles";

/** The map itself follows the theme: storm gets the dark tiles on either provider. */
describe("basemapFor", () => {
  test("storm and light differ, and storm is the dark style", () => {
    const light = basemapFor("light");
    const storm = basemapFor("storm");
    expect(storm.urlTemplate).not.toBe(light.urlTemplate);
    expect(storm.urlTemplate).toContain("dark");
    expect(light.urlTemplate).toContain("light");
  });
});
