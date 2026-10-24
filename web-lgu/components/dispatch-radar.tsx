"use client";

import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle,
  Clock,
  Droplets,
  Eye,
  EyeOff,
  FileText,
  MapPin,
  MessageSquare,
  Navigation,
  Send,
  Shield,
  User,
} from "lucide-react";
import { useState } from "react";

import { maskPhoneNumber, type Incident, type LogEntry } from "@/lib/incidents";

type DispatchRadarProps = {
  incident: Incident;
  logs: LogEntry[];
  queueCount: number;
  onBack: () => void;
  onAction: (label: string) => void;
  onMessage: (message: string) => void;
  onAddNote: (text: string) => void;
  onOpenDispatchModal?: () => void;
};

export function DispatchRadar({
  incident,
  onBack,
  onAction,
  onMessage,
  onAddNote,
  onOpenDispatchModal,
}: DispatchRadarProps) {
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
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

  function handleSaveNote() {
    if (!noteText.trim()) return;
    onAddNote(noteText.trim());
    setNoteText("");
    setNoteOpen(false);
  }

  return (
    <div className="space-y-6">
      {/* Top Header with Urgency Score and PII Masking */}
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
            <div className="font-mono text-xs text-slate-400">
              Anchor: 14.5995° N, 121.0223° E • Nearest Unit: RU-03 (4.2 km)
            </div>
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

            {/* Dispatched RU-03 Unit */}
            <div className="absolute top-[58%] left-[28%] flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/50">
                <Navigation className="h-4 w-4" />
              </div>
              <div className="mt-1 whitespace-nowrap rounded border border-sky-500 bg-slate-950/90 px-2 py-0.5 font-mono text-[10px] text-sky-300">
                RU-03 En Route (Speed: 28 km/h • Draft: 35 cm)
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
                    Dale Ramos ({displayedPhone})
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                    <CheckCircle className="h-3 w-3" /> Verified Citizen #CIT-8821
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Date &amp; Time</div>
                  <div className="text-xs font-semibold text-slate-800">Oct 24, 2026 11:42 AM</div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="h-3 w-3" /> 14 minutes ago
                  </div>
                </div>
              </div>
              <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-2.5">
                <div>
                  <div className="text-xs font-bold text-slate-800">{incident.barangay}</div>
                  <div className="font-mono text-[11px] text-slate-500">
                    14.5995° N, 121.0223° E
                  </div>
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
              <p className="mb-2 text-xs font-semibold text-slate-800">
                &ldquo;Flooding in residential area, 45-60 cm water level.&rdquo;
              </p>
              <p className="border-l-2 border-slate-300 pl-3 text-xs leading-relaxed text-slate-600 italic">
                Light passenger vehicles cannot pass. Water is actively rising from south canal
                overflow. 3 elderly citizens waiting at second floor porch.
              </p>
            </div>

            {/* Attached Telemetry & Evidence Chips */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                Attached Telemetry &amp; Evidence
              </h3>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded bg-sky-600 px-2.5 py-1 text-xs font-medium text-white shadow-2xs">
                  <Camera className="mr-1.5 h-3 w-3" /> Photo (1 Verified)
                </span>
                <span className="inline-flex items-center rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                  <MapPin className="mr-1.5 h-3 w-3 text-rose-500" /> GPS (Accurate ±4m)
                </span>
              </div>
              <div className="flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800">
                <Droplets className="mr-2 h-3.5 w-3.5 text-sky-600" />
                <span>IoT Depth Sensor #D-12 reading 48 cm nearby</span>
              </div>
            </div>

            {/* Photo Verification Metadata Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="text-[9px] font-bold text-slate-400 uppercase">Camera</div>
                <div className="text-xs font-semibold text-slate-700">iPhone 14 Pro</div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="text-[9px] font-bold text-slate-400 uppercase">Orientation</div>
                <div className="text-xs font-semibold text-slate-700">North-West</div>
              </div>
              <div className="rounded border border-sky-100 bg-sky-50 p-2">
                <div className="text-[9px] font-bold text-sky-600 uppercase">AI Confidence</div>
                <div className="text-xs font-bold text-sky-800">98.2% Authentic</div>
              </div>
            </div>

            {/* Recommended Rescue Resource */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">
                  Recommended: RU-03 (Swiftwater Boat)
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  AVAILABLE
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-600">
                <div>
                  <span className="block text-[9px] text-slate-400">SPEED</span>
                  <strong>28 km/h</strong>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400">CLEARANCE</span>
                  <strong>35 cm</strong>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400">CORRIDOR ETA</span>
                  <strong className="text-sky-700">12 mins</strong>
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
                onClick={() => onAction("Escalated to PNP / BFP Rescue Command")}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Escalate to PNP / BFP
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onAction(`Report #${incident.id} flagged as False Alarm`)}
                className="flex-1 rounded-lg border border-rose-200 bg-white py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                Reject Report
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onOpenDispatchModal) {
                    onOpenDispatchModal();
                  } else {
                    onAction(`Dispatched RU-03 to #${incident.id}`);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition-colors"
              >
                <Send className="h-3.5 w-3.5" /> Approve &amp; Dispatch
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
