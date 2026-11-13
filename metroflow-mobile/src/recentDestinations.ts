import { loadCache, saveCache } from "./offline";
import { withRecentDestination, type RecentDestination } from "./recentDestinationsMerge";

export type { RecentDestination } from "./recentDestinationsMerge";

// Last-routed-to road nodes, most recent first (Google-Maps-style "Recent"
// row under the search box). Stored on-device only, same mechanism as
// Quick Picks (quickPicks.ts).

const KEY = "recent_destinations";

export async function listRecentDestinations(): Promise<RecentDestination[]> {
  return (await loadCache<RecentDestination[]>(KEY)) ?? [];
}

export async function addRecentDestination(entry: RecentDestination): Promise<void> {
  await saveCache(KEY, withRecentDestination(await listRecentDestinations(), entry));
}
