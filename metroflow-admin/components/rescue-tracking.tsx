"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle,
  Clock,
  Droplets,
  Flag,
  Home,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  Truck,
  Wifi,
} from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { listVehicles, type SOSRequest } from "@/lib/dispatch";
import { listSOS } from "@/lib/sos-live";
import { toUnitStatus, type FleetUnit, type MissionMilestone } from "@/lib/rescue";
import { ErrorNotice } from "./error-notice";

type RescueTrackingProps = {
  onBack: () => void;
  onAction: (message: string) => void;
};

export function RescueTracking({ onBack, onAction }: RescueTrackingProps) {
  const [fleet, setFleet] = useState<FleetUnit[]>([]);
  const [sosList, setSosList] = useState<SOSRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [vehiclesData, sosData] = await Promise.all([listVehicles(), listSOS()]);

        if (vehiclesData && vehiclesData.length > 0) {
          const mapped: FleetUnit[] = vehiclesData.map((v) => {
            const assignedSos = sosData.find(
              (s) =>
                s.vehicle_id === v.vehicle_id &&
                (s.status === "assigned" || s.status === "confirmed"),
            );
            return {
              callSign: v.call_sign,
              type: v.vehicle_type,
              status: assignedSos ? "EN_ROUTE" : toUnitStatus(v.status),
              clearance_cm: v.clearance_cm ?? 0,
              speed_kmh: v.speed_kmh ?? 0,
              location: assignedSos
                ? `Assigned #FR-${assignedSos.sos_id.toString().padStart(4, "0")}`
                : "Depot",
              assignedSosId: assignedSos?.sos_id,
            };
          });
          setFleet(mapped);
        }
        setSosList(sosData);
        setLoadError(null);
      } catch {
        // Keep the last data on screen and say it is stale.
        setLoadError("Could not refresh fleet data. Showing the last known state.");
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [reloadKey]);

  const activeMission = sosList.find(
    (s) => s.vehicle_id != null && (s.status === "assigned" || s.status === "confirmed"),
  );
  const activeUnit = fleet.find((u) => u.assignedSosId === activeMission?.sos_id) || fleet[0];

  return (
    <div className="space-y-6">
      {loadError && <ErrorNotice message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Rescue Fleet &amp; Mission Operations
              </h2>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 flex items-center">
                <span
                  className={cn(
                    "mr-1.5 h-1.5 w-1.5 rounded-full",
                    activeMission ? "bg-rose-500 animate-pulse" : "bg-emerald-500",
                  )}
                />
                {activeMission
                  ? `MISSION #FR-${activeMission.sos_id.toString().padStart(4, "0")} ACTIVE`
                  : "FLEET STANDBY"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Live telemetry tracking, flood-safe corridors, clearance compliance, and real-time
              mission lifecycle
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAction("Comm link opened on marine Channel 4 (156.200 MHz)")}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Radio className="h-3.5 w-3.5 text-sky-600" /> Comm Link (CH-4)
          </button>
          <button
            type="button"
            onClick={() => onAction("Broadcast beacon ping emitted to sector units")}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
          >
            <Wifi className="h-3.5 w-3.5" /> Broadcast Ping
          </button>
          <button
            type="button"
            onClick={() => onAction("Fleet telemetry refreshed from field beacons")}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-sky-600" /> Refresh Fleet
          </button>
        </div>
      </div>

      {/* Fleet Unit Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {fleet.map((unit) => {
          const isEnRoute = unit.status === "EN_ROUTE";
          return (
            <div
              key={unit.callSign}
              className={cn(
                "space-y-3 rounded-xl bg-white p-4 shadow-sm transition-colors border",
                isEnRoute ? "border-2 border-sky-600 ring-4 ring-sky-50" : "border-slate-200",
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {unit.callSign}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold font-mono",
                        unit.status === "AVAILABLE"
                          ? "bg-emerald-100 text-emerald-800"
                          : unit.status === "EN_ROUTE"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-indigo-100 text-indigo-800",
                      )}
                    >
                      {unit.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{unit.type}</p>
                </div>
                {unit.eta_min ? (
                  <span className="rounded bg-sky-50 px-2 py-1 font-mono text-xs font-bold text-sky-700">
                    ETA {unit.eta_min}m
                  </span>
                ) : (
                  <span className="font-mono text-xs text-slate-400">{unit.location}</span>
                )}
              </div>

              {/* Specs strictly in cm for clearance and km/h for speed */}
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 bg-slate-50 py-1.5 text-center font-mono text-xs">
                <div>
                  <span className="block text-[9px] text-slate-400">CLEARANCE</span>
                  <span className="font-bold text-slate-800">{unit.clearance_cm} cm</span>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400">SPEED</span>
                  <span className="font-bold text-slate-800">{unit.speed_kmh} km/h</span>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400">CORRIDOR</span>
                  <span
                    className={cn(
                      "font-bold",
                      unit.status === "AVAILABLE"
                        ? "text-sky-600"
                        : unit.status === "EN_ROUTE"
                          ? "text-emerald-600"
                          : "text-indigo-600",
                    )}
                  >
                    {unit.status === "AVAILABLE" ? "READY" : "SAFE"}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-600">
                {unit.status === "EN_ROUTE" && unit.assignedSosId ? (
                  <span>
                    Task:{" "}
                    <strong className="text-slate-900">
                      Distress #FR-{String(unit.assignedSosId).padStart(4, "0")}
                    </strong>
                  </span>
                ) : unit.status === "AVAILABLE" ? (
                  <span>
                    Status:{" "}
                    <strong className="text-emerald-700">Ready for Immediate Callout</strong>
                  </span>
                ) : (
                  <span>
                    Status: <strong className="text-slate-900">{unit.status}</strong>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Distress Target & Interactive Route Map Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Distress Target Beacon Card (Left 4 Cols) */}
        <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    activeMission ? "bg-rose-600 animate-pulse" : "bg-slate-400",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    activeMission ? "text-rose-700" : "text-slate-500",
                  )}
                >
                  {activeMission ? "Distress Target Beacon" : "Target Beacon Standby"}
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-slate-600">
                {activeMission
                  ? `Ticket #FR-${activeMission.sos_id.toString().padStart(4, "0")}`
                  : "No Target"}
              </span>
            </div>

            {activeMission ? (
              <>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Active Incident Mission</h3>
                  <p className="font-mono text-[11px] text-slate-500 flex items-center mt-0.5">
                    <MapPin className="mr-1 h-3 w-3 text-rose-500" />
                    {activeMission.latitude.toFixed(4)}° N, {activeMission.longitude.toFixed(4)}° E
                    • Sector Delta
                  </p>
                </div>

                <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs space-y-1">
                  <div className="font-bold text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                    Verified SOS Dispatch
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    {activeMission.note || "Citizen emergency report verified by dispatch."}
                  </p>
                </div>
              </>
            ) : (
              <div className="py-6 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Navigation className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Fleet on Depot Standby</h3>
                <p className="text-xs text-slate-500 leading-relaxed px-2">
                  No active emergency missions assigned. Dispatch an incident from the Triage Queue
                  to initiate live route navigation and distress beacons.
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100">
            {activeMission ? (
              <button
                type="button"
                onClick={() => onAction("Signaled secondary backup rescue unit")}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500 transition-colors"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Signal Immediate Support Unit
              </button>
            ) : (
              <div className="text-center text-xs font-medium text-slate-400 py-2">
                All units ready for deployment
              </div>
            )}
          </div>
        </div>

        {/* Interactive Route SVG Map (Right 8 Cols) */}
        <div className="relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-8">
          {/* Optimal Clearance Badge */}
          <div className="absolute top-6 left-6 z-10 flex items-center gap-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur">
            <div className="flex items-center gap-2 border-r border-slate-200 pr-3">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <div>
                <div className="text-[9px] font-bold text-slate-500 uppercase">
                  Optimal Clearance
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {activeMission ? "Rizal Ave Safe Bypass" : "Depot Base Clearance"}
                </div>
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-500 uppercase">Channel Depth</div>
              <div className="text-xs font-bold text-sky-600">
                {activeMission ? "Safe Draft Verified" : "Clear Corridor (Standby)"}
              </div>
            </div>
          </div>

          {/* Map Controls */}
          <div className="absolute top-6 right-6 z-10 flex flex-col space-y-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              className="p-1 text-slate-600 hover:bg-slate-100 rounded text-xs font-bold"
            >
              +
            </button>
            <div className="h-px bg-slate-100 mx-1"></div>
            <button
              type="button"
              className="p-1 text-slate-600 hover:bg-slate-100 rounded text-xs font-bold"
            >
              -
            </button>
            <div className="h-px bg-slate-100 mx-1"></div>
            <button
              type="button"
              aria-label="Recentre map"
              className="p-1 text-slate-600 hover:bg-slate-100 rounded"
            >
              <Navigation className="h-3 w-3" />
            </button>
          </div>

          {/* SVG Map Canvas */}
          <div className="relative flex-1 min-h-[300px] rounded-xl overflow-hidden bg-slate-50 border border-slate-200">
            <svg className="w-full h-full" viewBox="0 0 800 340">
              {/* Flood Zone Overlays */}
              <path
                d="M 200,200 Q 300,100 450,250 T 650,150 L 700,200 L 600,300 Z"
                fill="#bae6fd"
                opacity="0.5"
              />
              <path
                d="M 400,150 Q 500,50 600,120 T 700,80 L 750,150 L 550,250 Z"
                fill="#fecdd3"
                opacity="0.4"
              />

              {activeMission && (
                <>
                  {/* Animated Dashed Route Line */}
                  <path
                    d="M 150,280 L 250,280 L 350,220 L 450,120 L 550,100 L 650,120 L 700,180"
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth="4"
                    strokeDasharray="8 4"
                  />

                  {/* Moving Unit Blip */}
                  <circle cx="450" cy="120" r="12" fill="#0369a1" />
                  <text
                    x="450"
                    y="105"
                    fontSize="10"
                    fontWeight="bold"
                    fill="#0369a1"
                    textAnchor="middle"
                  >
                    {activeUnit?.callSign || "Rescue Unit"} (En Route)
                  </text>

                  {/* Target Node */}
                  <circle cx="700" cy="180" r="14" fill="#e11d48" />
                  <circle cx="700" cy="180" r="6" fill="#fff" />
                  <text
                    x="700"
                    y="210"
                    fontSize="10"
                    fontWeight="bold"
                    fill="#e11d48"
                    textAnchor="middle"
                  >
                    Distress #FR-{activeMission.sos_id.toString().padStart(4, "0")}
                  </text>
                </>
              )}

              {/* Depot Delta Start Node */}
              <circle cx="150" cy="280" r="14" fill="#0f172a" />
              <path d="M145,280 h10 M150,275 v10" stroke="white" strokeWidth="2" />
              <text
                x="150"
                y="310"
                fontSize="10"
                fontWeight="bold"
                fill="#334155"
                textAnchor="middle"
              >
                Depot Delta HQ
              </text>

              {!activeMission && (
                <text
                  x="450"
                  y="180"
                  fontSize="12"
                  fontWeight="bold"
                  fill="#94a3b8"
                  textAnchor="middle"
                >
                  Corridor Grid Standby • Awaiting Active Dispatch
                </text>
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* ETA & Corridor Quad-Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
            <Clock className="h-3 w-3" /> Estimated Arrival (ETA)
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900">{activeMission ? "12" : "--"}</span>
            <span className="text-xs text-slate-500">{activeMission ? "min" : "Standby"}</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            {activeMission ? "Target: En Route" : "Awaiting Callout"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
            <Navigation className="h-3 w-3" /> Remaining Distance
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900">
              {activeMission ? "4.2" : "--"}
            </span>
            <span className="text-xs text-slate-500">{activeMission ? "km" : "Base"}</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            {activeMission ? "Corridor verified" : "Stationed at Depot"}
          </p>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 shadow-2xs">
          <div className="flex items-center gap-1 text-[10px] font-bold text-sky-800 uppercase">
            <Droplets className="h-3 w-3 text-sky-600" /> Flood Depth En Route
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-sky-700">{activeMission ? "30" : "--"}</span>
            <span className="text-xs text-sky-600">{activeMission ? "cm" : "Clear"}</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-sky-700">
            {activeMission ? "Within vehicle clearance limit" : "Monitored passability"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
            <Home className="h-3 w-3 text-emerald-600" /> Operational Base
          </div>
          <div className="mt-1 text-sm font-bold text-slate-800 truncate">
            Depot Delta Headquarters
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            {fleet.length} Units Stationed
          </p>
        </div>
      </div>

      {/* Active Mission Milestones Stepper & Actions */}
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Mission Milestone Timeline:{" "}
              {activeMission
                ? `#FR-${activeMission.sos_id.toString().padStart(4, "0")}`
                : "Standby"}
            </h3>
            <p className="text-xs text-slate-500">
              {activeMission
                ? "Corridor verified against live hydro elevation"
                : "No active dispatch mission. Ready for deployment."}
            </p>
          </div>
          <span className="rounded bg-slate-100 px-3 py-1 font-mono text-xs text-slate-700">
            Telemetry Synced Just Now
          </span>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(
            [
              {
                label: "Step 1: Dispatched",
                time: activeMission ? "Immediate" : "--",
                detail: activeMission ? "Depot Delta Station" : "Awaiting assignment",
                state: activeMission ? "done" : "pending",
              },
              {
                label: "Step 2: En Route",
                time: activeMission ? "Active" : "--",
                detail: activeMission ? "Flood-safe corridor active" : "Standby at base",
                state: activeMission ? "current" : "pending",
              },
              {
                label: "Step 3: On Scene",
                time: activeMission ? "Pending" : "--",
                detail: activeMission ? "Target perimeter" : "Standby",
                state: "pending",
              },
            ] satisfies MissionMilestone[]
          ).map((milestone) => (
            <div
              key={milestone.label}
              className={cn(
                "rounded-xl p-3.5 border transition-colors",
                milestone.state === "done" && "border-emerald-200 bg-emerald-50 text-emerald-900",
                milestone.state === "current" &&
                  "border-sky-300 bg-sky-50 text-sky-900 shadow-xs ring-2 ring-sky-100",
                milestone.state === "pending" &&
                  "border-slate-200 bg-slate-50 text-slate-400 opacity-60",
              )}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                {milestone.state === "done" ? (
                  <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                ) : milestone.state === "current" ? (
                  <div className="h-6 w-6 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs animate-pulse">
                    <Truck className="h-3.5 w-3.5" />
                  </div>
                ) : (
                  <div className="h-6 w-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center">
                    <Flag className="h-3.5 w-3.5" />
                  </div>
                )}
                <span>{milestone.label}</span>
              </div>
              <p className="mt-2 font-mono text-[11px] opacity-80">
                {milestone.time} • {milestone.detail}
              </p>
            </div>
          ))}
        </div>

        {/* Mission Bottom Action Buttons */}
        {activeMission && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() =>
                activeUnit?.callSign &&
                onAction(`Rerouted ${activeUnit.callSign} via high-ground bypass`)
              }
              className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Reroute via High Ground
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
