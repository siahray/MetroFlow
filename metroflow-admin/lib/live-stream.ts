import type { SOSRequest, Vehicle } from "./dispatch";
import type { HazardZone } from "./hazards";
import { clearSessionUser, getSessionToken } from "./session";

/**
 * The portal's change feeds (FSD-FR-085, FSD-FR-086).
 *
 * `EventSource` cannot attach an `Authorization` header, and this API takes the
 * bearer token and nothing else — no query-string tokens, because those end up in
 * access logs. So the stream is read with `fetch` and the SSE framing is parsed
 * here. The same reason the map layer cannot use an `<img>` for report evidence.
 *
 * The server ends every stream after about 45 seconds on purpose (a serverless
 * function cannot hold the socket open indefinitely). That is not an error: this
 * reconnects and sends the last id it saw as `Last-Event-ID`, so a change made
 * during the gap arrives on the next connection instead of being lost.
 *
 * Each subscriber hands back the whole list rather than one frame: a snapshot
 * replaces the list and a single change is merged in by id, so a caller cannot
 * accidentally drop the rest of the fleet with one position update.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/** What the server itself uses when it does not send a `retry:` hint. */
const RECONNECT_MS = 3000;

export type StreamEvent = {
  /** The event id, or null for a comment or a malformed frame. */
  id: number | null;
  /** `snapshot`, or a change such as `sos.updated`. */
  type: string | null;
  /** The parsed `data:` payload, as the REST endpoint would return it. */
  data: unknown;
};

class StreamError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "StreamError";
    this.status = status;
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    signal.addEventListener("abort", finish, { once: true });
  });
}

/**
 * One SSE frame. `fields` keeps repeated `data:` lines ordered, which the spec
 * joins with a newline before the client parses the payload.
 */
type Frame = { id: number | null; type: string | null; data: string | null };

function parseFrame(block: string): Frame | null {
  let id: number | null = null;
  let type: string | null = null;
  const data: string[] = [];

  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const raw = colon === -1 ? "" : line.slice(colon + 1);
    const value = raw.startsWith(" ") ? raw.slice(1) : raw;

    if (field === "id") {
      const parsed = Number.parseInt(value, 10);
      id = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    } else if (field === "event") {
      type = value;
    } else if (field === "data") {
      data.push(value);
    }
  }

  if (data.length === 0) return null;
  return { id, type, data: data.join("\n") };
}

/**
 * Read one connection to the end, handing each event to `onEvent`, and return
 * the newest id seen so the caller can resume from it.
 */
async function readStream(
  path: string,
  cursor: number | null,
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal,
): Promise<number | null> {
  const token = getSessionToken();
  const headers = new Headers({ Accept: "text/event-stream" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (cursor !== null) headers.set("Last-Event-ID", String(cursor));

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    cache: "no-store",
    signal,
  });

  if (response.status === 401) {
    clearSessionUser();
  }
  if (!response.ok || !response.body) {
    throw new StreamError(response.status, `${path} failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let newest = cursor;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Frames end with a blank line. Normalise CRLF so a proxy that rewrites
      // line endings cannot merge two frames into one.
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const frame = parseFrame(block);
        if (frame && frame.data !== null) {
          let payload: unknown = frame.data;
          try {
            payload = JSON.parse(frame.data);
          } catch {
            // A frame without JSON is still a change signal; keep the text so a
            // listener can refetch rather than dropping the notification.
          }
          if (frame.id !== null) newest = frame.id;
          onEvent({ id: frame.id, type: frame.type, data: payload });
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    // Closing the reader cancels the body; without it an aborted fetch can leave
    // the connection counted against the browser's per-host limit.
    await reader.cancel().catch(() => {});
  }

  return newest;
}

/**
 * The list after one frame, or null when the frame says nothing about it.
 *
 * A snapshot replaces the list; a single change replaces the row with the same
 * id, or removes it when the row no longer belongs (a resolved SOS, a withdrawn
 * hazard). Exported so the merge can be tested without a network.
 */
export function mergeStreamEvent<T>(
  rows: T[],
  event: StreamEvent,
  snapshotKey: string,
  idOf: (row: T) => number,
  keep: (row: T) => boolean,
): T[] | null {
  if (event.type === "snapshot") {
    const payload = event.data as Record<string, unknown> | null;
    const list = payload?.[snapshotKey];
    return Array.isArray(list) ? (list as T[]).filter(keep) : [];
  }
  if (!event.data || typeof event.data !== "object") return null;
  const incoming = event.data as T;
  const next = rows.filter((row) => idOf(row) !== idOf(incoming));
  if (keep(incoming)) next.push(incoming);
  return next;
}

/**
 * Follow one change feed until `signal` aborts, reconnecting after each bounded
 * stream and after any transient failure. `onRows` sees the full list every
 * time, so a caller cannot be left with a fleet of one after a single update.
 *
 * The promise resolves only when aborted; callers should not await it in render.
 */
async function subscribe<T>(
  path: string,
  snapshotKey: string,
  idOf: (row: T) => number,
  keep: (row: T) => boolean,
  onRows: (rows: T[]) => void,
  signal: AbortSignal,
): Promise<void> {
  let cursor: number | null = null;
  let rows: T[] = [];

  const apply = (event: StreamEvent) => {
    const next = mergeStreamEvent(rows, event, snapshotKey, idOf, keep);
    if (next === null) return;
    rows = next;
    onRows(rows);
  };

  while (!signal.aborted) {
    try {
      cursor = await readStream(path, cursor, apply, signal);
    } catch {
      if (signal.aborted) break;
      // A 401 already cleared the session, and a dropped connection is normal
      // for a bounded stream; both wait before retrying so a downed API is not
      // hammered by every open portal tab.
    }
    if (signal.aborted) break;
    await sleep(RECONNECT_MS, signal);
  }
}

/** Hazard changes; withdrawn hazards leave the list. Any account may subscribe. */
export function subscribeToHazards(
  onRows: (rows: HazardZone[]) => void,
  signal: AbortSignal,
): Promise<void> {
  return subscribe<HazardZone>(
    "/api/v1/hazards/stream",
    "hazards",
    (row) => row.hazard_id,
    (row) => row.active !== false,
    onRows,
    signal,
  );
}

/** SOS creation, assignment and closing. Closed incidents leave the queue. */
export function subscribeToSOS(
  onRows: (rows: SOSRequest[]) => void,
  signal: AbortSignal,
): Promise<void> {
  return subscribe<SOSRequest>(
    "/api/v1/sos/stream",
    "sos",
    (row) => row.sos_id,
    (row) => row.status.toUpperCase() !== "RESOLVED",
    onRows,
    signal,
  );
}

/** Fleet status and telemetry. */
export function subscribeToVehicles(
  onRows: (rows: Vehicle[]) => void,
  signal: AbortSignal,
): Promise<void> {
  return subscribe<Vehicle>(
    "/api/v1/vehicles/stream",
    "vehicles",
    (row) => row.vehicle_id,
    () => true,
    onRows,
    signal,
  );
}
