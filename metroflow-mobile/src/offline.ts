import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { Directory, File, Paths } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { ApiError, submitReport, type ReportDepth, type ReportPhoto } from "./api";

// Offline operation (FSD-FR-068 to 071): an ordered report queue and a local
// copy of the graph, hazards and last route.

// On-device SQLite: `cache` holds the graph, hazards and last route as JSON;
// `report_queue` is ordered by its autoincrement `seq`.
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function db(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= SQLite.openDatabaseAsync("metroflow.db").then(async (d) => {
    await d.execAsync(`
      CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS report_queue (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL
      );`);
    return d;
  });
  return dbPromise;
}

export type QueuedReport = {
  clientId: string;
  depthLevel: ReportDepth;
  latitude: number;
  longitude: number;
  narrative?: string | null;
  barangay?: string | null;
  capturedAt?: string | null;
  photo?: ReportPhoto | null;
};

// --- Cache (FSD-FR-070) ----------------------------------------------------

export async function saveCache(key: string, value: unknown): Promise<void> {
  try {
    await (await db()).runAsync(
      "INSERT OR REPLACE INTO cache (key, value) VALUES (?, ?)",
      key,
      JSON.stringify(value),
    );
  } catch {
    // A full or unavailable store must never break the online path.
  }
}

export async function loadCache<T>(key: string): Promise<T | null> {
  try {
    const row = await (await db()).getFirstAsync<{ value: string }>(
      "SELECT value FROM cache WHERE key = ?",
      key,
    );
    return row ? (JSON.parse(row.value) as T) : null;
  } catch {
    return null;
  }
}

export type CacheStats = {
  /** The last road graph is stored, so a route can be planned offline. */
  network: boolean;
  hazards: number;
  /** The last planned route, drawn as soon as the app opens without a network. */
  hasRoute: boolean;
  bytes: number;
};

/** What is actually on disk, for the Offline Data screen (FSD-FR-070). */
export async function cacheStats(): Promise<CacheStats> {
  try {
    const rows = await (await db()).getAllAsync<{ key: string; bytes: number }>(
      "SELECT key, length(CAST(value AS BLOB)) AS bytes FROM cache",
    );
    const keys = new Set(rows.map((row) => row.key));
    return {
      network: keys.has("network"),
      hazards: keys.has("hazards") ? ((await loadCache<unknown[]>("hazards"))?.length ?? 0) : 0,
      hasRoute: keys.has("route"),
      bytes: rows.reduce((total, row) => total + (row.bytes ?? 0), 0),
    };
  } catch {
    return { network: false, hazards: 0, hasRoute: false, bytes: 0 };
  }
}

/** Human-readable size for the cached data; the store is small, so KB is enough. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Report queue (FSD-FR-068, 069) -----------------------------------------

async function readQueue(): Promise<(QueuedReport & { seq: number })[]> {
  try {
    const rows = await (await db()).getAllAsync<{ seq: number; payload: string }>(
      "SELECT seq, payload FROM report_queue ORDER BY seq",
    );
    return rows.map((r) => ({ ...(JSON.parse(r.payload) as QueuedReport), seq: r.seq }));
  } catch {
    return [];
  }
}

/** A random v4 id; the server uses it to store a replayed report once. */
export function newClientId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// --- Queued photos ---------------------------------------------------------
// The picker returns a cache file the OS may clear before the queue syncs, so a
// queued photo is copied into app document storage and removed once it is sent.

const photoDir = () => new Directory(Paths.document, "queued-reports");

/** Copy the photo into document storage; on any failure keep the original reference. */
function persistPhoto(photo: ReportPhoto, clientId: string): ReportPhoto {
  try {
    const dir = photoDir();
    if (!dir.exists) dir.create();
    const dest = new File(dir, `${clientId}-${photo.name}`);
    new File(photo.uri).copy(dest, { overwrite: true });
    return { ...photo, uri: dest.uri };
  } catch {
    return photo;
  }
}

/** Delete a persisted copy; never touches a file outside our own queue folder. */
function discardPhoto(photo?: ReportPhoto | null): void {
  try {
    if (photo && photo.uri.startsWith(photoDir().uri)) new File(photo.uri).delete();
  } catch {
    // Already gone.
  }
}

function photoExists(photo: ReportPhoto): boolean {
  try {
    return new File(photo.uri).exists;
  } catch {
    return false;
  }
}

export async function enqueueReport(report: QueuedReport): Promise<void> {
  const stored = report.photo ? { ...report, photo: persistPhoto(report.photo, report.clientId) } : report;
  await (await db()).runAsync("INSERT INTO report_queue (payload) VALUES (?)", JSON.stringify(stored));
  notify();
}

let flushing = false;

/**
 * Send queued reports oldest first. Stops at the first network failure so order
 * is kept. A rejection the server will repeat (4xx other than 401/429) drops the
 * report rather than blocking the queue forever.
 */
export async function flushReports(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    for (let queue = await readQueue(); queue.length > 0; queue = await readQueue()) {
      const next = queue[0];
      try {
        // A photo the OS removed must not block the queue: send the report without it.
        await submitReport(next.photo && !photoExists(next.photo) ? { ...next, photo: null } : next);
      } catch (cause) {
        const permanent =
          cause instanceof ApiError &&
          cause.status >= 400 &&
          cause.status < 500 &&
          cause.status !== 401 &&
          cause.status !== 429;
        if (!permanent) return;
      }
      await (await db()).runAsync("DELETE FROM report_queue WHERE seq = ?", next.seq);
      discardPhoto(next.photo);
      notify();
    }
  } finally {
    flushing = false;
  }
}

// --- Connectivity ------------------------------------------------------------

/** Unknown (null) counts as online: only an explicit "no" blocks a request. */
const reachable = (s: NetInfoState) => s.isConnected !== false && s.isInternetReachable !== false;

/** True when the device reports no usable connection, so we need not wait for a request to time out. */
export async function isOffline(): Promise<boolean> {
  return !reachable(await NetInfo.fetch());
}

/** Live connectivity for UI that shows an online/offline state. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(reachable(s))), []);
  return online;
}

// --- Pending state (FSD-FR-068) ---------------------------------------------

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

/** Number of reports waiting to sync; retries on launch, foreground and a timer. */
export function usePendingReports(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => void readQueue().then((q) => setCount(q.length));
    const retry = () => void flushReports().then(refresh);
    listeners.add(refresh);
    retry();
    const timer = setInterval(retry, 30_000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && retry());
    // Sync as soon as the connection returns instead of waiting for the next tick.
    const unsubscribeNet = NetInfo.addEventListener((s) => reachable(s) && retry());
    return () => {
      unsubscribeNet();
      listeners.delete(refresh);
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return count;
}
