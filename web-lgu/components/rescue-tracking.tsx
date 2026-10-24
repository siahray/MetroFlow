"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Battery,
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
  User,
  Wifi,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { DISTRESS_BEACON, MISSION_MILESTONES, RESCUE_UNITS } from "@/lib/rescue";

type RescueTrackingProps = {
  onBack: () => void;
  onAction: (message: string) => void;
};

export function RescueTracking({ onBack, onAction }: RescueTrackingProps) {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
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
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                RU-03 EN ROUTE
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
        {RESCUE_UNITS.map((unit) => {
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
                {unit.callSign === "RU-03" ? (
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                    ID: #LCT-0321
                  </span>
                ) : unit.eta_min ? (
                  <span className="rounded bg-sky-50 px-2 py-1 font-mono text-xs font-bold text-sky-700">
                    ETA {unit.eta_min}m
                  </span>
                ) : (
                  <span className="font-mono text-xs text-slate-400">{unit.location}</span>
                )}
              </div>

              {/* Pilot & Payload Indicator for RU-03 */}
              {unit.callSign === "RU-03" && (
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded border border-slate-100 bg-slate-50 p-2">
                    <div className="text-slate-400 uppercase font-semibold">Lead Pilot</div>
                    <div className="font-bold text-slate-800 flex items-center mt-0.5">
                      <User className="mr-1 h-3 w-3 text-slate-400" /> Carlo Reyes
                    </div>
                    <div className="text-[9px] text-slate-500">Paramedic Cert. IV</div>
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 p-2">
                    <div className="text-slate-400 uppercase font-semibold">Live Payload</div>
                    <div className="font-bold text-slate-800 flex items-center mt-0.5">
                      <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500"></span> 2 / 6
                      Capacity
                    </div>
                    <div className="text-[9px] text-sky-600 font-medium">4 slots available</div>
                  </div>
                </div>
              )}

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

              {/* Aux Battery Indicator for RU-03 */}
              {unit.callSign === "RU-03" && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                  <div className="flex items-center gap-1 text-slate-600 font-mono">
                    <Activity className="h-3 w-3 text-sky-500" />
                    <span>Water Speed: 28 km/h</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-emerald-700">
                    <Battery className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Aux Battery: 88% (4.2 hrs)</span>
                  </div>
                </div>
              )}

              <div className="text-[11px] text-slate-600">
                {unit.status === "EN_ROUTE" ? (
                  <span>
                    Task: <strong className="text-slate-900">Distress #FR-0248 (San Pedro)</strong>
                  </span>
                ) : unit.status === "AVAILABLE" ? (
                  <span>
                    Status:{" "}
                    <strong className="text-emerald-700">Ready for Immediate Callout</strong>
                  </span>
                ) : (
                  <span>
                    Task: <strong className="text-slate-900">Vehicle Extraction (#FR-0247)</strong>
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
        <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-rose-200 bg-white p-5 shadow-sm lg:col-span-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-rose-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-pulse"></span>
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                  Distress Target Beacon
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-slate-600">Ticket #FR-0248</span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">{DISTRESS_BEACON.barangay}</h3>
              <p className="font-mono text-[11px] text-slate-500 flex items-center mt-0.5">
                <MapPin className="mr-1 h-3 w-3 text-rose-500" /> 14.5995° N, 121.0223° E • Sector
                Delta
              </p>
            </div>

            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs space-y-1">
              <div className="font-bold text-rose-800 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> 6 Civilians Trapped on
                Rooftop
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                Includes 1 infant and 1 senior citizen with limited mobility. Water level approx 180
                cm and rising.
              </p>
            </div>

            {/* Field Recon Photo Mock */}
            <div className="relative h-32 rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center border border-slate-800">
              <svg className="h-full w-full object-cover opacity-60" viewBox="0 0 300 120">
                <rect width="300" height="120" fill="#1e293b" />
                <path
                  d="M0,70 Q75,50 150,75 T300,60 L300,120 L0,120 Z"
                  fill="#0284c7"
                  opacity="0.6"
                />
                <circle
                  cx="150"
                  cy="50"
                  r="16"
                  fill="#e11d48"
                  opacity="0.2"
                  className="animate-ping"
                />
                <circle cx="150" cy="50" r="6" fill="#e11d48" />
              </svg>
              <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 font-mono text-[9px] text-white backdrop-blur">
                Field Recon Photo (11:52 AM)
              </div>
              <div className="absolute bottom-2 right-2 rounded bg-sky-600 px-2 py-0.5 font-bold text-[9px] text-white shadow">
                Depth: 180 cm
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onAction("Signaled secondary backup rescue unit")}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500 transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Signal Immediate Support Unit
            </button>
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
                <div className="text-xs font-bold text-slate-800">Rizal Ave North Arterial</div>
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-500 uppercase">Channel Depth</div>
              <div className="text-xs font-bold text-sky-600">30 cm - 45 cm Safe Draft</div>
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
            <button type="button" className="p-1 text-slate-600 hover:bg-slate-100 rounded">
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

              {/* Animated Dashed Route Line */}
              <path
                d="M 150,280 L 250,280 L 350,220 L 450,120 L 550,100 L 650,120 L 700,180"
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="4"
                strokeDasharray="8 4"
              />

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
                Depot Delta
              </text>

              {/* Moving Unit Blip RU-03 */}
              <circle cx="450" cy="120" r="12" fill="#0369a1" />
              <text
                x="450"
                y="105"
                fontSize="10"
                fontWeight="bold"
                fill="#0369a1"
                textAnchor="middle"
              >
                RU-03 (En Route)
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
                Distress #FR-0248
              </text>
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
            <span className="text-2xl font-bold text-slate-900">12</span>
            <span className="text-xs text-slate-500">min</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-400">Target: 12:13 PM PHT</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
            <Navigation className="h-3 w-3" /> Remaining Distance
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900">4.2</span>
            <span className="text-xs text-slate-500">km</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-400">Corridor total: 6.8 km</p>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 shadow-2xs">
          <div className="flex items-center gap-1 text-[10px] font-bold text-sky-800 uppercase">
            <Droplets className="h-3 w-3 text-sky-600" /> Flood Depth En Route
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-sky-700">30</span>
            <span className="text-xs text-sky-600">cm</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-sky-700">Within 35 cm draft limit (Safe)</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
            <Home className="h-3 w-3 text-emerald-600" /> Assigned Safe Haven
          </div>
          <div className="mt-1 text-sm font-bold text-slate-800 truncate">
            St. Jude Evacuation Hub
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            Capacity: 450 (180 free slots)
          </p>
        </div>
      </div>

      {/* Active Mission Milestones Stepper & Actions */}
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Mission Milestone Timeline: RU-03 to #{DISTRESS_BEACON.incidentId}
            </h3>
            <p className="text-xs text-slate-500">
              Corridor verified against live hydro elevation (Max route depth 30 cm &lt; 35 cm
              draft)
            </p>
          </div>
          <span className="rounded bg-slate-100 px-3 py-1 font-mono text-xs text-slate-700">
            Telemetry Synced Just Now
          </span>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {MISSION_MILESTONES.map((milestone) => (
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
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onAction("Rerouted RU-03 via high-ground bypass")}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Reroute via High Ground
          </button>
        </div>
      </div>
    </div>
  );
}
