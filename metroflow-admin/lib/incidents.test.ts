import { describe, expect, test } from "bun:test";

import {
  countByFilter,
  matchesQueueFilter,
  primarySource,
  QUEUE_FILTERS,
  type Incident,
} from "./incidents";
import { isEscalatedReport, reportToIncident } from "./sos-to-incidents";
import type { FieldReport } from "./reports";

// Only the flags the queue filters read; the rest of an Incident is irrelevant here.
const incident = (flags: Partial<Pick<Incident, "hasPhoto" | "escalated" | "sensorMismatch">>) =>
  ({ hasPhoto: false, escalated: false, sensorMismatch: false, ...flags }) as Incident;

const report = (over: Partial<FieldReport>): FieldReport =>
  ({
    report_id: "11111111-2222-3333-4444-555555555555",
    reporter_hash: "abcdef0123456789",
    depth_level: "KNEE",
    depth_label: "Knee-Deep",
    status: "PENDING",
    urgency_score: 7.5,
    latitude: 14.6,
    longitude: 121.0,
    photo: null,
    exif: null,
    decision_reason: null,
    submitted_at: "2026-11-03T10:00:00",
    captured_at: null,
    ...over,
  }) as unknown as FieldReport;

describe("queue filters (FSD-FR-026)", () => {
  test("offers all, photo, sensor mismatch and escalated", () => {
    expect(QUEUE_FILTERS.map((f) => f.id)).toEqual(["all", "photo", "sensor", "escalated"]);
  });

  test("each filter reads its own flag, so an incident can match several", () => {
    const both = incident({ hasPhoto: true, escalated: true });
    expect(matchesQueueFilter(both, "photo")).toBe(true);
    expect(matchesQueueFilter(both, "escalated")).toBe(true);
    expect(matchesQueueFilter(both, "sensor")).toBe(false);
    expect(matchesQueueFilter(both, "all")).toBe(true);
  });

  test("counts per filter overlap instead of hiding an escalated photo report", () => {
    const list = [
      incident({ hasPhoto: true, escalated: true }),
      incident({ hasPhoto: true }),
      incident({ sensorMismatch: true }),
      incident({}),
    ];
    expect(countByFilter(list, "all")).toBe(4);
    expect(countByFilter(list, "photo")).toBe(2);
    expect(countByFilter(list, "escalated")).toBe(1);
    expect(countByFilter(list, "sensor")).toBe(1);
  });

  test("an incident with no photo is not mislabelled as a sensor mismatch", () => {
    expect(primarySource({ escalated: false, sensorMismatch: false, hasPhoto: false })).toBe(
      "other",
    );
    expect(primarySource({ escalated: false, sensorMismatch: false, hasPhoto: true })).toBe(
      "photo",
    );
    expect(primarySource({ escalated: false, sensorMismatch: true, hasPhoto: true })).toBe(
      "sensor",
    );
    expect(primarySource({ escalated: true, sensorMismatch: true, hasPhoto: true })).toBe(
      "escalated",
    );
  });
});

describe("report to incident", () => {
  test("an escalation is read from the decision reason", () => {
    expect(isEscalatedReport(report({ decision_reason: "Escalated to BFP: rising fast" }))).toBe(
      true,
    );
    expect(isEscalatedReport(report({ decision_reason: "Rejected: duplicate" }))).toBe(false);
    expect(isEscalatedReport(report({ decision_reason: null }))).toBe(false);
  });

  test("flags flow through to the queue", () => {
    const result = reportToIncident(
      report({ decision_reason: "Escalated to BFP: x", sensor_mismatch: true }),
    );
    expect(result.escalated).toBe(true);
    expect(result.sensorMismatch).toBe(true);
    expect(result.hasPhoto).toBe(false);
    expect(result.tags).toContain("Escalated");
    expect(result.tags).toContain("Gauge disagrees");
  });

  test("a plain report with no flags matches only the All filter", () => {
    const result = reportToIncident(report({}));
    expect(
      (["photo", "sensor", "escalated"] as const).some((f) => matchesQueueFilter(result, f)),
    ).toBe(false);
  });
});
