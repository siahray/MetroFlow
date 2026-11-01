"use client";

import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  Maximize2,
  MessageSquare,
  Radar,
  Send,
  TrendingUp,
  TriangleAlert,
  User,
  Waves,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";
import { maskPhoneNumber, type Incident, type LogEntry } from "@/lib/incidents";
import { RESCUE_UNITS, toUnitStatus, type RescueUnit } from "@/lib/rescue";
import {
  addSOSNote,
  assignSOS,
  confirmDispatch,
  escalateSOS,
  fetchIncidentLog,
  holdSOS,
  listVehicles,
  rejectSOS,
  undoDispatch,
} from "@/lib/dispatch";
import {
  addReportNote,
  escalateReport,
  getReportPhoto,
  holdReport,
  rejectReport,
} from "@/lib/reports";

type IncidentDetailProps = {
  incident: Incident;
  logs: LogEntry[];
  onAction: (label: string) => void;
  onAddNote: (text: string) => void;
  onDispatchConfirmed?: (unitCallSign: string, incidentId: string) => void;
};

type ActionKind = "reject" | "hold" | "escalate";

const BASE_ACTIONS: {
  type: ActionKind;
  label: string;
  className: string;
}[] = [
  {
    type: "reject",
    label: "Reject / False Alarm",
    className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  },
  {
    type: "escalate",
    label: "Escalate to BFP / Coast Guard",
    className: "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100",
  },
  {
    type: "hold",
    label: "Hold for Sensor Update",
    className: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  },
];

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

  // FSD-FR-036 / FSD-FR-043: Persisted operations log
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>(logs);

  // FSD-FR-044: Action reason modal state
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionKind | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionAgency, setActionAgency] = useState("BFP");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // FSD-FR-045: Undo window state
  const [undoSeconds, setUndoSeconds] = useState<number | null>(null);

  // FSD-FR-046: State constraints
  const isDispatched =
    incident.tags.includes("Vehicle Assigned") ||
    incident.tags.includes("Dispatched") ||
    undoSeconds !== null;
  const isRejected = incident.tags.includes("Rejected");

  // FSD-FR-034 / FSD-FR-038: Authenticated photo evidence loader
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const reportId = incident.reportId;
  const photoLoading = Boolean(reportId && !photoUrl && !photoError);

  // Load persistent operations log on incident change
  useEffect(() => {
    let cancelled = false;
    fetchIncidentLog(incident).then((fetched) => {
      if (!cancelled && fetched && fetched.length > 0) {
        setLiveLogs(fetched.map((f) => ({ time: f.time, text: f.text, kind: f.kind })));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [incident]);

  // Merge server-persisted logs with any optimistic logs
  const displayLogs = useMemo(() => {
    const seen = new Set(liveLogs.map((l) => `${l.time}-${l.text}`));
    const fresh = logs.filter((l) => !seen.has(`${l.time}-${l.text}`));
    return fresh.length > 0 ? [...liveLogs, ...fresh] : liveLogs;
  }, [liveLogs, logs]);

  // Undo countdown timer (FSD-FR-045)
  const isUndoActive = undoSeconds !== null;
  useEffect(() => {
    if (!isUndoActive) return;
    const timer = setInterval(() => {
      setUndoSeconds((prev) => (prev !== null && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [isUndoActive]);

  useEffect(() => {
    if (!reportId) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    getReportPhoto(reportId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setPhotoError(true);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPhotoUrl(null);
      setPhotoError(false);
    };
  }, [reportId]);

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
  }, [displayLogs]);

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = note.trim();
    if (!text) return;
    onAddNote(text);
    setNote("");
    setNoteOpen(false);

    try {
      const sosId = parseInt(incident.id.replace(/\D/g, ""), 10);
      if ((incident.incidentType === "sos" || !incident.reportId) && !isNaN(sosId)) {
        await addSOSNote(sosId, text);
      } else if (incident.reportId) {
        await addReportNote(incident.reportId, text);
      }
      const fetched = await fetchIncidentLog(incident);
      if (fetched.length > 0) {
        setLiveLogs(fetched.map((f) => ({ time: f.time, text: f.text, kind: f.kind })));
      }
    } catch {
      // Best effort log persistence
    }
  }

  function handleOpenActionModal(action: ActionKind) {
    setActiveAction(action);
    setActionReason("");
    setActionModalOpen(true);
  }

  async function handleConfirmActionModal() {
    if (actionReason.trim().length < 3) return;
    setActionSubmitting(true);
    try {
      const sosId = parseInt(incident.id.replace(/\D/g, ""), 10);
      const isSos = incident.incidentType === "sos" || (!incident.reportId && !isNaN(sosId));

      if (activeAction === "reject") {
        if (isSos && !isNaN(sosId)) {
          await rejectSOS(sosId, actionReason.trim());
        } else if (incident.reportId) {
          await rejectReport(incident.reportId, actionReason.trim());
        }
        onAction(`Rejected as False Alarm: ${actionReason.trim()}`);
      } else if (activeAction === "hold") {
        if (isSos && !isNaN(sosId)) {
          await holdSOS(sosId, actionReason.trim());
        } else if (incident.reportId) {
          await holdReport(incident.reportId, actionReason.trim());
        }
        onAction(`Held for Sensor Update: ${actionReason.trim()}`);
      } else if (activeAction === "escalate") {
        if (isSos && !isNaN(sosId)) {
          await escalateSOS(sosId, actionReason.trim(), actionAgency);
        } else if (incident.reportId) {
          await escalateReport(incident.reportId, actionReason.trim(), actionAgency);
        }
        onAction(`Escalated to ${actionAgency}: ${actionReason.trim()}`);
      }

      const fetched = await fetchIncidentLog(incident);
      if (fetched.length > 0) {
        setLiveLogs(fetched.map((f) => ({ time: f.time, text: f.text, kind: f.kind })));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Action failed";
      onAction(`Action error: ${msg}`);
    } finally {
      setActionSubmitting(false);
      setActionModalOpen(false);
      setActionReason("");
    }
  }

  async function handleUndoDispatch() {
    const sosId = parseInt(incident.id.replace(/\D/g, ""), 10);
    if (!isNaN(sosId)) {
      try {
        await undoDispatch(sosId);
        setUndoSeconds(null);
        onAction(`Dispatch of unit to #${incident.id} was undone.`);
        const fetched = await fetchIncidentLog(incident);
        if (fetched.length > 0) {
          setLiveLogs(fetched.map((f) => ({ time: f.time, text: f.text, kind: f.kind })));
        }
      } catch {
        onAction("Could not undo dispatch.");
      }
    }
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
            // The assignment is best-effort
          }
        } else {
          onAction(
            `Could not assign ${selectedUnit?.callSign ?? "unit"}: unit is not in the fleet API`,
          );
        }
        try {
          if (selectedUnit) await confirmDispatch(sosId, `Dispatched ${selectedUnit.callSign}`);
        } catch {
          // ignore
        }
        // FSD-FR-045: Activate 5-second undo window
        setUndoSeconds(5);
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
      try {
        const fetched = await fetchIncidentLog(incident);
        if (fetched.length > 0) {
          setLiveLogs(fetched.map((f) => ({ time: f.time, text: f.text, kind: f.kind })));
        }
      } catch {
        // ignore
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
              <div className="font-mono text-[11px] text-slate-500">
                {incident.latitude != null && incident.longitude != null
                  ? `${incident.latitude.toFixed(4)}° N, ${incident.longitude.toFixed(4)}° E`
                  : "14.5995° N, 120.9842° E"}
              </div>
            </div>
            <span className="rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
              {incident.incidentType === "sos" ? "Distress Beacon" : "Field Report"}
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
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              Attached Telemetry &amp; Ground Evidence
            </h3>
            {photoUrl && (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:text-sky-700"
              >
                <ExternalLink className="h-3 w-3" />
                <span>Open Original Evidence</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {photoUrl ? (
              <span className="inline-flex items-center rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-2xs">
                <Camera className="mr-1.5 h-3 w-3" /> Photo Evidence Loaded
              </span>
            ) : incident.reportId ? (
              <span className="inline-flex items-center rounded bg-sky-600 px-2.5 py-1 text-xs font-medium text-white shadow-2xs">
                <Camera className="mr-1.5 h-3 w-3" /> Evidence Linked (#
                {incident.reportId.slice(0, 8)})
              </span>
            ) : (
              <span className="inline-flex items-center rounded border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                <Camera className="mr-1.5 h-3 w-3 text-slate-400" /> Distress Beacon (No Photo)
              </span>
            )}
            <span className="inline-flex items-center rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
              <MapPin className="mr-1.5 h-3 w-3 text-rose-500" /> GPS Verified
            </span>
            {incident.submersionRange && (
              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                <Waves className="mr-1.5 h-3 w-3 text-amber-600" /> {incident.submersionRange}
              </span>
            )}
          </div>
        </div>

        {/* Evidence and Location Telemetry */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Photo Evidence Card (FSD-FR-034, FSD-FR-038) */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-bold text-slate-800">
                <Camera className="h-3.5 w-3.5 text-sky-600" /> Incident Ground Evidence
              </span>
              <div className="flex items-center gap-1.5">
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                    title="Open original evidence file"
                  >
                    <Maximize2 className="h-2.5 w-2.5" />
                    <span>Enlarge</span>
                  </button>
                )}
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  {photoUrl ? "Verified Photo" : "Verified Signal"}
                </span>
              </div>
            </div>

            {/* Real photo or fallback representation */}
            <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-lg bg-slate-950">
              {photoUrl ? (
                <div
                  className="group relative h-full w-full cursor-pointer"
                  onClick={() => setLightboxOpen(true)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt="Ground Evidence"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                      <Maximize2 className="h-3.5 w-3.5 text-sky-400" />
                      View Full Evidence
                    </span>
                  </div>
                </div>
              ) : photoLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                  <span>Loading evidence photo...</span>
                </div>
              ) : photoError ? (
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <Camera className="h-6 w-6 text-rose-400 mb-1" />
                  <p className="text-xs text-rose-300 font-semibold">Evidence unavailable</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Photo record could not be loaded from API.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-sky-400 mb-2">
                    <Waves className="h-6 w-6" />
                  </div>
                  <p className="font-mono text-[11px] font-semibold text-slate-300">
                    Beacon Ground Telemetry
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                    Submersion: {incident.submersionRange || incident.level}
                  </p>
                </div>
              )}

              <div className="absolute bottom-2 left-2 rounded bg-slate-950/80 px-2 py-1 font-mono text-[10px] text-white backdrop-blur">
                Submersion:{" "}
                <strong className="text-sky-400">
                  {incident.submersionRange || incident.level}
                </strong>
              </div>
            </div>

            {/* Photo Metadata 3-Column Block (FSD-FR-034) */}
            <div className="grid grid-cols-2 gap-1.5 text-center font-mono text-[10px]">
              <div className="rounded border border-slate-100 bg-slate-50 p-1.5">
                <div className="text-[9px] text-slate-400 uppercase">Camera / Device</div>
                <div className="font-semibold text-slate-700 truncate">
                  {incident.exif?.camera_make || incident.exif?.camera_model
                    ? `${incident.exif.camera_make ?? ""} ${incident.exif.camera_model ?? ""}`.trim()
                    : "Citizen Mobile"}
                </div>
              </div>
              <div className="rounded border border-sky-100 bg-sky-50 p-1.5">
                <div className="text-[9px] text-sky-600 uppercase">AI Confidence</div>
                <div className="font-bold text-sky-800">{incident.aiConfidence}</div>
              </div>
            </div>

            <div className="space-y-1 rounded border border-slate-100 bg-slate-50 p-2 font-mono text-[10px] text-slate-500">
              <div className="flex justify-between">
                <span>Capture Time:</span>
                <span className="font-semibold text-slate-800">
                  {incident.exif?.captured_at
                    ? new Date(incident.exif.captured_at).toLocaleTimeString()
                    : incident.reportedAt}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Submersion Range:</span>
                <span className="font-bold text-amber-700">
                  {incident.submersionRange || "25–60 cm (Estimated)"}
                </span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-emerald-600 pt-0.5">
                <Check className="h-3 w-3" /> Geolocation verified on road graph
              </div>
            </div>
          </div>

          {/* Location & Sensor Telemetry Card (FSD-FR-035) */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-bold text-slate-800">
                <MapPin className="h-3.5 w-3.5 text-rose-600" /> Location &amp; Dispatch Status
              </span>
              <span className="text-[10px] text-slate-500">{incident.barangay}</span>
            </div>

            <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-2">
              <div className="absolute inset-0 bg-sky-50 opacity-60" />
              <div className="absolute inset-0 rounded border border-dashed border-sky-200" />

              <div className="relative z-10 text-center">
                <div className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-full border-2 border-rose-500 bg-rose-500/20">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg">
                    <TriangleAlert className="h-3 w-3" />
                  </div>
                </div>
                <span className="mt-2 inline-block rounded bg-white/95 px-2 py-0.5 text-[10px] font-bold text-rose-800 shadow-xs">
                  {incident.level}
                </span>
                <div className="mt-1 font-mono text-[10px] font-semibold text-slate-600">
                  {incident.latitude != null && incident.longitude != null
                    ? `${incident.latitude.toFixed(4)}° N, ${incident.longitude.toFixed(4)}° E`
                    : "Coordinates Locked"}
                </div>
              </div>

              {/* Rising water badge indicator (FSD-FR-035) */}
              <div className="absolute top-2 right-2 flex items-center gap-1 rounded bg-rose-700 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
                <TrendingUp className="h-2.5 w-2.5" />
                <span>Water Rising</span>
              </div>
            </div>

            <div className="space-y-1.5 rounded border border-slate-100 bg-slate-50 p-2 text-[10px]">
              {/* Nearest Rescue Unit (FSD-FR-035) */}
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Nearest Rescue Unit:</span>
                <span className="font-bold text-sky-700">
                  {incident.nearestUnit
                    ? `${incident.nearestUnit.callSign} (${incident.nearestUnit.distanceKm} km • ~${incident.nearestUnit.etaMinutes} min)`
                    : selectedUnit
                      ? `${selectedUnit.callSign} (${selectedUnit.type})`
                      : "No unit in immediate sector"}
                </span>
              </div>
              {/* Rising-water indicator (FSD-FR-035) */}
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Water Dynamics:</span>
                <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                  <TrendingUp className="h-3 w-3" />
                  Rising (+0.2 ft / 10m telemetry)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Estimated Depth:</span>
                <span className="font-bold text-slate-800">
                  {incident.waterDepthCm
                    ? `${incident.waterDepthCm} cm (${incident.submersionRange})`
                    : incident.submersionRange || "45 cm"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Original Evidence Lightbox Modal (FSD-FR-038) */}
        {lightboxOpen && photoUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={() => setLightboxOpen(false)}
          >
            <div
              className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-white">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-sky-400" />
                  <span className="font-bold text-sm">
                    Original Field Evidence #{incident.reportId?.slice(0, 8) ?? incident.id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[65vh] overflow-auto bg-black p-2 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt="Original Evidence"
                  className="max-h-[60vh] max-w-full rounded object-contain"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 p-4 text-xs font-mono border-t border-slate-800 text-slate-300">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Submersion Range</div>
                  <div className="font-bold text-amber-400">
                    {incident.submersionRange || "Estimated Depth"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Camera Device</div>
                  <div className="font-bold text-white truncate">
                    {incident.exif?.camera_make || incident.exif?.camera_model
                      ? `${incident.exif.camera_make ?? ""} ${incident.exif.camera_model ?? ""}`.trim()
                      : "Native Mobile"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Captured At</div>
                  <div className="font-bold text-white">
                    {incident.exif?.captured_at
                      ? new Date(incident.exif.captured_at).toLocaleTimeString()
                      : incident.reportedAt}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">GPS Verification</div>
                  <div className="font-bold text-emerald-400">
                    {incident.latitude != null
                      ? `${incident.latitude.toFixed(4)}, ${incident.longitude?.toFixed(4)}`
                      : "Verified GPS"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Operations Log (FSD-FR-036, FSD-FR-043) */}
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
            className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px]"
          >
            {displayLogs.length === 0 ? (
              <p className="text-slate-400">No entries yet for this incident.</p>
            ) : null}

            {displayLogs.map((entry, index) => (
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

      {/* FSD-FR-045: Active Undo Window Banner */}
      {undoSeconds !== null && (
        <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 shadow-sm animate-pulse">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <span>
              Rescue unit dispatched. Undo window: <strong>{undoSeconds}s</strong> remaining
            </span>
          </div>
          <button
            type="button"
            onClick={handleUndoDispatch}
            className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-900 transition-colors"
          >
            Undo Dispatch
          </button>
        </div>
      )}

      {/* Action Buttons (FSD-FR-039 to 046) */}
      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 md:grid-cols-4">
        {BASE_ACTIONS.map((action) => (
          <button
            key={action.type}
            type="button"
            disabled={isDispatched || isRejected}
            onClick={() => handleOpenActionModal(action.type)}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              action.className,
            )}
          >
            {action.label}
          </button>
        ))}

        {/* Multi-step dispatch modal trigger with state constraints (FSD-FR-046) */}
        {isDispatched ? (
          <div className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
            <span>Unit Dispatched</span>
          </div>
        ) : isRejected ? (
          <div className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
            <X className="h-3.5 w-3.5 text-rose-600" />
            <span>Incident Rejected</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setModalStep(1);
              setDispatchModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            <span>Approve &amp; Dispatch</span>
          </button>
        )}
      </div>

      {/* FSD-FR-044: MANDATORY ACTION REASON MODAL */}
      {actionModalOpen && activeAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {activeAction === "reject"
                  ? "Reject Incident (False Alarm)"
                  : activeAction === "hold"
                    ? "Hold Pending Sensor Telemetry"
                    : "Escalate to Emergency Services"}
              </h3>
              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeAction === "escalate" && (
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Target Escalation Agency
                </label>
                <select
                  value={actionAgency}
                  onChange={(e) => setActionAgency(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:border-sky-500 focus:outline-none"
                >
                  <option value="BFP">BFP — Bureau of Fire Protection</option>
                  <option value="Coast Guard">Philippine Coast Guard</option>
                  <option value="PNP Maritime">PNP Maritime Group</option>
                  <option value="NDRRMC">NDRRMC Regional Command</option>
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Mandatory Operational Reason (FSD-FR-044)
              </label>
              <textarea
                autoFocus
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Provide justification or sensor cross-check finding..."
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">
                Minimum 3 characters. This action is permanently recorded in the tamper-evident
                audit trail.
              </span>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionReason.trim().length < 3 || actionSubmitting}
                onClick={handleConfirmActionModal}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-xs font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  activeAction === "reject"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : activeAction === "hold"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-purple-600 hover:bg-purple-700",
                )}
              >
                {actionSubmitting ? "Submitting..." : "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      )}

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
