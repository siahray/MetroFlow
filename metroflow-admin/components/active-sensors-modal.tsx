"use client";

import { X } from "lucide-react";
import { useRef } from "react";

import type { Sensor } from "@/lib/sensors";
import { useDialogFocus } from "./use-dialog-focus";

type ActiveSensorsModalProps = {
  sensors: Sensor[];
  onClose: () => void;
};

/** Read-only registry view opened from the operations dashboard (FSD-FR-101). */
export function ActiveSensorsModal({ sensors, onClose }: ActiveSensorsModalProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeButton, onClose);

  return (
    <div className="fixed inset-0 z-50 flex animate-backdrop-in items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md dark:bg-black/80">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="active-sensors-title"
        className="max-h-[85vh] w-full max-w-2xl animate-modal-in overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)] dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2
              id="active-sensors-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              Active sensors
            </h2>
            <p className="text-[11px] text-slate-500">
              {sensors.length} active · {sensors.filter((sensor) => sensor.last_flagged).length} in
              breach
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {sensors.length === 0 ? (
          <p className="text-xs text-slate-500">No active sensors.</p>
        ) : (
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] tracking-wider text-slate-500 uppercase dark:border-slate-700">
                <th scope="col" className="px-2 py-2 font-semibold">
                  Sensor
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Threshold
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Last reading
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((sensor) => {
                const unit = sensor.threshold_unit === "m" ? "m" : "mm/hr";
                const reading =
                  sensor.last_value == null ? "No readings" : `${sensor.last_value} ${unit}`;
                return (
                  <tr
                    key={sensor.sensor_id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-2 py-2">
                      <div className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                        {sensor.sensor_id}
                      </div>
                      <div className="truncate text-slate-500">{sensor.name}</div>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {sensor.threshold_value} {unit}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {reading}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span
                        className={
                          sensor.last_flagged
                            ? "rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800"
                            : "rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800"
                        }
                      >
                        {sensor.last_flagged ? "BREACH" : "NORMAL"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
