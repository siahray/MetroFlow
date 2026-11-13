// Pure merge logic, split out so it can be unit-tested without pulling in
// offline.ts's expo-sqlite/react-native dependency chain (bun test cannot
// parse react-native's own source).

export type RecentDestination = {
  nodeId: number;
  name: string;
  latitude: number;
  longitude: number;
};

export const MAX_RECENT_DESTINATIONS = 5;

/** Newest first, no duplicate node, capped at MAX_RECENT_DESTINATIONS. */
export function withRecentDestination(
  current: RecentDestination[],
  entry: RecentDestination,
): RecentDestination[] {
  return [entry, ...current.filter((row) => row.nodeId !== entry.nodeId)].slice(
    0,
    MAX_RECENT_DESTINATIONS,
  );
}
