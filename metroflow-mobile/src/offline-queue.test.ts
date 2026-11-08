import { describe, expect, test } from "bun:test";

import { ApiError } from "./api";
import { drainQueue, isPermanentRejection } from "./offline-queue";

/**
 * The offline queue's rule (FSD-FR-068, 069): oldest first, and a failure that
 * may succeed later stops the drain so nothing overtakes the item that failed.
 * The store and the HTTP call are faked here; `offline.ts` supplies the real ones.
 */

type Report = { seq: number; clientId: string };

/** Fake queue: `failFor` decides whether `send` rejects for a given client id. */
function harness(items: Report[], failFor: (report: Report) => unknown) {
  const queue = [...items];
  const sent: string[] = [];
  const removed: string[] = [];
  return {
    queue,
    sent,
    removed,
    options: {
      peek: async () => queue[0] ?? null,
      send: async (report: Report) => {
        const failure = failFor(report);
        if (failure) throw failure;
        sent.push(report.clientId);
      },
      remove: async (report: Report) => {
        queue.shift();
        removed.push(report.clientId);
      },
    },
  };
}

const reports: Report[] = [
  { seq: 1, clientId: "first" },
  { seq: 2, clientId: "second" },
  { seq: 3, clientId: "third" },
];

describe("drainQueue", () => {
  test("sends and removes oldest first until the queue is empty", async () => {
    const { sent, removed, queue, options } = harness(reports, () => null);

    await drainQueue(options);

    expect(sent).toEqual(["first", "second", "third"]);
    expect(removed).toEqual(["first", "second", "third"]);
    expect(queue).toEqual([]);
  });

  test("a network failure stops the drain and keeps the rest in order", async () => {
    const { sent, queue, options } = harness(reports, (report) =>
      report.clientId === "second" ? new TypeError("Failed to fetch") : null,
    );

    await drainQueue(options);

    expect(sent).toEqual(["first"]);
    expect(queue.map((report) => report.clientId)).toEqual(["second", "third"]);
  });

  test("a permanent 4xx drops that report and continues with the next", async () => {
    const { sent, removed, queue, options } = harness(reports, (report) =>
      report.clientId === "second" ? new ApiError(422, "invalid depth") : null,
    );

    await drainQueue(options);

    expect(sent).toEqual(["first", "third"]);
    expect(removed).toEqual(["first", "second", "third"]);
    expect(queue).toEqual([]);
  });

  test.each([401, 429])("a %i keeps the report queued", async (status) => {
    const { sent, queue, options } = harness(reports, (report) =>
      report.clientId === "first" ? new ApiError(status, "later") : null,
    );

    await drainQueue(options);

    expect(sent).toEqual([]);
    expect(queue).toHaveLength(3);
  });
});

describe("isPermanentRejection", () => {
  test("drops the 4xx the server will repeat", () => {
    expect(isPermanentRejection(new ApiError(400, "bad request"))).toBe(true);
    expect(isPermanentRejection(new ApiError(403, "forbidden"))).toBe(true);
    expect(isPermanentRejection(new ApiError(422, "invalid"))).toBe(true);
  });

  test("keeps what may succeed later", () => {
    expect(isPermanentRejection(new ApiError(401, "session expired"))).toBe(false);
    expect(isPermanentRejection(new ApiError(429, "slow down"))).toBe(false);
    expect(isPermanentRejection(new ApiError(500, "server"))).toBe(false);
    expect(isPermanentRejection(new TypeError("Failed to fetch"))).toBe(false);
  });
});
