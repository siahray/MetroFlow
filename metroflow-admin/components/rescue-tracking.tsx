"use client";

import { ArrowLeft, RefreshCw, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { listVehicles, type SOSRequest, type Vehicle } from "@/lib/dispatch";
import { listSOS } from "@/lib/sos-live";
import { toUnitStatus } from "@/lib/rescue";
import { subscribeToSOS, subscribeToVehicles } from "@/lib/live-stream";
import { ErrorNotice } from "./error-notice";
import { Skeleton } from "./skeleton";

type RescueTrackingProps = {
  onBack: () => void;
  onAction: (message: string) => void;
};

// An SOS in one of these states has a unit committed to it.
const ACTIVE_MISSION = new Set(["assigned", "confirmed", "dispatched"]);

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  EN_ROUTE: "bg-sky-100 text-sky-800",
  ON_SCENE: "bg-indigo-100 text-indigo-800",
  OFFLINE: "bg-slate-200 text-slate-600",
};

const missionId = (sosId: number) => `FR-${sosId.toString().padStart(4, "0")}`;

function position(lat: number | null, lon: number | null) {
  return lat != null && lon != null
    ? `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`
    : "Position not reported";
}

export function RescueTracking({ onBack, onAction }: RescueTrackingProps) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [sosList, setSosList] = useState<SOSRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [vehicleData, sosData] = await Promise.all([listVehicles(), listSOS()]);
        setVehicles(vehicleData);
        setSosList(sosData);
        setLoadError(null);
      } catch {
        // Keep the last data on screen and say it is stale.
        setLoadError("Could not refresh fleet data. Showing the last known state.");
      }
    };

    load();

    // Set up SSE streams for real-time updates
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;

    subscribeToVehicles((rows) => {
      setVehicles(rows);
    }, signal);
    subscribeToSOS((rows) => {
      setSosList(rows);
    }, signal);

    return () => {
      abortController.abort();
    };
  }, [reloadKey]);

  const missions = sosList.filter((s) => s.vehicle_id != null && ACTIVE_MISSION.has(s.status));
  const missionOf = (vehicleId: number) => missions.find((m) => m.vehicle_id === vehicleId);
  const callSignOf = (vehicleId: number | null) =>
    vehicles?.find((v) => v.vehicle_id === vehicleId)?.call_sign ?? "unit";

  return (
    <div className="space-y-6">
      {loadError && <ErrorNotice message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}

      <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Rescue Fleet</h2>
              <span className="flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                <span
                  className={cn(
                    "mr-1.5 h-1.5 w-1.5 rounded-full",
                    missions.length > 0 ? "animate-pulse bg-rose-500" : "bg-emerald-500",
                  )}
                />
                {missions.length > 0
                  ? `${missions.length} ACTIVE MISSION${missions.length === 1 ? "" : "S"}`
                  : "NO ACTIVE MISSIONS"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Units and dispatches as recorded in the fleet API. Positions appear when a unit
              reports one.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setReloadKey((k) => k + 1);
            onAction("Refreshing fleet data");
          }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Units */}
      <section aria-label="Rescue units" className="space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Units</h3>
        {vehicles === null && !loadError ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : vehicles && vehicles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Truck className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">No rescue units registered</p>
            <p className="text-xs text-slate-500">
              Units added through the fleet API will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(vehicles ?? []).map((unit) => {
              const mission = missionOf(unit.vehicle_id);
              const status = mission ? "EN_ROUTE" : toUnitStatus(unit.status);
              return (
                <div
                  key={unit.vehicle_id}
                  className={cn(
                    "space-y-3 rounded-xl border bg-white p-4 shadow-sm",
                    mission ? "border-2 border-sky-600" : "border-slate-200",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {unit.call_sign}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold",
                        STATUS_STYLE[status],
                      )}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{unit.vehicle_type}</div>
                  <dl className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <dt className="text-slate-400 uppercase">Clearance</dt>
                      <dd className="font-semibold text-slate-800">
                        {unit.clearance_cm != null ? `${unit.clearance_cm} cm` : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400 uppercase">Speed</dt>
                      <dd className="font-semibold text-slate-800">
                        {unit.speed_kmh != null ? `${unit.speed_kmh} km/h` : "—"}
                      </dd>
                    </div>
                  </dl>
                  <div className="font-mono text-[11px] text-slate-500">
                    {position(unit.current_location_lat, unit.current_location_lon)}
                  </div>
                  {mission ? (
                    <Link
                      href={`/radar?id=${encodeURIComponent(missionId(mission.sos_id))}`}
                      className="block rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-100"
                    >
                      Assigned to #{missionId(mission.sos_id)}
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Active dispatches */}
      <section aria-label="Active missions" className="space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
          Active missions
        </h3>
        {missions.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
            No unit is assigned to an incident. Dispatch one from the Triage Queue.
          </p>
        ) : (
          <ul className="space-y-3">
            {missions.map((m) => (
              <li
                key={m.sos_id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      #{missionId(m.sos_id)}
                    </span>
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 uppercase">
                      {m.status}
                    </span>
                    <span className="text-xs text-slate-500">{callSignOf(m.vehicle_id)}</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500">
                    {position(m.latitude, m.longitude)}
                    {m.created_at ? ` · filed ${new Date(m.created_at).toLocaleString()}` : ""}
                  </div>
                  {m.note ? <p className="mt-1 text-xs text-slate-700">{m.note}</p> : null}
                </div>
                <Link
                  href={`/radar?id=${encodeURIComponent(missionId(m.sos_id))}`}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open dispatch
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
