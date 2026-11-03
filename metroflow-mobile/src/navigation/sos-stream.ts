import type { SOSInfo } from "../api";
import { apiUrl, getAuthToken } from "../api";

export type SOSStreamHandlers = {
  onSnapshot: (sosList: SOSInfo[]) => void;
  onSOS: (event: string, sos: SOSInfo) => void;
  onError?: (error: Error) => void;
};

type ParsedFrame = { id: number | null; event: string; data: string };

function parseFrame(raw: string): ParsedFrame | null {
  const lines = raw.split(/\r?\n/);
  let id: number | null = null;
  let event = "message";
  const data: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue; // heartbeat / comment
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "id") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) id = parsed;
    } else if (field === "event") {
      event = value;
    } else if (field === "data") {
      data.push(value);
    }
  }

  if (data.length === 0) return null;
  return { id, event, data: data.join("\n") };
}

/**
 * Subscribe to the SOS change feed (FSD-FR-086).
 *
 * React Native has no `EventSource`, and `fetch` responses are not exposed as a
 * readable stream, so this uses `XMLHttpRequest`: React Native delivers partial
 * `responseText` through `onprogress`, which is enough to parse SSE frames
 * incrementally. The bearer token travels in the header, never the query string
 * (SEC-007). Returns an unsubscribe function.
 */
export function subscribeToSOS(handlers: SOSStreamHandlers): () => void {
  let stopped = false;
  let xhr: XMLHttpRequest | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let lastEventId: number | null = null;
  let consumed = 0;
  let buffer = "";

  function scheduleReconnect() {
    if (stopped) return;
    reconnectTimer = setTimeout(connect, 1000);
  }

  function handleFrame(frame: ParsedFrame) {
    if (frame.id !== null) lastEventId = frame.id;

    let payload: unknown;
    try {
      payload = JSON.parse(frame.data);
    } catch {
      return;
    }

    if (frame.event === "snapshot") {
      const sosList = (payload as { sos_requests?: SOSInfo[] } | null)?.sos_requests;
      if (Array.isArray(sosList)) handlers.onSnapshot(sosList);
      return;
    }

    if (frame.event.startsWith("sos.")) {
      const sos = payload as SOSInfo | null;
      if (sos && typeof sos.sos_id === "number") {
        handlers.onSOS(frame.event, sos);
      }
    }
  }

  function drain() {
    if (!xhr) return;
    const text = xhr.responseText ?? "";
    if (text.length <= consumed) return;
    const chunk = text.slice(consumed);
    consumed = text.length;
    buffer += chunk;

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const frame = parseFrame(raw);
      if (frame) handleFrame(frame);
      boundary = buffer.indexOf("\n\n");
    }
  }

  function connect() {
    if (stopped) return;
    consumed = 0;
    buffer = "";

    const token = getAuthToken();
    if (!token) {
      handlers.onError?.(new Error("Sign in to receive live SOS updates."));
      return;
    }

    const request = new XMLHttpRequest();
    xhr = request;
    request.open("GET", apiUrl("/api/v1/sos/stream"), true);
    request.setRequestHeader("Accept", "text/event-stream");
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    if (lastEventId !== null) {
      request.setRequestHeader("Last-Event-ID", String(lastEventId));
    }

    request.onprogress = drain;
    request.onreadystatechange = () => {
      if (request.readyState === 3) drain();
    };
    request.onerror = scheduleReconnect;
    request.onload = () => {
      drain();
      if (stopped) return;
      if (request.status >= 400) {
        // Retrying a rejected stream only burns rate limit; the caller decides
        // what to show. A 401 means the session token is gone.
        handlers.onError?.(new Error(`SOS stream closed (${request.status}).`));
        return;
      }
      // The server bounds a stream at 45 s and then closes it cleanly.
      scheduleReconnect();
    };

    request.send();
  }

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    xhr?.abort();
    xhr = null;
  };
}
