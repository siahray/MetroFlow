"use client";

import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  FileText,
  MapPin,
  MessageSquare,
  Navigation,
  Send,
  Shield,
  User,
  Waves,
  X,
} from "lucide-react";
import { useState } from "react";

import { maskPhoneNumber, type Incident } from "@/lib/incidents";
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
  const [phoneRevealed, setPhoneRevealed] = useState(false);
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

  const rawPhone = "+63 917 555 0192";
  const displayedPhone = phoneRevealed ? rawPhone : maskPhoneNumber(rawPhone);

  function togglePhone() {
    setPhoneRevealed((prev) => {
      const next = !prev;
      onMessage(
        next
          ? "Authorized: Citizen phone number revealed for emergency dispatch."
          : "Citizen phone number masked for PII privacy protection.",
      );
      return next;
    });
  }

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
                Pending Verification
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Live distress telemetry stream and nearest rescue unit ranking (Sector Delta)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePhone}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Shield className="h-3.5 w-3.5 text-sky-600" />
            <span>
              {phoneRevealed
                ? "PII Revealed (Authorized)"
                : `PII Masked (${maskPhoneNumber(rawPhone)})`}
            </span>
            {phoneRevealed ? (
              <EyeOff className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <Eye className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>

          {/* Urgency Score Card */}
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-right shadow-2xs">
            <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              Urgency Score
            </div>
            <div className="text-base font-extrabold text-rose-600 leading-none">
              8.4<span className="text-xs font-medium text-slate-400">/10</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Radar Visual Display & Overlays (Left 7 Cols) */}
        <div className="relative flex min-h-[660px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-6 text-white shadow-xl lg:col-span-7">
          {/* Concentric circles and sweep */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25">
            <div className="h-[520px] w-[520px] rounded-full border border-sky-400" />
            <div className="absolute h-[380px] w-[380px] rounded-full border border-sky-400" />
            <div className="absolute h-[240px] w-[240px] rounded-full border border-sky-400" />
            <div className="absolute h-[100px] w-[100px] rounded-full border border-sky-400" />
            <div className="radar-sweep" />
          </div>

          {/* Top Radar telemetry header */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 backdrop-blur">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="font-mono text-xs font-bold text-sky-400">
                RADAR SWEEP: ACTIVE MONITORING
              </span>
            </div>
            <div className="font-mono text-xs text-slate-400">Anchor: {incident.location}</div>
          </div>

          {/* Interactive Pins on Radar */}
          <div className="relative z-10 flex flex-1 items-center justify-center">
            {/* Active SOS Target */}
            <div className="absolute top-[34%] left-[48%] flex flex-col items-center animate-bounce">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/50">
                <AlertOctagon className="h-5 w-5" />
              </div>
              <div className="mt-1 whitespace-nowrap rounded border border-rose-500 bg-slate-950/90 px-2 py-0.5 font-mono text-[10px] text-white">
                #{incident.id} (6 Trapped • 75 cm Submersion)
              </div>
            </div>

            {/* Dispatched Unit */}
            <div className="absolute top-[58%] left-[28%] flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/50">
                <Navigation className="h-4 w-4" />
              </div>
              <div className="mt-1 whitespace-nowrap rounded border border-sky-500 bg-slate-950/90 px-2 py-0.5 font-mono text-[10px] text-sky-300">
                Unit En Route
              </div>
            </div>
          </div>

          {/* Bottom Telemetry Specs */}
          <div className="relative z-10 grid grid-cols-3 gap-4 rounded-xl border border-slate-800 bg-slate-950/85 p-4 font-mono text-xs backdrop-blur">
            <div>
              <span className="block text-[10px] text-slate-400 uppercase">Monitor Frequency</span>
              <span className="font-bold text-white">156.800 MHz (Ch. 16 Marine)</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 uppercase">Distress Priority</span>
              <span className="font-bold text-rose-400">Level 3 Critical Flood</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 uppercase">Response Range</span>
              <span className="font-bold text-emerald-400">5.8 km Safe Corridor</span>
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
                  <div className="text-xs font-bold text-slate-900">
                    {incident.reporter} ({displayedPhone})
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                    <CheckCircle className="h-3 w-3" /> Citizen SOS Verified
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Date &amp; Time</div>
                  <div className="text-xs font-semibold text-slate-800">{incident.reportedAt}</div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="h-3 w-3" /> Verified Incident
                  </div>
                </div>
              </div>
              <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-2.5">
                <div>
                  <div className="text-xs font-bold text-slate-800">{incident.barangay}</div>
                  <div className="font-mono text-[11px] text-slate-500">{incident.location}</div>
                </div>
                <span className="rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                  Sector Delta
                </span>
              </div>
            </div>

            {/* Citizen Field Description Banner */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <h3 className="mb-2 flex items-center text-xs font-bold tracking-wider text-slate-500 uppercase">
                <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-slate-400" /> Citizen Field
                Description
              </h3>
              <p className="text-xs font-semibold text-slate-800">
                &ldquo;{incident.narrative}&rdquo;
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
              <div className="rounded border border-sky-100 bg-sky-50 p-2">
                <div className="text-[9px] font-bold text-sky-600 uppercase">AI Confidence</div>
                <div className="text-xs font-bold text-sky-800">{incident.aiConfidence}</div>
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
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                  {incident.nearestUnit?.status ?? "AVAILABLE"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-600">
                <div>
                  <span className="block text-[9px] text-slate-400">DISTANCE</span>
                  <strong>
                    {incident.nearestUnit ? `${incident.nearestUnit.distanceKm} km` : "1.2 km"}
                  </strong>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400">DEPTH</span>
                  <strong>{incident.waterDepthCm ? `${incident.waterDepthCm} cm` : "35 cm"}</strong>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400">CORRIDOR ETA</span>
                  <strong className="text-sky-700">
                    {incident.nearestUnit ? `~${incident.nearestUnit.etaMinutes} mins` : "12 mins"}
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
