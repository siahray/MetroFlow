"use client";

import {
  AlertTriangle,
  Camera,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Maximize2,
  MessageSquare,
  Radar,
  Send,
  TriangleAlert,
  User,
  Waves,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { MissionTimeline } from "@/components/mission-timeline";
import { ConfirmDialog } from "./confirm-dialog";
import { cn } from "@/lib/cn";
import { incidentTagClass, maskPhoneNumber, type Incident, type LogEntry } from "@/lib/incidents";
import { toUnitStatus, type RescueUnit } from "@/lib/rescue";
import {
  addSOSNote,
  assignSOS,
  confirmDispatch,
  escalateSOS,
  fetchIncidentLog,
  holdSOS,
  listVehicles,
  previewDispatchRoute,
  rejectSOS,
  undoDispatch,
  type DispatchPreview,
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
  onAction: (label: string) => void;
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

/** Section label used inside the docket body: sentence case, one icon, optional aside. */
function SectionHeading({
  icon: Icon,
  title,
  aside,
}: {
  icon: typeof Camera;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <Icon className="h-3.5 w-3.5 text-sky-600" />
        {title}
      </h3>
      {aside}
    </div>
  );
}

export function IncidentDetail({ incident, onAction, onDispatchConfirmed }: IncidentDetailProps) {
  const logRef = useRef<HTMLDivElement | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [vehicles, setVehicles] = useState<RescueUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<RescueUnit | null>(null);
  // FSD-FR-089: the route is previewed by the API before the dispatch is committed.
  const [preview, setPreview] = useState<DispatchPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // FSD-FR-036 / FSD-FR-043: Persisted operations log
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);

  // FSD-FR-044: Action reason modal state
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionKind | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionAgency, setActionAgency] = useState("BFP");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // FSD-FR-045: Undo window state
  const [undoSeconds, setUndoSeconds] = useState<number | null>(null);
  const [confirmingUndo, setConfirmingUndo] = useState(false);

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

  // Mission timeline applies to SOS dispatches only; field reports have no unit.
  const sosIdNum = parseInt(incident.id.replace(/\D/g, ""), 10);
  const isSosIncident = !reportId && (incident.incidentType === "sos" || !isNaN(sosIdNum));

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

  // FSD-FR-036 / FSD-FR-043: the operations log lives in the database; this
  // screen only reads it back, so there is one source of truth per incident.

  // Undo countdown timer (FSD-FR-045). Paused while the confirmation is open so
  // the window cannot close mid-decision.
  const isUndoActive = undoSeconds !== null;
  useEffect(() => {
    if (!isUndoActive || confirmingUndo) return;
    const timer = setInterval(() => {
      setUndoSeconds((prev) => (prev !== null && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [isUndoActive, confirmingUndo]);

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
            location:
              v.current_location_lat != null && v.current_location_lon != null
                ? `${v.current_location_lat.toFixed(4)}, ${v.current_location_lon.toFixed(4)}`
                : "Position not reported",
            vehicleId: v.vehicle_id,
          }));
          setVehicles(mapped);
          setSelectedUnit(mapped.find((unit) => unit.status === "AVAILABLE") ?? null);
        }
      } catch {
        // No units are listed while the fleet API is down; the assign step then shows none.
      }
    };
    load();
  }, []);

  useEffect(() => {
    const node = logRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [liveLogs]);

  // FSD-FR-088, FSD-FR-089: rank the available units and preview the chosen
  // route as soon as the workflow opens. A unit without telemetry or a safe
  // route is reported, not hidden, and never blocks the dispatch.
  useEffect(() => {
    if (!dispatchModalOpen) return;
    const sosId = parseInt(incident.id.replace(/\D/g, ""), 10);
    if (isNaN(sosId)) return;

    let cancelled = false;
    const load = async () => {
      setPreview(null);
      setPreviewError(null);
      try {
        // If a specific unit is selected, preview only that unit (backlog #12)
        const vehicleId = selectedUnit?.vehicleId;
        const result = await previewDispatchRoute(sosId, vehicleId);
        if (!cancelled) setPreview(result);
      } catch (error) {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(error instanceof Error ? error.message : "Route preview unavailable");
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [dispatchModalOpen, incident.id, selectedUnit?.vehicleId]);

  const selectedPreview =
    preview?.units.find((unit) => unit.vehicle_id === selectedUnit?.vehicleId) ?? null;

  // BRULE-011: only available units are selectable. The API ranks them by
  // flood-safe travel time; units it could not route keep their place after them.
  const rankedUnits = [...vehicles].sort((a, b) => {
    const available = (unit: RescueUnit) => unit.status === "AVAILABLE";
    if (available(a) !== available(b)) return available(a) ? -1 : 1;
    const eta = (unit: RescueUnit) =>
      preview?.units.find((row) => row.vehicle_id === unit.vehicleId)
        ?.estimated_travel_time_minutes ?? Number.POSITIVE_INFINITY;
    return eta(a) - eta(b);
  });

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = note.trim();
    if (!text) return;
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
        setConfirmingUndo(false);
        onAction(`Dispatch of unit to #${incident.id} was undone.`);
        const fetched = await fetchIncidentLog(incident);
        if (fetched.length > 0) {
          setLiveLogs(fetched.map((f) => ({ time: f.time, text: f.text, kind: f.kind })));
        }
      } catch {
        setConfirmingUndo(false);
        onAction("Could not undo dispatch.");
      }
    }
  }

  async function handleConfirmDispatch() {
    const sosId = parseInt(incident.id.replace(/\D/g, ""), 10);
    const unit = selectedUnit;
    if (isNaN(sosId)) return;
    if (!unit?.vehicleId) {
      onAction(`Could not assign ${unit?.callSign ?? "unit"}: unit is not in the fleet API`);
      return;
    }

    // BRULE-011: a refused assignment must stop the flow instead of reporting a
    // dispatch that never happened.
    try {
      await assignSOS(sosId, unit.vehicleId);
    } catch (error) {
      onAction(error instanceof Error ? error.message : "Could not assign the selected unit.");
      return;
    }
    try {
      await confirmDispatch(sosId, `Dispatched ${unit.callSign}`);
    } catch {
      onAction("Unit assigned, but the dispatch confirmation failed. Try again.");
      return;
    }

    // FSD-FR-045: Activate 5-second undo window
    setUndoSeconds(5);
    setDispatchModalOpen(false);
    onAction(`Dispatched ${unit.callSign} (${unit.type}) to #${incident.id}`);
    onDispatchConfirmed?.(unit.callSign, incident.id);
    try {
      const fetched = await fetchIncidentLog(incident);
      setLiveLogs(fetched.map((f) => ({ time: f.time, text: f.text, kind: f.kind })));
    } catch {
      // The Action Log refreshes on the next incident change.
    }
  }

  // Only mask a phone that is actually in the label. "Citizen Distress Signal
  // (SOS)" contains a bracket but no number, and masking it invented one.
  const reporterHasPhone = /\d[\d\s-]{6,}/.test(incident.reporter);
  const rawReporter = reporterHasPhone
    ? `${incident.reporter.split("(")[0].trim()} (${maskPhoneNumber(incident.reporter)})`
    : incident.reporter;

  const depthLabel =
    incident.waterDepthCm != null
      ? `${incident.waterDepthCm} cm (${incident.submersionRange})`
      : incident.submersionRange || "Not reported";

  const cameraDevice =
    [incident.exif?.camera_make, incident.exif?.camera_model].filter(Boolean).join(" ") ||
    "Unknown device";

  const capturedLabel = incident.exif?.captured_at
    ? new Date(incident.exif.captured_at).toLocaleTimeString()
    : "Not recorded";

  const nearestUnitLabel = incident.nearestUnit
    ? `${incident.nearestUnit.callSign} / ${incident.nearestUnit.distanceKm} km / ~${incident.nearestUnit.etaMinutes} min`
    : selectedUnit
      ? `${selectedUnit.callSign} (${selectedUnit.type})`
      : "No unit available";

  return (
    <div className="flex h-[620px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-7 lg:h-[calc(100vh-13rem)] lg:min-h-[560px]">
      {/* Docket header: identity and place, stated once. */}
      <header className="flex-shrink-0 border-b border-slate-200 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-lg font-bold text-slate-900">#{incident.id}</span>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
            {incident.level}
          </span>
          <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
            {incident.incidentType === "sos" ? "SOS signal" : "Field report"}
          </span>
          <span className="flex-1" />
          <Link
            href={`/radar?id=${encodeURIComponent(incident.id)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
            title="View distress signal on Emergency Dispatch Radar"
          >
            <Radar className="h-3.5 w-3.5 text-sky-600" />
            Radar
          </Link>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
          <span className="font-medium text-slate-700">{incident.barangay}</span>
          <span className="text-slate-500">/</span>
          <span>Filed {incident.reportedAt}</span>
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-12">
          {/* Left: who reported it, what they said, and what happened next. */}
          <div className="space-y-5 lg:col-span-7">
            <section>
              <SectionHeading icon={User} title="Reporter" />
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">{rawReporter}</span>
                </div>
                {incident.incidentType === "sos" ? (
                  <dl className="mt-2.5 grid grid-cols-2 gap-2 border-t border-slate-200 pt-2.5">
                    <div>
                      <dt className="text-[10px] font-medium text-slate-600">Call-back</dt>
                      <dd className="font-mono text-xs font-semibold text-slate-800">
                        {incident.reporterPhone ?? "Not provided"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium text-slate-600">Vehicle plate</dt>
                      <dd className="font-mono text-xs font-semibold text-slate-800">
                        {incident.plateNumber ?? "Not provided"}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            </section>

            <section>
              <SectionHeading icon={MessageSquare} title="Witness narrative" />
              <blockquote className="border-l-2 border-slate-300 pl-3 text-xs leading-relaxed text-slate-700">
                {incident.narrative ? (
                  <>&ldquo;{incident.narrative}&rdquo;</>
                ) : (
                  <span className="text-slate-500">No description was given.</span>
                )}
              </blockquote>
            </section>

            {incident.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {incident.tags.map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      "rounded border px-2 py-0.5 text-[10px] font-medium",
                      incidentTagClass(tag),
                    )}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Original Evidence Lightbox Modal (FSD-FR-038) */}
            {lightboxOpen && photoUrl && (
              <div
                className="fixed inset-0 z-50 flex animate-backdrop-in items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
                onClick={() => setLightboxOpen(false)}
              >
                <div
                  className="relative max-h-[90vh] max-w-4xl animate-modal-in overflow-hidden rounded-2xl border border-slate-700 bg-brand-primary shadow-2xl"
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

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-brand-primary p-4 text-xs font-mono border-t border-slate-800 text-slate-300">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Submersion Range</div>
                      <div className="font-bold text-amber-400">
                        {incident.submersionRange || "Not reported"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Camera Device</div>
                      <div className="font-bold text-white truncate">
                        {incident.exif?.camera_make || incident.exif?.camera_model
                          ? `${incident.exif.camera_make ?? ""} ${incident.exif.camera_model ?? ""}`.trim()
                          : "Not recorded"}
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
                      <div className="text-[10px] text-slate-500 uppercase">Coordinates</div>
                      <div className="font-bold text-emerald-400">
                        {incident.latitude != null
                          ? `${incident.latitude.toFixed(4)}, ${incident.longitude?.toFixed(4)}`
                          : "Not reported"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mission Milestone Timeline (FSD-FR-087 to 089) — refreshes whenever
            the operations log gains an entry, i.e. after each dispatch action */}
            {isSosIncident && !isNaN(sosIdNum) && (
              <MissionTimeline sosId={sosIdNum} refreshKey={liveLogs.length} />
            )}

            {/* Operations Log (FSD-FR-036, FSD-FR-043) */}
            <section>
              <SectionHeading
                icon={FileText}
                title="Operations log"
                aside={
                  <button
                    type="button"
                    onClick={() => setNoteOpen((current) => !current)}
                    aria-expanded={noteOpen}
                    className="text-[11px] font-medium text-sky-700 hover:text-sky-800"
                  >
                    {noteOpen ? "Cancel" : "+ Add internal note"}
                  </button>
                }
              />

              <div
                ref={logRef}
                className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px]"
              >
                {liveLogs.length === 0 ? (
                  <p className="text-slate-600">No entries yet for this incident.</p>
                ) : null}

                {liveLogs.map((entry, index) => (
                  <div
                    key={`${entry.time}-${index}`}
                    className={cn(
                      entry.kind === "muted" && "text-slate-500",
                      entry.kind === "action" && "font-semibold text-slate-700",
                      entry.kind === "note" && "text-sky-900 font-medium",
                    )}
                  >
                    <span className="font-mono text-slate-600">{entry.time}</span> {entry.text}
                  </div>
                ))}
              </div>

              {noteOpen ? (
                <form onSubmit={handleAddNote} className="mt-2 flex items-center gap-2">
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
            </section>
          </div>

          {/* Right: what the evidence and the ground say about the location. */}
          <div className="space-y-5 lg:col-span-5">
            <section>
              <SectionHeading
                icon={Camera}
                title="Ground evidence"
                aside={
                  photoUrl ? (
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:text-sky-800"
                    >
                      <Maximize2 className="h-3 w-3" /> Enlarge
                    </button>
                  ) : null
                }
              />
              <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-lg bg-slate-950">
                {photoUrl ? (
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    aria-label="Open original evidence"
                    className="group relative h-full w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl}
                      alt="Ground evidence"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-slate-950/25 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                        <Maximize2 className="h-3.5 w-3.5 text-sky-400" />
                        View full size
                      </span>
                    </span>
                  </button>
                ) : photoLoading ? (
                  <div className="flex flex-col items-center gap-2 text-xs text-slate-400">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                    <span>Loading evidence…</span>
                  </div>
                ) : photoError ? (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <Camera className="mb-1 h-6 w-6 text-rose-400" />
                    <p className="text-xs font-semibold text-rose-300">Evidence unavailable</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      The photo record could not be loaded.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-sky-400">
                      <Waves className="h-6 w-6" />
                    </div>
                    <p className="font-mono text-[11px] font-semibold text-slate-300">
                      No photo attached
                    </p>
                    <p className="mt-1 max-w-[200px] text-[10px] text-slate-400">
                      This report is a witness statement.
                    </p>
                  </div>
                )}
              </div>

              <dl className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded border border-slate-100 bg-slate-50 p-1.5">
                  <dt className="text-slate-600">Camera</dt>
                  <dd className="truncate font-semibold text-slate-700">{cameraDevice}</dd>
                </div>
                <div className="rounded border border-slate-100 bg-slate-50 p-1.5">
                  <dt className="text-slate-600">Captured</dt>
                  <dd className="font-semibold text-slate-700">{capturedLabel}</dd>
                </div>
              </dl>
              {incident.photo ? (
                <p className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[10px] text-slate-600">
                  <span>{incident.photo.mime}</span>
                  <span>{Math.round(incident.photo.bytes / 1024)} KB</span>
                  {incident.photo.sha256 ? (
                    <span>sha256 {incident.photo.sha256.slice(0, 12)}…</span>
                  ) : null}
                </p>
              ) : null}
            </section>

            <section>
              <SectionHeading icon={MapPin} title="Location and response" />
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-sky-50">
                  <div className="absolute inset-0 rounded border border-dashed border-sky-200" />
                  <div className="relative z-10 text-center">
                    <div className="mx-auto flex h-11 w-11 animate-pulse items-center justify-center rounded-full border-2 border-rose-500 bg-rose-500/20">
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white shadow">
                        <TriangleAlert className="h-2.5 w-2.5" />
                      </div>
                    </div>
                    <p className="mt-1.5 font-mono text-[10px] font-semibold text-slate-600">
                      {incident.latitude != null && incident.longitude != null
                        ? `${incident.latitude.toFixed(4)}° N, ${incident.longitude.toFixed(4)}° E`
                        : "Coordinates not reported"}
                    </p>
                  </div>
                </div>

                <dl className="mt-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-slate-500">Reported depth</dt>
                    <dd className="text-right font-semibold text-slate-800">{depthLabel}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-slate-500">Nearest unit</dt>
                    <dd className="text-right font-semibold text-sky-700">{nearestUnitLabel}</dd>
                  </div>
                </dl>
              </div>
            </section>
          </div>
        </div>
      </div>

      <footer className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3">
        {undoSeconds !== null ? (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              Dispatched. Undo closes in <strong>{undoSeconds}s</strong>
            </span>
            <button
              type="button"
              onClick={() => setConfirmingUndo(true)}
              className="rounded-md bg-amber-800 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-amber-900"
            >
              Undo dispatch
            </button>
          </div>
        ) : null}

        {/* FSD-FR-039 to 046: decisions stay visible without scrolling the docket. */}
        <div className="flex flex-wrap items-center gap-2">
          {BASE_ACTIONS.map((action) => (
            <button
              key={action.type}
              type="button"
              disabled={isDispatched || isRejected}
              onClick={() => handleOpenActionModal(action.type)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                action.className,
              )}
            >
              {action.label}
            </button>
          ))}

          <span className="flex-1" />

          {isDispatched ? (
            <span className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              Unit dispatched
            </span>
          ) : isRejected ? (
            <span className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800">
              <X className="h-3.5 w-3.5 text-rose-600" />
              Incident rejected
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setModalStep(1);
                setDispatchModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-700/20 transition-colors hover:bg-emerald-800"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve &amp; dispatch
            </button>
          )}
        </div>
      </footer>

      {/* FSD-FR-044: MANDATORY ACTION REASON MODAL */}
      {actionModalOpen && activeAction && (
        <div className="fixed inset-0 z-50 flex animate-backdrop-in items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-modal-in space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
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
                <label
                  htmlFor="incident-escalation-agency"
                  className="block text-xs font-bold text-slate-700"
                >
                  Target Escalation Agency
                </label>
                <select
                  id="incident-escalation-agency"
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
              <label
                htmlFor="incident-action-reason"
                className="block text-xs font-bold text-slate-700"
              >
                Mandatory Operational Reason (FSD-FR-044)
              </label>
              <textarea
                id="incident-action-reason"
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
        <div className="fixed inset-0 z-50 flex animate-backdrop-in items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl animate-modal-in space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
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
                    <span className="font-mono font-bold text-sky-700">
                      {incident.submersionRange || "Not reported"}
                    </span>
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
                  {rankedUnits.map((unit) => {
                    const isSelected = selectedUnit?.callSign === unit.callSign;
                    const unitPreview =
                      preview?.units.find((row) => row.vehicle_id === unit.vehicleId) ?? null;
                    const selectable = unit.status === "AVAILABLE";
                    return (
                      <label
                        key={unit.callSign}
                        onClick={() => {
                          if (!selectable) return;
                          setSelectedUnit(unit);
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-xl p-3 border transition-colors",
                          !selectable && "opacity-60",
                          isSelected
                            ? "border-sky-600 bg-sky-50/60"
                            : "border-slate-200 bg-white hover:bg-slate-50",
                          selectable ? "cursor-pointer" : "cursor-not-allowed",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="unit-select"
                            checked={isSelected}
                            disabled={!selectable}
                            onChange={() => {
                              if (!selectable) return;
                              setSelectedUnit(unit);
                            }}
                            className="text-sky-600 disabled:cursor-not-allowed"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {unit.callSign} ({unit.type})
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Clearance: {unit.clearance_cm} cm • Speed: {unit.speed_kmh} km/h
                              {selectable && unitPreview?.estimated_travel_time_minutes != null
                                ? ` • ETA ~${Math.round(unitPreview.estimated_travel_time_minutes)} min • ${Math.round((unitPreview.total_distance_m ?? 0) / 100) / 10} km`
                                : selectable && unitPreview?.detail
                                  ? ` • ${unitPreview.detail}`
                                  : ""}
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
                    disabled={!selectedUnit || selectedUnit.status !== "AVAILABLE"}
                    className="flex-1 rounded-lg bg-sky-600 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Preview Safe Route &rarr;
                  </button>
                </div>
              </div>
            ) : null}

            {/* Step 3 Content */}
            {modalStep === 3 ? (
              <div className="space-y-4">
                {!preview && !previewError ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    Calculating the flood-safe route for {selectedUnit?.callSign}…
                  </div>
                ) : selectedPreview?.estimated_travel_time_minutes != null ? (
                  <div className="space-y-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                    <span className="flex items-center gap-1 font-bold">
                      <CheckCircle className="h-4 w-4 text-emerald-600" /> Safe Corridor Verified
                    </span>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      A clearance-aware route (
                      {Math.round((selectedPreview.total_distance_m ?? 0) / 100) / 10} km) avoiding
                      all blocking flood hazards has been calculated for {selectedUnit?.callSign}.
                      {selectedPreview.hazards.length > 0
                        ? ` It crosses ${selectedPreview.hazards.length} reported hazard zone${
                            selectedPreview.hazards.length === 1 ? "" : "s"
                          }.`
                        : ""}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <span className="flex items-center gap-1 font-bold">
                      <AlertTriangle className="h-4 w-4 text-amber-600" /> No route preview
                    </span>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {selectedPreview?.detail ??
                        previewError ??
                        "The road network could not produce a route for this unit."}{" "}
                      The dispatch can still be confirmed.
                    </p>
                  </div>
                )}
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
                    <strong className="text-emerald-700">
                      {selectedPreview?.estimated_travel_time_minutes != null
                        ? `~ ${Math.round(selectedPreview.estimated_travel_time_minutes)} mins`
                        : "Route unavailable"}
                    </strong>
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

      {confirmingUndo ? (
        <ConfirmDialog
          title={`Undo the dispatch to #${incident.id}?`}
          confirmLabel="Undo dispatch"
          onConfirm={() => void handleUndoDispatch()}
          onClose={() => setConfirmingUndo(false)}
        >
          The unit returns to available and the incident goes back to awaiting dispatch. Drivers
          already en route may not see the cancellation.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
