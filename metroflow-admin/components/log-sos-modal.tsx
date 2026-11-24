"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import type { SOSRequest } from "@/lib/dispatch";
import { searchPlaces, type PlaceResult } from "@/lib/nearby-place";
import { CALL_IN_DEFAULT, createSOS, parseCallIn, type CallInForm } from "@/lib/sos-call";
import { LocationPickerMap } from "./location-picker-map";
import { useDialogFocus } from "./use-dialog-focus";

type LogSOSModalProps = {
  /** Called with the created incident; the caller closes and selects it. */
  onLogged: (sos: SOSRequest) => void;
  onClose: () => void;
};

const field =
  "w-full rounded-lg border bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-500";

/**
 * Dispatcher entry for a distress call that arrived by telephone, so a caller
 * who cannot use the app still reaches the queue and the map (FSD-FR-087).
 */
export function LogSOSModal({ onLogged, onClose }: LogSOSModalProps) {
  const [values, setValues] = useState<CallInForm>(CALL_IN_DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useDialogFocus(first, onClose, saving);

  const set = (key: keyof CallInForm) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const setCoordinates = (latitude: number, longitude: number) =>
    setValues((current) => ({
      ...current,
      latitude: latitude.toFixed(5),
      longitude: longitude.toFixed(5),
    }));

  // Address search (FSD-FR-087): a dispatcher finds the caller's location by
  // name instead of typing raw coordinates. Debounced and cancellable so a
  // fast typist never races an older query past a newer one.
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!searchOpen || q.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      searchPlaces(q, controller.signal)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchOpen]);

  // Derived so a short query hides stale results without a synchronous
  // setState in the effect above.
  const showResults = searchOpen && query.trim().length >= 3;

  useEffect(() => {
    if (!searchOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [searchOpen]);

  function pickResult(result: PlaceResult) {
    setCoordinates(result.latitude, result.longitude);
    setQuery(result.label);
    setSearchOpen(false);
    setResults([]);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const parsed = parseCallIn(values);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setServerError(null);
    setSaving(true);
    try {
      onLogged(await createSOS(parsed.payload));
    } catch (cause) {
      setServerError(cause instanceof Error ? cause.message : "Could not record the call.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-backdrop-in items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md dark:bg-black/80">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-sos-title"
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-lg animate-modal-in space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)] ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10 dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.75)]"
      >
        <div className="flex items-center justify-between">
          <h2 id="log-sos-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
            Log a call-in distress signal
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={searchBoxRef} className="relative">
          <label
            htmlFor="log-sos-location-search"
            className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Location
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              id="log-sos-location-search"
              ref={first}
              type="text"
              role="combobox"
              aria-expanded={searchOpen}
              aria-controls="log-sos-location-results"
              aria-autocomplete="list"
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchOpen(false);
              }}
              placeholder="Search an address or place…"
              className={`${field} border-slate-200 pl-8 dark:border-slate-700`}
            />
          </div>
          {showResults ? (
            <ul
              id="log-sos-location-results"
              role="listbox"
              className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
            >
              {searching ? (
                <li className="px-3 py-1.5 text-[11px] text-slate-400">Searching…</li>
              ) : results.length === 0 ? (
                <li className="px-3 py-1.5 text-[11px] text-slate-400">No matches</li>
              ) : (
                results.map((result) => (
                  <li key={`${result.latitude},${result.longitude}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => pickResult(result)}
                      className="block w-full truncate px-3 py-1.5 text-left text-[11px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {result.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>

        <LocationPickerMap
          latitude={Number(values.latitude)}
          longitude={Number(values.longitude)}
          onChange={setCoordinates}
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400" aria-live="polite">
          Pinned at {Number(values.latitude).toFixed(4)}°, {Number(values.longitude).toFixed(4)}°.
          Search an address or drag the pin to match the caller; the incident appears on the live
          map as soon as it is saved.
        </p>

        <div>
          <label
            htmlFor="log-sos-note"
            className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            What did the caller report? (optional)
          </label>
          <textarea
            id="log-sos-note"
            rows={3}
            value={values.note}
            onChange={(e) => set("note")(e.target.value)}
            placeholder="e.g. Two adults trapped on a roof, water still rising"
            className={`${field} border-slate-200 dark:border-slate-700`}
          />
        </div>

        {error ? (
          <p
            id="log-sos-error"
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
          >
            {error}
          </p>
        ) : null}
        {serverError ? (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
          >
            {serverError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            {saving ? "Saving…" : "Log incident"}
          </button>
        </div>
      </form>
    </div>
  );
}
