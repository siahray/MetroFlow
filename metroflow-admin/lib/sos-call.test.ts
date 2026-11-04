import { describe, expect, test } from "bun:test";

import { CALL_IN_DEFAULT, parseCallIn } from "./sos-call";

describe("call-in distress form", () => {
  test("the default location becomes a payload with no note", () => {
    expect(parseCallIn(CALL_IN_DEFAULT)).toEqual({
      ok: true,
      payload: { latitude: 14.565, longitude: 121.064, note: null },
    });
  });

  test("the note is trimmed and kept when present", () => {
    const result = parseCallIn({ ...CALL_IN_DEFAULT, note: "  Rising water, waist deep  " });
    expect(result).toEqual({
      ok: true,
      payload: { latitude: 14.565, longitude: 121.064, note: "Rising water, waist deep" },
    });
  });

  test("a non-numeric or out-of-range coordinate is refused", () => {
    for (const latitude of ["", "abc", "90.1", "-91"]) {
      expect(parseCallIn({ ...CALL_IN_DEFAULT, latitude }).ok).toBe(false);
    }
    for (const longitude of ["", "181", "-180.5"]) {
      expect(parseCallIn({ ...CALL_IN_DEFAULT, longitude }).ok).toBe(false);
    }
  });
});
