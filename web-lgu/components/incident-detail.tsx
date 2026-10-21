"use client";

import { Camera, Check, FileText, MapPin, MessageSquare, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";
import type { Incident, LogEntry } from "@/lib/incidents";

type IncidentDetailProps = {
  incident: Incident;
  logs: LogEntry[];
  onAction: (label: string) => void;
  onAddNote: (text: string) => void;
};

const ACTIONS = [
  {
    label: "Reject / False Alarm",
    className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  },
  {
    label: "Escalate to BFP / Coast Guard",
    className: "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200",
  },
  {
    label: "Hold for Sensor Update",
    className: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  },
  {
    label: "Approve & Dispatch RU-03",
    className:
      "border-transparent bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700",
  },
];

export function IncidentDetail({ incident, logs, onAction, onAddNote }: IncidentDetailProps) {
  const logRef = useRef<HTMLDivElement | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const node = logRef.current;

    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [logs]);

  function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = note.trim();

    if (!text) {
      return;
    }

    onAddNote(text);
    setNote("");
    setNoteOpen(false);
  }

  return (
    <div className="flex flex-col justify-between space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-rose-800 px-2.5 py-0.5 text-xs font-semibold text-white uppercase">
                Incident Docket
              </span>
              <span className="font-mono text-base font-bold text-slate-900">#{incident.id}</span>
              <span className="rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                {incident.level}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
              <span>
                Reported by: <strong className="text-slate-900">{incident.reporter}</strong>
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

        <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
            <span>Citizen Witness Narrative</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-700 italic">{incident.narrative}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-bold text-slate-800">
                <Camera className="h-3.5 w-3.5 text-sky-600" /> Citizen Photo Evidence
              </span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                Metadata Intact
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
                AI Submersion Est: <strong className="text-sky-400">0.65m - 0.85m</strong>
              </div>
            </div>

            <div className="space-y-0.5 rounded border border-slate-100 bg-slate-50 p-2 font-mono text-[10px] text-slate-500">
              <div>
                Device: <span className="text-slate-800">iPhone 14 Pro</span>
              </div>
              <div>
                Timestamp: <span className="text-slate-800">11:40:22 AM PHT</span>
              </div>
              <div>
                GPS Coords: <span className="text-slate-800">14.5995° N, 121.0223° E</span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-emerald-600">
                <Check className="h-3 w-3" /> Cell tower triangulation validated
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-bold text-slate-800">
                <MapPin className="h-3.5 w-3.5 text-rose-600" /> Location & Sensor Telemetry
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
                  Incident Radius: 300m
                </span>
              </div>

              <div className="absolute top-2 right-2 rounded bg-rose-800 px-1.5 py-0.5 text-[9px] font-bold text-white">
                Flood Zone 1
              </div>
            </div>

            <div className="space-y-1 rounded border border-slate-100 bg-slate-50 p-2 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Nearest Rescue:</span>
                <span className="font-bold text-sky-700">RU-03 (Zodiac) • 12 min away</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Spillway Sensor #D-12:</span>
                <span className="font-bold text-rose-600">4.8m (Critical Overtopping)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Rain Gauge Sta. Rosa:</span>
                <span className="font-bold text-sky-700">38mm/hr (Torrential)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-[11px] font-bold tracking-wider text-slate-700 uppercase">
              <FileText className="h-3.5 w-3.5 text-slate-400" /> Operations Log & Responders
              Allocation Notes
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
                  entry.kind === "note" && "text-sky-900",
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

      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 md:grid-cols-4">
        {ACTIONS.map((action) => (
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
      </div>
    </div>
  );
}
