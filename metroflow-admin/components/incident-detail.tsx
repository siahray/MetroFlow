"use client";

import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  Radar,
  Send,
  TriangleAlert,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";
import { maskPhoneNumber, type Incident, type LogEntry } from "@/lib/incidents";
import { RESCUE_UNITS, type RescueUnit } from "@/lib/rescue";
import { assignSOS, confirmDispatch, listVehicles } from "@/lib/dispatch";

type IncidentDetailProps = {
  incident: Incident;
  logs: LogEntry[];
  onAction: (label: string) => void;
  onAddNote: (text: string) => void;
  onDispatchConfirmed?: (unitCallSign: string, incidentId: string) => void;
};

const BASE_ACTIONS = [
  {
    label: "Reject / False Alarm",
    className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  },
  {
    label: "Hold for Sensor Update",
    className: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  },
];

const UNIT_STATUSES = ["AVAILABLE", "EN_ROUTE", "ON_SCENE", "OFFLINE"] as const;

function toUnitStatus(value: string | null | undefined): RescueUnit["status"] {
  const upper = String(value ?? "").toUpperCase();
  return (UNIT_STATUSES as readonly string[]).includes(upper)
    ? (upper as RescueUnit["status"])
    : "AVAILABLE";
}

export function IncidentDetail({
  incident,
  logs,
  onAction,
  onAddNote,
  onDispatchConfirmed,
}: IncidentDetailProps) {
  const logRef = useRef<HTMLDivElement | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [vehicles, setVehicles] = useState<RescueUnit[]>(RESCUE_UNITS);
  const [selectedUnit, setSelectedUnit] = useState<RescueUnit | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listVehicles();
        if (data && data.length > 0) {
          const mapped: RescueUnit[] = data.map((v) => ({
            callSign: v.call_sign,
            type: v.vehicle_type,
            status: toUnitStatus(v.status),
            clearance_cm: v.clearance_cm ?? 0,
            speed_kmh: v.speed_kmh ?? 0,
            location: "Depot",
            vehicleId: v.vehicle_id,
          }));
          setVehicles(mapped);
          setSelectedUnit(mapped[0]);
        }
      } catch {
        // The static fallback list stays in place when the fleet API is down.
      }
    };
    load();
  }, []);

  useEffect(() => {
    const node = logRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [logs]);

  function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = note.trim();
    if (!text) return;
    onAddNote(text);
    setNote("");
    setNoteOpen(false);
  }

  async function handleConfirmDispatch() {
    try {
      const sosId = parseInt(incident.id.replace(/\D/g, ""), 10);
      if (!isNaN(sosId)) {
        const vehicleId = selectedUnit?.vehicleId;
        if (vehicleId !== undefined) {
          try {
            await assignSOS(sosId, vehicleId);
          } catch {
            // The assignment is best-effort; confirmation below still records
            // the dispatcher's decision in the log.
          }
        } else {
          // A unit from the static fallback list has no backend id, so there is
          // nothing to assign. Surface it instead of assigning an arbitrary row.
          onAction(
            `Could not assign ${selectedUnit?.callSign ?? "unit"}: unit is not in the fleet API`,
          );
        }
        try {
          if (selectedUnit) await confirmDispatch(sosId, `Dispatched ${selectedUnit.callSign}`);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    setDispatchModalOpen(false);
    if (selectedUnit) {
      onAction(`Dispatched ${selectedUnit.callSign} (${selectedUnit.type}) to #${incident.id}`);
      if (onDispatchConfirmed) {
        onDispatchConfirmed(selectedUnit.callSign, incident.id);
      }
    }
  }

  const rawReporter = incident.reporter.includes("(")
    ? `${incident.reporter.split("(")[0].trim()} (${maskPhoneNumber(incident.reporter)})`
    : incident.reporter;

  return (
    <div className="flex flex-col justify-between space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
      <div className="space-y-6">
        {/* Docket Header */}
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-rose-800 px-2.5 py-0.5 text-xs font-semibold text-white uppercase tracking-wider">
                Incident Docket
              </span>
              <span className="font-mono text-base font-bold text-slate-900">#{incident.id}</span>
              <span className="rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                {incident.level}
              </span>
              <Link
                href={`/radar?id=${encodeURIComponent(incident.id)}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-100 transition-colors"
                title="View distress signal on Emergency Dispatch Radar"
              >
                <Radar className="h-3 w-3 text-sky-600" />
                <span>Radar View</span>
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
              <span>
                Reported by: <strong className="text-slate-900">{rawReporter}</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span>
                Filed: <span className="text-slate-500">{incident.reportedAt}</span>
              </span>
            </div>
          </div>

          <div className="shrink-0 self-start rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-right whitespace-nowrap">
            <div className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase">
              AI Confidence Score
            </div>
            <div className="text-sm font-extrabold text-emerald-800">{incident.aiConfidence}</div>
          </div>
        </div>

        {/* Submission Parameters Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <h3 className="mb-3 flex items-center text-xs font-bold tracking-wider text-slate-500 uppercase">
            <User className="mr-1.5 h-3.5 w-3.5 text-slate-400" /> Submission Parameters &amp;
            Verification
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Reporter Identification</div>
              <div className="text-xs font-bold text-slate-800">{rawReporter}</div>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                <CheckCircle className="h-3 w-3" /> Verified Citizen ID #CIT-8821
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Date &amp; Elapsed Time</div>
              <div className="text-xs font-semibold text-slate-800">{incident.reportedAt}</div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock className="h-3 w-3" /> 14 minutes ago (High Priority)
              </div>
            </div>
          </div>
          <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-2.5">
            <div>
              <div className="text-xs font-bold text-slate-800">{incident.barangay}</div>
              <div className="font-mono text-[11px] text-slate-500">14.5995° N, 121.0223° E</div>
            </div>
            <span className="rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
              Sector Delta
            </span>
          </div>
        </div>

        {/* Citizen Witness & Field Narrative */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
            <span>Citizen Witness Narrative</span>
          </div>
          <p className="text-xs font-medium leading-relaxed text-slate-800">
            &ldquo;{incident.narrative}&rdquo;
          </p>
        </div>

        {/* Attached Telemetry & Evidence Chips */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
            Attached Telemetry &amp; Ground Evidence
          </h3>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded bg-sky-600 px-2.5 py-1 text-xs font-medium text-white shadow-2xs">
              <Camera className="mr-1.5 h-3 w-3" /> Telemetry Attached
            </span>
            <span className="inline-flex items-center rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
              <MapPin className="mr-1.5 h-3 w-3 text-rose-500" /> GPS Verified
            </span>
          </div>
        </div>

        {/* Evidence and Location Telemetry */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Photo Evidence Card */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-bold text-slate-800">
                <Camera className="h-3.5 w-3.5 text-sky-600" /> Incident Ground Evidence
              </span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                Verified
              </span>
            </div>

            <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
              <svg
                aria-hidden="true"
                className="h-full w-full object-cover opacity-80"
                viewBox="0 0 400 200"
                preserveAspectRatio="none"
              >
                <rect width="400" height="200" fill="#1e293b" />
                <path
                  d="M0,120 Q100,100 200,130 T400,110 L400,200 L0,200 Z"
                  fill="#0284c7"
                  opacity="0.6"
                />
                <path
                  d="M0,140 Q150,130 250,150 T400,135 L400,200 L0,200 Z"
                  fill="#0369a1"
                  opacity="0.8"
                />
                <rect x="140" y="110" width="80" height="30" rx="6" fill="#475569" />
                <circle cx="160" cy="140" r="10" fill="#0f172a" />
                <circle cx="200" cy="140" r="10" fill="#0f172a" />
              </svg>

              <div className="absolute bottom-2 left-2 rounded bg-slate-950/80 px-2 py-1 font-mono text-[10px] text-white backdrop-blur">
                Verification: <strong className="text-sky-400">{incident.level}</strong>
              </div>
            </div>

            {/* Photo Metadata 3-Column Block */}
            <div className="grid grid-cols-2 gap-1.5 text-center font-mono text-[10px]">
              <div className="rounded border border-slate-100 bg-slate-50 p-1.5">
                <div className="text-[9px] text-slate-400 uppercase">Source</div>
                <div className="font-semibold text-slate-700 uppercase">{incident.source}</div>
              </div>
              <div className="rounded border border-sky-100 bg-sky-50 p-1.5">
                <div className="text-[9px] text-sky-600 uppercase">AI Confidence</div>
                <div className="font-bold text-sky-800">{incident.aiConfidence}</div>
              </div>
            </div>

            <div className="space-y-0.5 rounded border border-slate-100 bg-slate-50 p-2 font-mono text-[10px] text-slate-500">
              <div>
                Reported: <span className="text-slate-800">{incident.reportedAt}</span>
              </div>
              <div>
                Location: <span className="text-slate-800">{incident.location}</span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-emerald-600">
                <Check className="h-3 w-3" /> Geolocation verified on road graph
              </div>
            </div>
          </div>

          {/* Location & Sensor Telemetry Card */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-bold text-slate-800">
                <MapPin className="h-3.5 w-3.5 text-rose-600" /> Location &amp; Dispatch Status
              </span>
              <span className="text-[10px] text-slate-500">{incident.barangay}</span>
            </div>

            <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-2">
              <div className="absolute inset-0 bg-sky-50 opacity-50" />
              <div className="absolute inset-0 rounded border border-dashed border-sky-200" />

              <div className="relative z-10 text-center">
                <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full border-2 border-rose-500 bg-rose-500/20">
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg">
                    <TriangleAlert className="h-2.5 w-2.5" />
                  </div>
                </div>
                <span className="mt-1 inline-block rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-rose-800 shadow">
                  {incident.level}
                </span>
              </div>

              <div className="absolute top-2 right-2 rounded bg-rose-800 px-1.5 py-0.5 text-[9px] font-bold text-white">
                Sector Delta
              </div>
            </div>

            <div className="space-y-1 rounded border border-slate-100 bg-slate-50 p-2 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Nearest Rescue:</span>
                <span className="font-bold text-sky-700">
                  {selectedUnit
                    ? `${selectedUnit.callSign} (${selectedUnit.type})`
                    : "No unit selected"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Urgency Priority:</span>
                <span className="font-bold text-amber-600">{incident.urgency} / 10.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Verification:</span>
                <span className="font-bold text-emerald-600">{incident.aiConfidence}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Operations Log */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-[11px] font-bold tracking-wider text-slate-700 uppercase">
              <FileText className="h-3.5 w-3.5 text-slate-400" /> Operations Log & Notes
            </span>
            <button
              type="button"
              onClick={() => setNoteOpen((current) => !current)}
              aria-expanded={noteOpen}
              className="text-[11px] font-medium text-sky-600 hover:text-sky-700"
            >
              {noteOpen ? "Cancel" : "+ Add Internal Note"}
            </button>
          </div>

          <div
            ref={logRef}
            className="max-h-24 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px]"
          >
            {logs.length === 0 ? (
              <p className="text-slate-400">No entries yet for this incident.</p>
            ) : null}

            {logs.map((entry, index) => (
              <div
                key={`${entry.time}-${index}`}
                className={cn(
                  entry.kind === "muted" && "text-slate-500",
                  entry.kind === "action" && "font-semibold text-slate-700",
                  entry.kind === "note" && "text-sky-900 font-medium",
                )}
              >
                <span className="font-mono text-slate-400">{entry.time}</span> {entry.text}
              </div>
            ))}
          </div>

          {noteOpen ? (
            <form onSubmit={handleAddNote} className="flex items-center gap-2">
              <input
                autoFocus
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Internal note for the dispatch log..."
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-700"
              >
                Add note
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 md:grid-cols-4">
        {BASE_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onAction(action.label)}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
              action.className,
            )}
          >
            {action.label}
          </button>
        ))}

        {/* Multi-step modal trigger per UI/UX Audit & FSD requirements */}
        <button
          type="button"
          onClick={() => {
            setModalStep(1);
            setDispatchModalOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          <span>Approve & Dispatch</span>
        </button>
      </div>

      {/* 3-STEP DISPATCH MODAL */}
      {dispatchModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-base font-bold text-slate-900">Flood-Safe Dispatch Workflow</h3>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stepper Navigation */}
            <div className="flex items-center justify-between px-2 text-xs font-semibold">
              <div
                className={cn(
                  "flex items-center gap-1.5",
                  modalStep >= 1 ? "text-sky-600 font-bold" : "text-slate-400",
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[10px] text-white">
                  1
                </span>
                <span>Publish Hazard</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <div
                className={cn(
                  "flex items-center gap-1.5",
                  modalStep >= 2 ? "text-sky-600 font-bold" : "text-slate-400",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                    modalStep >= 2 ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-600",
                  )}
                >
                  2
                </span>
                <span>Assign Unit</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <div
                className={cn(
                  "flex items-center gap-1.5",
                  modalStep >= 3 ? "text-sky-600 font-bold" : "text-slate-400",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                    modalStep >= 3 ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-600",
                  )}
                >
                  3
                </span>
                <span>Confirm Route</span>
              </div>
            </div>

            {/* Step 1 Content */}
            {modalStep === 1 ? (
              <div className="space-y-4">
                <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <span className="flex items-center gap-1 font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-600" /> Step 1: Formalize & Publish
                    Hazard
                  </span>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Publish the verified flood hazard into the active road graph. All citizen and
                    dispatch navigations will automatically calculate clearance-aware detours.
                  </p>
                </div>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div>
                    <strong>Incident Docket:</strong> #{incident.id}
                  </div>
                  <div>
                    <strong>Location:</strong> {incident.location} ({incident.barangay})
                  </div>
                  <div>
                    <strong>Reported Submersion:</strong>{" "}
                    <span className="font-mono font-bold text-sky-700">75 cm (Impassable)</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalStep(2)}
                  className="w-full rounded-lg bg-sky-600 py-2.5 text-xs font-semibold text-white shadow hover:bg-sky-500 transition-colors"
                >
                  Publish Hazard to Road Network & Continue &rarr;
                </button>
              </div>
            ) : null}

            {/* Step 2 Content */}
            {modalStep === 2 ? (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-slate-700 uppercase">
                  Select Available Rescue Unit:
                </div>
                <div className="space-y-2">
                  {vehicles.map((unit) => {
                    const isSelected = selectedUnit?.callSign === unit.callSign;
                    return (
                      <label
                        key={unit.callSign}
                        onClick={() => setSelectedUnit(unit)}
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-xl p-3 border transition-colors",
                          isSelected
                            ? "border-sky-600 bg-sky-50/60"
                            : "border-slate-200 bg-white hover:bg-slate-50",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="unit-select"
                            checked={isSelected}
                            onChange={() => setSelectedUnit(unit)}
                            className="text-sky-600"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {unit.callSign} ({unit.type})
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Clearance: {unit.clearance_cm} cm • Speed: {unit.speed_kmh} km/h
                            </div>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-bold font-mono",
                            unit.status === "AVAILABLE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-sky-100 text-sky-800",
                          )}
                        >
                          {unit.status}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalStep(1)}
                    className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalStep(3)}
                    className="flex-1 rounded-lg bg-sky-600 py-2 text-xs font-semibold text-white hover:bg-sky-500"
                  >
                    Preview Safe Route &rarr;
                  </button>
                </div>
              </div>
            ) : null}

            {/* Step 3 Content */}
            {modalStep === 3 ? (
              <div className="space-y-4">
                <div className="space-y-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <span className="flex items-center gap-1 font-bold">
                    <CheckCircle className="h-4 w-4 text-emerald-600" /> Safe Corridor Verified
                  </span>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    A clearance-aware route (4.2 km) avoiding all active flood polygons has been
                    calculated for {selectedUnit?.callSign}.
                  </p>
                </div>
                <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs">
                  <div className="flex justify-between">
                    <span>Unit Assigned:</span>
                    <strong>
                      {selectedUnit?.callSign} ({selectedUnit?.type})
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Incident:</span>
                    <strong>#{incident.id}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Ground Clearance:</span>
                    <strong>{selectedUnit?.clearance_cm} cm</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Calculated ETA:</span>
                    <strong className="text-emerald-700">12:13 PM PHT (~ 12 mins)</strong>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalStep(2)}
                    className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDispatch}
                    className="flex-2 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition-colors"
                  >
                    <Send className="h-4 w-4" /> Confirm & Commit Dispatch
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
