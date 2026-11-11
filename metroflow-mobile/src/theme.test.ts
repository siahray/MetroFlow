import { describe, expect, test } from "bun:test";

import { modeForHour } from "./theme";

/** The schedule behind "Theme By Time Of Day": 06:00–17:59 is light. */
describe("modeForHour", () => {
  test("day is light, night is storm", () => {
    expect(modeForHour(6)).toBe("light");
    expect(modeForHour(12)).toBe("light");
    expect(modeForHour(17)).toBe("light");
    expect(modeForHour(5)).toBe("storm");
    expect(modeForHour(18)).toBe("storm");
    expect(modeForHour(0)).toBe("storm");
    expect(modeForHour(23)).toBe("storm");
  });
});
