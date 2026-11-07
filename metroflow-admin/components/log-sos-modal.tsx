"use client";

import { X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import type { SOSRequest } from "@/lib/dispatch";
import { CALL_IN_DEFAULT, createSOS, parseCallIn, type CallInForm } from "@/lib/sos-call";
import { useDialogFocus } from "./use-dialog-focus";

type LogSOSModalProps = {
  /** Called with the created incident; the caller closes and selects it. */
  onLogged: (sos: SOSRequest) => void;
  onClose: () => void;
};

const field =
  "w-full rounded-lg border bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none";

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
    <div className="fixed inset-0 z-50 flex animate-backdrop-in items-center justify-center bg-slate-900/50 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-sos-title"
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-md animate-modal-in space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="log-sos-title" className="text-base font-bold text-slate-900">
            Log a call-in distress signal
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="log-sos-latitude"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Latitude
            </label>
            <input
              id="log-sos-latitude"
              ref={first}
              inputMode="decimal"
              value={values.latitude}
              onChange={(e) => set("latitude")(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "log-sos-error" : undefined}
              className={`${field} ${error ? "border-rose-400" : "border-slate-200"}`}
            />
          </div>
          <div>
            <label
              htmlFor="log-sos-longitude"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Longitude
            </label>
            <input
              id="log-sos-longitude"
              inputMode="decimal"
              value={values.longitude}
              onChange={(e) => set("longitude")(e.target.value)}
              className={`${field} ${error ? "border-rose-400" : "border-slate-200"}`}
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Prefilled with the pilot area&apos;s centre. Replace it with the coordinates the caller
          gives; the incident appears on the live map as soon as it is saved.
        </p>

        <div>
          <label htmlFor="log-sos-note" className="mb-1 block text-xs font-semibold text-slate-700">
            What did the caller report? (optional)
          </label>
          <textarea
            id="log-sos-note"
            rows={3}
            value={values.note}
            onChange={(e) => set("note")(e.target.value)}
            placeholder="e.g. Two adults trapped on a roof, water still rising"
            className={`${field} border-slate-200`}
          />
        </div>

        {error ? (
          <p
            id="log-sos-error"
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            {error}
          </p>
        ) : null}
        {serverError ? (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            {serverError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Log incident"}
          </button>
        </div>
      </form>
    </div>
  );
}
