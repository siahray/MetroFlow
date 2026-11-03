"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  Navigation,
  Send,
  User,
  Waves,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { type Incident } from "@/lib/incidents";
import { cn } from "@/lib/cn";
import { addSOSNote, escalateSOS, rejectSOS } from "@/lib/dispatch";
import { addReportNote, escalateReport, rejectReport } from "@/lib/reports";

type DispatchRadarProps = {
  incident: Incident;
  queueCount: number;
  onBack: () => void;
  onAction: (label: string) => void;
  onMessage: (message: string) => void;
  onOpenDispatchModal?: () => void;
};

export function DispatchRadar({
  incident,
  onBack,
  onAction,
  onMessage,
  onOpenDispatchModal,
}: DispatchRadarProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<"reject" | "escalate" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionAgency, setActionAgency] = useState("BFP");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // FSD-FR-043: notes and actions persist through the API; this screen has no
  // log panel of its own, so it does not keep a copy to drift out of date.
  const isDispatched =
    incident.tags.includes("Vehicle Assigned") || incident.tags.includes("Dispatched");
  const isRejected = incident.tags.includes("Rejected");

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    const text = noteText.trim();

    try {
      const sosId = parseInt(incident.id.replace(/\D/g, ""), 10);
      if ((incident.incidentType === "sos" || !incident.reportId) && !isNaN(sosId)) {
        await addSOSNote(sosId, text);
      } else if (incident.reportId) {
        await addReportNote(incident.reportId, text);
      } else {
        throw new Error("Incident has no identifier");
      }
      setNoteText("");
      setNoteOpen(false);
      onMessage("Internal note saved to incident log");
    } catch {
      // The toast says "not saved" because the row really is not there.
      onMessage("Note could not be saved. Check the connection and try again.");
    }
  }

  function handleOpenActionModal(action: "reject" | "escalate") {
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
      } else if (activeAction === "escalate") {
        if (isSos && !isNaN(sosId)) {
          await escalateSOS(sosId, actionReason.trim(), actionAgency);
        } else if (incident.reportId) {
          await escalateReport(incident.reportId, actionReason.trim(), actionAgency);
        }
        onAction(`Escalated to ${actionAgency}: ${actionReason.trim()}`);
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

  return (
    <div className="space-y-6">
      {/* Top Header with Urgency Score and PII Masking */}
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
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Emergency Dispatch Radar #{incident.id}
              </h2>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                Awaiting dispatch decision
              </span>
            </div>
            <p className="text-xs text-slate-500">Distress details and the nearest rescue unit</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-right shadow-2xs">
            <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              {incident.urgency === null ? "Priority" : "Urgency score"}
            </div>
            <div className="text-base font-extrabold leading-none text-rose-600">
              {incident.urgency === null ? "SOS" : incident.urgency.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Incident location and response facts (left 7 cols): real data only */}
        <div className="flex min-h-[420px] flex-col justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
          <div>
            <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              Incident location
            </h3>
            <p className="mt-2 font-mono text-lg font-bold text-slate-900">{incident.location}</p>
            <p className="mt-1 text-xs text-slate-500">
              {incident.barangay} · reported {incident.reportedAt}
            </p>
            <Link
              href="/hazards"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Navigation className="h-3.5 w-3.5" /> Open the live operations map
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Water depth</div>
              <div className="mt-1 text-sm font-bold text-slate-900">
                {incident.waterDepthCm != null
                  ? `${incident.waterDepthCm} cm`
                  : incident.submersionRange || "Not reported"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Urgency</div>
              <div className="mt-1 text-sm font-bold text-slate-900">
                {incident.urgency === null
                  ? incident.level
                  : `${incident.urgency.toFixed(1)} · ${incident.level}`}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Nearest unit</div>
              <div className="mt-1 text-sm font-bold text-slate-900">
                {incident.nearestUnit
                  ? `${incident.nearestUnit.callSign} · ${incident.nearestUnit.distanceKm} km`
                  : "No unit with a known position"}
              </div>
              {incident.nearestUnit ? (
                <div className="text-[11px] text-slate-500">
                  ~{incident.nearestUnit.etaMinutes} min straight-line estimate
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Docket, Parameters, and Dispatch Action Side Panel (Right 5 Cols) */}
        <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5 overflow-y-auto">
          <div className="space-y-4">
            {/* Submission Parameters Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h3 className="mb-3 flex items-center text-xs font-bold tracking-wider text-slate-500 uppercase">
                <User className="mr-1.5 h-3.5 w-3.5 text-slate-400" /> Submission Parameters
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Submitted by</div>
                  <div className="text-xs font-bold text-slate-900">{incident.reporter}</div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                    <CheckCircle className="h-3 w-3" /> Citizen SOS
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Date &amp; Time</div>
                  <div className="text-xs font-semibold text-slate-800">{incident.reportedAt}</div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="h-3 w-3" /> Reported
                  </div>
                </div>
              </div>
              <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-2.5">
                <div>
                  <div className="text-xs font-bold text-slate-800">{incident.barangay}</div>
                  <div className="font-mono text-[11px] text-slate-500">{incident.location}</div>
                </div>
              </div>
            </div>

            {/* Citizen Field Description Banner */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <h3 className="mb-2 flex items-center text-xs font-bold tracking-wider text-slate-500 uppercase">
                <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-slate-400" /> Citizen Field
                Description
              </h3>
              <p className="text-xs font-semibold text-slate-800">
                {incident.narrative ? (
                  <>&ldquo;{incident.narrative}&rdquo;</>
                ) : (
                  "No description was given."
                )}
              </p>
            </div>

            {/* Attached Telemetry & Evidence Chips */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                Attached Telemetry &amp; Evidence
              </h3>
              <div className="flex flex-wrap gap-2">
                {incident.photo || incident.reportId ? (
                  <span className="inline-flex items-center rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-2xs">
                    <Camera className="mr-1.5 h-3 w-3" /> Photo Attached
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                    <Camera className="mr-1.5 h-3 w-3 text-slate-400" /> Distress Beacon
                  </span>
                )}
                <span className="inline-flex items-center rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                  <MapPin className="mr-1.5 h-3 w-3 text-rose-500" /> GPS (Road Node Match)
                </span>
                {incident.submersionRange && (
                  <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                    <Waves className="mr-1.5 h-3 w-3 text-amber-600" /> {incident.submersionRange}
                  </span>
                )}
              </div>
            </div>

            {/* Verification Metadata Grid */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="text-[9px] font-bold text-slate-400 uppercase">Source</div>
                <div className="text-xs font-semibold text-slate-700 uppercase">
                  {incident.source}
                </div>
              </div>
            </div>

            {/* Recommended Rescue Resource (FSD-FR-035) */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">
                  {incident.nearestUnit
                    ? `Recommended: ${incident.nearestUnit.callSign}`
                    : "Recommended: Assign nearest vehicle"}
                </span>
                {incident.nearestUnit ? (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                    {incident.nearestUnit.status}
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-600">
                <div>
                  <span className="block text-[9px] text-slate-400">DISTANCE</span>
                  <strong>
                    {incident.nearestUnit ? `${incident.nearestUnit.distanceKm} km` : "—"}
                  </strong>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400">DEPTH</span>
                  <strong>
                    {incident.waterDepthCm != null ? `${incident.waterDepthCm} cm` : "Not reported"}
                  </strong>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400">CORRIDOR ETA</span>
                  <strong className="text-sky-700">
                    {incident.nearestUnit ? `~${incident.nearestUnit.etaMinutes} mins` : "—"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Note Input Accordion */}
            {noteOpen && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Add Operational Triage Note
                </label>
                <textarea
                  rows={2}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Record verification findings or responder notes..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:border-sky-500 focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setNoteOpen(false)}
                    className="rounded px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    className="rounded bg-slate-900 px-3 py-1 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNoteOpen((prev) => !prev)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span>Add Note</span>
              </button>
              <button
                type="button"
                disabled={isDispatched || isRejected}
                onClick={() => handleOpenActionModal("escalate")}
                className="flex-1 rounded-lg border border-purple-200 bg-purple-50 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Escalate (BFP)
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDispatched || isRejected}
                onClick={() => handleOpenActionModal("reject")}
                className="flex-1 rounded-lg border border-rose-200 bg-white py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reject / False Alarm
              </button>
              {isDispatched ? (
                <div className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 py-2 text-xs font-bold text-emerald-800">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Dispatched
                </div>
              ) : isRejected ? (
                <div className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 py-2 text-xs font-bold text-rose-800">
                  <X className="h-3.5 w-3.5 text-rose-600" /> Rejected
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenDispatchModal) {
                      onOpenDispatchModal();
                    } else {
                      onAction(`Dispatched unit to #${incident.id}`);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition-colors"
                >
                  <Send className="h-3.5 w-3.5" /> Approve &amp; Dispatch
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Reason Modal for Radar */}
      {actionModalOpen && activeAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {activeAction === "reject"
                  ? "Reject Incident (False Alarm)"
                  : "Escalate to Emergency Command"}
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
                placeholder="State reason or verified ground condition..."
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">
                Minimum 3 characters. Persisted to the immutable audit trail.
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
                  "rounded-lg px-4 py-1.5 text-xs font-bold text-white transition-colors disabled:opacity-40",
                  activeAction === "reject"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-purple-600 hover:bg-purple-700",
                )}
              >
                {actionSubmitting ? "Submitting..." : "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
