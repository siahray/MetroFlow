import { expect, test } from "bun:test";

import { withRecentDestination, type RecentDestination } from "./recentDestinationsMerge";

function node(nodeId: number): RecentDestination {
  return { nodeId, name: `Node ${nodeId}`, latitude: 14.5 + nodeId, longitude: 121.0 + nodeId };
}

test("withRecentDestination puts the newest entry first", () => {
  expect(withRecentDestination([], node(1))).toEqual([node(1)]);
  expect(withRecentDestination([node(1)], node(2))).toEqual([node(2), node(1)]);
});

test("withRecentDestination moves a repeated destination to the front instead of duplicating it", () => {
  const result = withRecentDestination([node(1), node(2), node(3)], node(2));
  expect(result).toEqual([node(2), node(1), node(3)]);
});

test("withRecentDestination caps the list at 5 entries", () => {
  const start = [node(1), node(2), node(3), node(4), node(5)];
  const result = withRecentDestination(start, node(6));
  expect(result).toHaveLength(5);
  expect(result[0]).toEqual(node(6));
  // The oldest (last) entry is the one dropped to make room.
  expect(result.map((r) => r.nodeId)).not.toContain(5);
});
