/**
 * Portal session cache.
 *
 * `POST /api/v1/auth/login` returns the user record and the token is kept in
 * `sessionStorage` for the browser session. This module is the only place that
 * reads or writes that value, so the shell, the login screen and the pages all
 * agree on its shape.
 */

export type SessionUser = {
  user_id?: number;
  name?: string;
  email?: string;
  role?: string;
};

const STORAGE_KEY = "metroflow_user";

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

/**
 * Snapshot for `useSyncExternalStore`. It must return the same object until the
 * stored value changes, otherwise React re-renders forever.
 */
export function getSessionUser(): SessionUser | null {
  const raw = typeof window === "undefined" ? null : sessionStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedUser = parseUser(raw);
  }
  return cachedUser;
}

/** Reads are pull-based; nothing pushes session updates across tabs. */
export function subscribeToSession(): () => void {
  return () => {};
}

export function clearSessionUser(): void {
  storeSessionUser(null);
}

export function storeSessionUser(user: SessionUser | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  // Invalidate the snapshot so the next read reflects the write.
  cachedRaw = "\u0000";
}
