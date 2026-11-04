import { expect, test } from "bun:test";

import { hoursUntilPurge } from "./dismissed";

test("a naive UTC timestamp counts down from 72 hours", () => {
  const now = Date.parse("2026-11-04T12:00:00Z");
  expect(hoursUntilPurge("2026-11-04T12:00:00", now)).toBe(72);
  expect(hoursUntilPurge("2026-11-02T12:00:00", now)).toBe(24);
});

test("never reports zero while the incident still exists", () => {
  const now = Date.parse("2026-11-07T11:59:30Z");
  expect(hoursUntilPurge("2026-11-04T12:00:00", now)).toBe(1);
});
