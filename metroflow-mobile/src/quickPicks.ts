import { loadCache, saveCache } from "./offline";

// Saved shortcuts to named nodes on the road graph (not arbitrary addresses —
// the routing engine only knows the seeded network). Stored on-device only.

export type QuickPickIcon = "home" | "work" | "gym" | "mall" | "hospital" | "other";

export type QuickPick = {
  id: string;
  name: string;
  nodeId: number;
  latitude: number;
  longitude: number;
  icon: QuickPickIcon;
};

const KEY = "quick_picks";

export async function listQuickPicks(): Promise<QuickPick[]> {
  return (await loadCache<QuickPick[]>(KEY)) ?? [];
}

export async function saveQuickPicks(picks: QuickPick[]): Promise<void> {
  await saveCache(KEY, picks);
}
