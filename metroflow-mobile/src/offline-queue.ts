// Queue policy for offline reports (FSD-FR-068, 069), kept free of React Native
// imports so the ordering rule can be tested without a device.
import { ApiError } from "./api";

/**
 * A rejection the server will repeat: a 4xx that is not about the connection
 * (401 session expired, 429 rate limited) or missing credentials. Those keep the
 * report queued; every other 4xx would fail again, so the queue drops it.
 */
export function isPermanentRejection(cause: unknown): boolean {
  return (
    cause instanceof ApiError &&
    cause.status >= 400 &&
    cause.status < 500 &&
    cause.status !== 401 &&
    cause.status !== 429
  );
}

export type DrainQueueOptions<T> = {
  /** Oldest queued item, or null when the queue is empty. */
  peek: () => Promise<T | null>;
  send: (item: T) => Promise<void>;
  remove: (item: T) => Promise<void>;
  /** Overridable for tests; defaults to {@link isPermanentRejection}. */
  isPermanent?: (cause: unknown) => boolean;
};

/**
 * Send queued items oldest first. Stops at the first failure that may succeed
 * later, so submission order is kept; a permanent rejection drops the item and
 * the queue moves on instead of blocking forever.
 */
export async function drainQueue<T>({
  peek,
  send,
  remove,
  isPermanent = isPermanentRejection,
}: DrainQueueOptions<T>): Promise<void> {
  for (let item = await peek(); item !== null; item = await peek()) {
    try {
      await send(item);
    } catch (cause) {
      if (!isPermanent(cause)) return;
    }
    await remove(item);
  }
}
