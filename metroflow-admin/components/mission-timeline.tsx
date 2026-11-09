"use client";

import {
  CheckCircle2,
  CircleDot,
  Flag,
  MapPin,
  Navigation,
  Radio,
  Truck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { getDispatchEvents, type DispatchEvent } from "@/lib/dispatch";

/**
 * Mission milestone timeline (FSD-FR-087 to 089, BACKLOG F-4).
 *
 * Reads `GET /api/v1/dispatch/{id}/events` — the `dispatch_events` table is the
 * source of truth, written in the same transaction as each lifecycle change.
 * Rendered as an ordered list rather than a progress bar so every milestone
 * carries its own timestamp, actor and note accessibly.
 */

const MILESTONES: Record<string, { label: string; icon: typeof Flag; className: string }> = {
  created: {
    label: "Signal received",
    icon: Radio,
    className: "border-slate-300 bg-slate-100 text-slate-600",
  },
  assigned: {
    label: "Unit assigned",
    icon: UserCheck,
    className: "border-sky-300 bg-sky-50 text-sky-700",
  },
  dispatched: {
    label: "Dispatched",
    icon: Truck,
    className: "border-sky-400 bg-sky-100 text-sky-800",
  },
  en_route: {
    label: "En route",
    icon: Navigation,
    className: "border-indigo-300 bg-indigo-50 text-indigo-700",
  },
  arrived: {
    label: "On scene",
    icon: MapPin,
    className: "border-amber-300 bg-amber-50 text-amber-800",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "border-emerald-400 bg-emerald-100 text-emerald-800",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "border-rose-300 bg-rose-50 text-rose-700",
  },
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function MissionTimeline({
  sosId,
  refreshKey = 0,
}: {
  sosId: number;
  /** Bump to re-fetch, e.g. after a dispatch action on the same incident. */
  refreshKey?: number;
}) {
  const [events, setEvents] = useState<DispatchEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDispatchEvents(sosId)
      .then((rows) => {
        if (!cancelled) {
          setEvents(rows);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sosId, refreshKey]);

  if (failed) return null;
  if (events === null) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-500 uppercase">
          Mission Timeline
        </h3>
        <p className="text-[11px] text-slate-400">Loading milestones…</p>
      </div>
    );
  }
  if (events.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-500 uppercase">
        <CircleDot className="h-3.5 w-3.5 text-slate-400" /> Mission Timeline
      </h3>
      <ol className="space-y-0">
        {events.map((event, index) => {
          const milestone = MILESTONES[event.event_type] ?? {
            label: event.event_type,
            icon: CircleDot,
            className: "border-slate-300 bg-slate-100 text-slate-600",
          };
          const Icon = milestone.icon;
          const last = index === events.length - 1;
          return (
            <li key={event.event_id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    milestone.className,
                  )}
                >
                  <Icon className="h-3 w-3" />
                </span>
                {!last ? <span className="w-px flex-1 bg-slate-200" /> : null}
              </div>
              <div className={cn("pb-4", last && "pb-1")}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs font-bold text-slate-800">{milestone.label}</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {formatTime(event.created_at)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {[event.call_sign ? `Unit ${event.call_sign}` : null, event.actor, event.note]
                    .filter(Boolean)
                    .join(" · ") || "System"}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
