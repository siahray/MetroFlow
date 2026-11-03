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

export async function enqueueReport(report: QueuedReport): Promise<void> {
  await (await db()).runAsync("INSERT INTO report_queue (payload) VALUES (?)", JSON.stringify(report));
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
      try {
        await submitReport(queue[0]);
      } catch (cause) {
        const permanent =
          cause instanceof ApiError &&
          cause.status >= 400 &&
          cause.status < 500 &&
          cause.status !== 401 &&
          cause.status !== 429;
        if (!permanent) return;
      }
      await (await db()).runAsync("DELETE FROM report_queue WHERE seq = ?", queue[0].seq);
      notify();
    }
  } finally {
    flushing = false;
  }
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
    return () => {
      listeners.delete(refresh);
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return count;
}
