"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import type { VehicleInput } from "@/lib/dispatch";
import {
  EMPTY_UNIT_FORM,
  UNIT_STATUSES,
  UNIT_TYPES,
  validateUnitForm,
  type UnitFormErrors,
  type UnitFormValues,
} from "@/lib/fleet";

type UnitFormModalProps = {
  title: string;
  submitLabel: string;
  initial?: UnitFormValues;
  /** Rejects with the API's message, which is shown above the buttons. */
  onSubmit: (payload: VehicleInput) => Promise<void>;
  onClose: () => void;
};

const field =
  "w-full rounded-lg border bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none";

export function UnitFormModal({
  title,
  submitLabel,
  initial = EMPTY_UNIT_FORM,
  onSubmit,
  onClose,
}: UnitFormModalProps) {
  const [values, setValues] = useState<UnitFormValues>(initial);
  const [errors, setErrors] = useState<UnitFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const set = (key: keyof UnitFormValues) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const result = validateUnitForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setServerError(null);
    setSaving(true);
    try {
      await onSubmit(result.payload);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Could not save the unit.");
      setSaving(false);
    }
  }

  const errorText = (key: keyof UnitFormValues) =>
    errors[key] ? (
      <p id={`unit-${key}-error`} className="mt-1 text-[11px] text-rose-600">
        {errors[key]}
      </p>
    ) : null;
  const borders = (key: keyof UnitFormValues) =>
    errors[key] ? "border-rose-400" : "border-slate-200";

  return (
    <div className="fixed inset-0 z-50 flex animate-backdrop-in items-center justify-center bg-slate-900/50 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="unit-form-title"
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-md animate-modal-in space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="unit-form-title" className="text-base font-bold text-slate-900">
            {title}
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

        <div>
          <label
            htmlFor="unit-callSign"
            className="mb-1 block text-xs font-semibold text-slate-700"
          >
            Call sign
          </label>
          <input
            id="unit-callSign"
            ref={first}
            value={values.callSign}
            onChange={(e) => set("callSign")(e.target.value)}
            aria-invalid={Boolean(errors.callSign)}
            aria-describedby={errors.callSign ? "unit-callSign-error" : undefined}
            placeholder="e.g. RU-07"
            className={`${field} ${borders("callSign")}`}
          />
          {errorText("callSign")}
        </div>

        <div>
          <label
            htmlFor="unit-vehicleType"
            className="mb-1 block text-xs font-semibold text-slate-700"
          >
            Unit type
          </label>
          <input
            id="unit-vehicleType"
            list="unit-type-options"
            value={values.vehicleType}
            onChange={(e) => set("vehicleType")(e.target.value)}
            aria-invalid={Boolean(errors.vehicleType)}
            aria-describedby={errors.vehicleType ? "unit-vehicleType-error" : undefined}
            className={`${field} ${borders("vehicleType")}`}
          />
          <datalist id="unit-type-options">
            {UNIT_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
          {errorText("vehicleType")}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="unit-clearanceCm"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Ground clearance (cm)
            </label>
            <input
              id="unit-clearanceCm"
              inputMode="numeric"
              value={values.clearanceCm}
              onChange={(e) => set("clearanceCm")(e.target.value)}
              aria-invalid={Boolean(errors.clearanceCm)}
              aria-describedby={errors.clearanceCm ? "unit-clearanceCm-error" : undefined}
              className={`${field} ${borders("clearanceCm")}`}
            />
            {errorText("clearanceCm")}
          </div>
          <div>
            <label
              htmlFor="unit-status"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Status
            </label>
            <select
              id="unit-status"
              value={values.status}
              onChange={(e) => set("status")(e.target.value)}
              className={`${field} border-slate-200`}
            >
              {/* A unit on a live dispatch shows DISPATCHED; it is set by the dispatch flow. */}
              {!UNIT_STATUSES.some((s) => s.id === values.status) && (
                <option value={values.status}>{values.status}</option>
              )}
              {UNIT_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="unit-latitude"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Latitude (optional)
            </label>
            <input
              id="unit-latitude"
              inputMode="decimal"
              value={values.latitude}
              onChange={(e) => set("latitude")(e.target.value)}
              aria-invalid={Boolean(errors.latitude)}
              aria-describedby={errors.latitude ? "unit-latitude-error" : undefined}
              className={`${field} ${borders("latitude")}`}
            />
            {errorText("latitude")}
          </div>
          <div>
            <label
              htmlFor="unit-longitude"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Longitude (optional)
            </label>
            <input
              id="unit-longitude"
              inputMode="decimal"
              value={values.longitude}
              onChange={(e) => set("longitude")(e.target.value)}
              aria-invalid={Boolean(errors.longitude)}
              aria-describedby={errors.longitude ? "unit-longitude-error" : undefined}
              className={`${field} ${borders("longitude")}`}
            />
            {errorText("longitude")}
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          A starting position lets dispatch rank the unit by travel time. A unit that reports its
          own position updates it later.
        </p>

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
            {saving ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
