"use client";

import { Navigation, Radio, Truck } from "lucide-react";

import { cn } from "@/lib/cn";
import type { SOSRequest, Vehicle } from "@/lib/dispatch";
import { clockLabel } from "@/lib/reports";
import { FIX_LABEL, responderTrack, type FixState } from "@/lib/tracking";

/**
 * CR-002 §2.3: responder tracking on the Dispatch Radar.
 *
 * Live GPS comes from the vehicles SSE feed the radar page already subscribes to
 * (`current_location_*`, stamped `updated_at` by the telemetry ingest). The
 * periodic mission/status/ETA updates are the mission timeline inside the
 * incident detail; this panel is the "where is the unit right now" half.
 */

const FIX_STYLE: Record<FixState, string> = {
  live: "bg-emerald-100 text-emerald-800",
  stale: "bg-amber-100 text-amber-800",
  offline: "bg-rose-100 text-rose-800",
  unknown: "bg-slate-200 text-slate-600",
};

export function ResponderTracking({ sos, vehicles }: { sos: SOSRequest; vehicles: Vehicle[] }) {
  const track = responderTrack(sos, vehicles);
  const fix = track?.fix ?? "unknown";

  return (
    <section
      aria-label="Responder tracking"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-500 uppercase">
          <Radio className="h-3.5 w-3.5 text-slate-400" /> Responder tracking
        </h2>
        <span
          className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", FIX_STYLE[fix])}
        >
          {FIX_LABEL[fix]}
        </span>
      </div>

      {track === null ? (
        <p className="text-xs text-slate-500">
          No responder assigned yet. Dispatch a unit to start tracking it.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-600">
              <Truck className="h-4 w-4" />
            </span>
            <div>
              <p className="font-mono text-sm font-bold text-slate-900">{track.unit.call_sign}</p>
              <p className="text-[11px] text-slate-500">{track.unit.vehicle_type}</p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <dt className="text-[9px] font-bold text-slate-400 uppercase">Distance</dt>
              <dd className="mt-0.5 text-xs font-bold text-slate-900">
                {track.distanceKm !== null ? `${track.distanceKm} km` : "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <dt className="text-[9px] font-bold text-slate-400 uppercase">ETA</dt>
              <dd className="mt-0.5 text-xs font-bold text-slate-900">
                {track.etaMinutes !== null ? `~${track.etaMinutes} min` : "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <dt className="text-[9px] font-bold text-slate-400 uppercase">Speed</dt>
              <dd className="mt-0.5 text-xs font-bold text-slate-900">
                {track.unit.speed_kmh != null ? `${track.unit.speed_kmh} km/h` : "—"}
              </dd>
            </div>
          </dl>

          <p className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
            <Navigation className="h-3 w-3 text-slate-400" />
            {track.unit.current_location_lat != null && track.unit.current_location_lon != null
              ? `${track.unit.current_location_lat.toFixed(4)}° N, ${track.unit.current_location_lon.toFixed(4)}° E`
              : "Position not reported"}
          </p>
          <p className="text-[10px] text-slate-400">
            Last fix {clockLabel(track.updatedAt)} · status {track.unit.status}
          </p>
        </div>
      )}
    </section>
  );
}
