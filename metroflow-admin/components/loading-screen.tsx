import { Waves } from "lucide-react";

/** Full-page splash shown while the session or a route's data is still resolving
 * (`AppShell`'s pre-session gap, and Next's route-level `loading.tsx` boundary) —
 * same wordmark/gradient treatment as `LoginScreen` so there's no flash of
 * unstyled blank page between them. */
export function LoadingScreen() {
  return (
    <div className="flex min-h-screen w-full animate-fade-in flex-col items-center justify-center gap-4 bg-slate-100">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-xl bg-sky-100" />
        <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-600 shadow-sm">
          <Waves className="h-6 w-6 text-sky-600" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold tracking-tight text-slate-900">MetroFlow Portal</p>
        <p className="text-xs text-slate-500">Loading operations console…</p>
      </div>
    </div>
  );
}
