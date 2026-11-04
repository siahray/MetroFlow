import { describe, expect, test } from "bun:test";

import { mergeStreamEvent, type StreamEvent } from "./live-stream";

type Row = { sos_id: number; status: string };

const idOf = (row: Row) => row.sos_id;
const active = (row: Row) => row.status.toUpperCase() !== "RESOLVED";

function frame(type: string | null, data: unknown): StreamEvent {
  return { id: 1, type, data };
}

const sos: Row[] = [
  { sos_id: 1, status: "pending" },
  { sos_id: 2, status: "assigned" },
];

describe("mergeStreamEvent", () => {
  test("a snapshot replaces the list", () => {
    const next = mergeStreamEvent(
      sos,
      frame("snapshot", { sos: [{ sos_id: 9, status: "pending" }] }),
      "sos",
      idOf,
      active,
    );
    expect(next).toEqual([{ sos_id: 9, status: "pending" }]);
  });

  test("a change updates one row and keeps the rest", () => {
    const next = mergeStreamEvent(
      sos,
      frame("sos.updated", { sos_id: 1, status: "confirmed" }),
      "sos",
      idOf,
      active,
    );
    expect(next).toEqual([
      { sos_id: 2, status: "assigned" },
      { sos_id: 1, status: "confirmed" },
    ]);
  });

  test("a resolved row leaves the list", () => {
    const next = mergeStreamEvent(
      sos,
      frame("sos.updated", { sos_id: 2, status: "resolved" }),
      "sos",
      idOf,
      active,
    );
    expect(next).toEqual([{ sos_id: 1, status: "pending" }]);
  });

  test("a frame that is not about the list changes nothing", () => {
    expect(mergeStreamEvent(sos, frame("heartbeat", "ok"), "sos", idOf, active)).toBeNull();
  });
});
