/**
 * Portal session cache.
 *
 * `POST /api/v1/auth/login` returns a token and the user record. Both are kept
 * in `localStorage` so a reload or a reopened browser keeps the operator signed
 * in until they sign out, or until they have been inactive for 15 minutes.
 * This module is the only place that reads or writes those values, so the shell,
 * the login screen and the pages all agree on their shape.
 */

export type SessionUser = {
  user_id?: number;
  name?: string;
  email?: string;
  role?: string;
};

const USER_KEY = "metroflow_user";
const TOKEN_KEY = "metroflow_token";
const LAST_ACTIVE_KEY = "metroflow_last_active";

/** An operator who has done nothing for this long is signed out. */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

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

/** True when the stored session is older than the idle limit (or has no stamp). */
function isIdleExpired(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(LAST_ACTIVE_KEY);
  if (!raw) return true;
  const lastActive = Number(raw);
  return !Number.isFinite(lastActive) || Date.now() - lastActive > IDLE_TIMEOUT_MS;
}

function removeStored(): void {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LAST_ACTIVE_KEY);
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
  const raw = typeof window === "undefined" ? null : localStorage.getItem(USER_KEY);
  if (raw && isIdleExpired()) {
    removeStored();
    cachedRaw = null;
    cachedUser = null;
    return null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedUser = parseUser(raw);
  }
  return cachedUser;
}

/** The bearer token for the API, or `null` when signed out or idle. */
export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  if (isIdleExpired()) return null;
  return localStorage.getItem(TOKEN_KEY);
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
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else if (token === null) {
      localStorage.removeItem(TOKEN_KEY);
    }
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } else {
    removeStored();
  }
  // Invalidate the snapshot so the next read reflects the write.
  cachedRaw = "\u0000";
  notify();
}

/** Record operator activity, at most once every 10 seconds. */
export function touchSession(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(USER_KEY)) return;
  localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
}

/**
 * Sign the operator out after 15 minutes without pointer or keyboard input.
 *
 * Mounted by the shell. A reload after the idle limit is handled by
 * `getSessionUser`, which drops the stale session on first read.
 */
export function startSessionWatch(): () => void {
  if (typeof window === "undefined") return () => {};

  let lastTouch = 0;
  const onActivity = () => {
    const now = Date.now();
    if (now - lastTouch < 10_000) return;
    lastTouch = now;
    touchSession();
  };

  const timer = window.setInterval(() => {
    if (localStorage.getItem(USER_KEY) && isIdleExpired()) clearSessionUser();
  }, 30_000);

  // Another tab signing out ends this tab's session too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === USER_KEY || event.key === TOKEN_KEY || event.key === null) {
      cachedRaw = "\u0000";
      notify();
    }
  };

  for (const type of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(type, onActivity, { passive: true });
  }
  window.addEventListener("storage", onStorage);

  return () => {
    window.clearInterval(timer);
    for (const type of ["pointerdown", "keydown", "touchstart"]) {
      window.removeEventListener(type, onActivity);
    }
    window.removeEventListener("storage", onStorage);
  };
}
