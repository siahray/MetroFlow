/**
 * Portal session cache.
 *
 * `POST /api/v1/auth/login` returns a token and the user record. Both are kept
 * in `sessionStorage` for the browser session, so a reload keeps the operator
 * signed in and a closed tab signs them out. This module is the only place that
 * reads or writes those values, so the shell, the login screen and the pages all
 * agree on their shape.
 */

export type SessionUser = {
  user_id?: number;
  name?: string;
  email?: string;
  role?: string;
};

const USER_KEY = "metroflow_user";
const TOKEN_KEY = "metroflow_token";

function parseUser(raw: string | null): SessionUser | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as SessionUser) : null;
  } catch {
    // A corrupted value is treated as "signed out" rather than crashing.
    return null;
  }
}

let cachedRaw: string | null = null;
let cachedUser: SessionUser | null = null;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Snapshot for `useSyncExternalStore`. It must return the same object until the
 * stored value changes, otherwise React re-renders forever.
 */
export function getSessionUser(): SessionUser | null {
  const raw = typeof window === "undefined" ? null : sessionStorage.getItem(USER_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedUser = parseUser(raw);
  }
  return cachedUser;
}

/** The bearer token for the API, or `null` when signed out. */
export function getSessionToken(): string | null {
  return typeof window === "undefined" ? null : sessionStorage.getItem(TOKEN_KEY);
}

/** Session changes notify the shell so a rejected token can sign the user out. */
export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearSessionUser(): void {
  storeSessionUser(null);
}

export function storeSessionUser(user: SessionUser | null, token?: string | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else if (token === null) {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } else {
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }
  // Invalidate the snapshot so the next read reflects the write.
  cachedRaw = "\u0000";
  notify();
}
