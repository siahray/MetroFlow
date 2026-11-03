import { AlertCircle, RefreshCw } from "lucide-react";

/** Inline failure state with a retry, shared by every list that loads data. */
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"
    >
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded border border-rose-200 bg-white px-3 py-1.5 font-medium text-rose-700 hover:bg-rose-100"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Retry
        </button>
      )}
    </div>
  );
}

/** Shown while the browser reports no connection. */
export function OfflineBanner() {
  return (
    <div role="status" className="bg-amber-100 px-6 py-2 text-xs font-semibold text-amber-900">
      You are offline. Data shown may be out of date; it will refresh when the connection returns.
    </div>
  );
}
