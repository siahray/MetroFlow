"use client";

import { AlertTriangle, Edit, Gauge, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api";
import {
  createSensor,
  deleteSensor,
  EMPTY_SENSOR_FORM,
  listSensors,
  sensorToForm,
  updateSensor,
  validateSensorForm,
  type Sensor,
  type SensorFormValues,
} from "@/lib/sensors";
import { useToast } from "./toast-provider";
import { ErrorNotice } from "./error-notice";
import { Skeleton } from "./skeleton";

function formatReading(sensor: Sensor): string {
  if (sensor.last_value == null) return "No readings yet";
  const unit = sensor.threshold_unit === "m" ? "m" : "mm/hr";
  return `${sensor.last_value} ${unit}`;
}

export function SensorManagement() {
  const { show } = useToast();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSensor, setEditingSensor] = useState<Sensor | null>(null);
  const [form, setForm] = useState<SensorFormValues>(EMPTY_SENSOR_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSensors = async () => {
    try {
      setSensors(await listSensors(false));
      setLoadError(null);
    } catch (cause) {
      setLoadError(
        cause instanceof ApiError
          ? cause.message
          : "Could not load sensors. Check your connection and retry.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setSensors(await listSensors(false));
        setLoadError(null);
      } catch (cause) {
        setLoadError(
          cause instanceof ApiError
            ? cause.message
            : "Could not load sensors. Check your connection and retry.",
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const closeModal = () => {
    setIsCreateOpen(false);
    setEditingSensor(null);
    setForm(EMPTY_SENSOR_FORM);
    setFormErrors({});
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateSensorForm(form);
    if (!result.ok) {
      setFormErrors(result.errors);
      return;
    }
    setFormErrors({});
    setIsSubmitting(true);
    try {
      if (editingSensor) {
        await updateSensor(editingSensor.sensor_id, {
          name: result.payload.name,
          latitude: result.payload.latitude,
          longitude: result.payload.longitude,
          threshold_value: result.payload.threshold_value,
          threshold_unit: result.payload.threshold_unit,
          impact_radius_m: result.payload.impact_radius_m,
        });
        show(`Sensor ${result.payload.sensor_id} updated`);
      } else {
        await createSensor(result.payload);
        show(`Sensor ${result.payload.sensor_id} created`);
      }
      closeModal();
      await loadSensors();
    } catch (cause) {
      show(cause instanceof ApiError ? cause.message : "Failed to save the sensor");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(sensor: Sensor) {
    if (!confirm(`Remove sensor "${sensor.name}" (${sensor.sensor_id})? This cannot be undone.`))
      return;
    try {
      await deleteSensor(sensor.sensor_id);
      show(`Sensor ${sensor.sensor_id} removed`);
      await loadSensors();
    } catch (cause) {
      show(cause instanceof ApiError ? cause.message : "Failed to remove the sensor");
    }
  }

  async function handleToggleActive(sensor: Sensor) {
    try {
      await updateSensor(sensor.sensor_id, { active: !sensor.active });
      await loadSensors();
    } catch (cause) {
      show(cause instanceof ApiError ? cause.message : "Failed to update the sensor");
    }
  }

  const filtered = sensors.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sensor_id.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {loadError && <ErrorNotice message={loadError} onRetry={loadSensors} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Sensor Registry</h2>
          <p className="text-sm text-slate-500">
            River and rain gauges feeding live flood advisories (FSD-FR-090, FR-091)
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add Sensor
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search sensors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Gauge className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">No sensors found</p>
          <p className="text-xs text-slate-500">Add a river or rain gauge to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((sensor) => (
            <div
              key={sensor.sensor_id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-bold text-slate-900">{sensor.sensor_id}</p>
                  <p className="text-xs text-slate-500">{sensor.name}</p>
                </div>
                {sensor.last_flagged ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                    <AlertTriangle className="h-3 w-3" /> BREACH
                  </span>
                ) : (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold",
                      sensor.active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {sensor.active ? "ACTIVE" : "DISABLED"}
                  </span>
                )}
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="text-slate-400 uppercase">Threshold</p>
                  <p className="font-semibold text-slate-800">
                    {sensor.threshold_value} {sensor.threshold_unit === "m" ? "m" : "mm/hr"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 uppercase">Last reading</p>
                  <p className="font-semibold text-slate-800">{formatReading(sensor)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingSensor(sensor);
                    setForm(sensorToForm(sensor));
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Edit className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={() => void handleToggleActive(sensor)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {sensor.active ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => void handleDelete(sensor)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(isCreateOpen || editingSensor) && (
        <div className="fixed inset-0 z-50 flex animate-backdrop-in items-center justify-center bg-black/50">
          <div className="w-full max-w-md animate-modal-in rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-bold text-slate-900">
              {editingSensor ? `Edit ${editingSensor.sensor_id}` : "Add Sensor"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingSensor ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Sensor ID
                  </label>
                  <input
                    type="text"
                    value={form.sensorId}
                    onChange={(e) => setForm({ ...form, sensorId: e.target.value })}
                    placeholder="e.g., RIVER-01"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  />
                  {formErrors.sensorId && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.sensorId}</p>
                  )}
                </div>
              ) : null}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Type</label>
                <select
                  value={form.sensorType}
                  disabled={!!editingSensor}
                  onChange={(e) => setForm({ ...form, sensorType: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:bg-slate-100"
                >
                  <option value="RIVER_GAUGE">River gauge</option>
                  <option value="RAIN_GAUGE">Rain gauge</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
                {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Latitude
                  </label>
                  <input
                    type="text"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  />
                  {formErrors.latitude && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.latitude}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Longitude
                  </label>
                  <input
                    type="text"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  />
                  {formErrors.longitude && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.longitude}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Breach threshold
                  </label>
                  <input
                    type="text"
                    value={form.thresholdValue}
                    onChange={(e) => setForm({ ...form, thresholdValue: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  />
                  {formErrors.thresholdValue && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.thresholdValue}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Unit</label>
                  <select
                    value={form.thresholdUnit}
                    onChange={(e) =>
                      setForm({ ...form, thresholdUnit: e.target.value as "m" | "mm_hr" })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  >
                    <option value="m">metres</option>
                    <option value="mm_hr">mm/hr</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Impact radius (m)
                </label>
                <input
                  type="text"
                  value={form.impactRadiusM}
                  onChange={(e) => setForm({ ...form, impactRadiusM: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
                {formErrors.impactRadiusM && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.impactRadiusM}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingSensor ? "Save" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
