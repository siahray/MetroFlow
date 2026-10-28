import { clearSessionUser, getSessionToken } from "./session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/**
 * An API failure carrying the HTTP status, so a caller can tell "the rate limit
 * stopped me" from "the token expired" without parsing a message.
 */
export class ApiError extends Error {
  status: number;
  retryAfterSeconds: number | null;

  constructor(status: number, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Read the failure as a message a dispatcher can act on.
 *
 * FastAPI answers with `{"detail": "..."}` for a refused request and with
 * `{"detail": [{loc, msg}]}` for a validation error; a gateway in front of the
 * API may answer with HTML or nothing at all. Showing the raw body meant an
 * operator saw a JSON blob, so this unwraps the common shapes and always falls
 * back to the status code.
 */
export async function readErrorMessage(res: Response): Promise<string> {
  const retryAfter = parseRetryAfter(res);

  if (res.status === 429) {
    return retryAfter === null
      ? "Too many requests. Please wait a moment and try again."
      : `Too many requests. Try again in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.`;
  }

  const body = await res.text().catch(() => "");
  if (body) {
    try {
      const parsed: unknown = JSON.parse(body);
      const detail = (parsed as { detail?: unknown } | null)?.detail;
      if (typeof detail === "string" && detail.trim()) return detail;
      if (Array.isArray(detail)) {
        const messages = detail
          .map((entry) => (entry as { msg?: unknown } | null)?.msg)
          .filter((msg): msg is string => typeof msg === "string" && msg.length > 0);
        if (messages.length) return messages.join("; ");
      }
    } catch {
      // Not JSON: a proxy page or a plain-text error. Returned as-is below.
    }
    return body;
  }

  return `Request failed: ${res.status}`;
}

function parseRetryAfter(res: Response): number | null {
  const raw = res.headers.get("Retry-After");
  if (!raw) return null;
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/**
 * Fetch with the operator's bearer token attached.
 *
 * Every route except the auth entry points requires a token (TSD LIM-022), so
 * this is the single place the portal adds it. A 401 means the token expired or
 * the account changed: the session is cleared, which signs the shell out.
 */
export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getSessionToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (res.status === 401) {
    clearSessionUser();
  }
  if (!res.ok) {
    throw new ApiError(res.status, await readErrorMessage(res), parseRetryAfter(res));
  }
  return res.json() as Promise<T>;
}
