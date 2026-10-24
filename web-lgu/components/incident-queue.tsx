"use client";

import { Search } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  QUEUE_FILTERS,
  countBySource,
  maskPhoneNumber,
  type Incident,
  type QueueFilter,
} from "@/lib/incidents";

type IncidentQueueProps = {
  incidents: Incident[];
  selectedId: string;
  filter: QueueFilter;
  query: string;
  dismissed: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onDismiss: (id: string) => void;
  onFilterChange: (filter: QueueFilter) => void;
  onQueryChange: (query: string) => void;
};

function urgencyClass(urgency: number) {
  if (urgency >= 8) {
    return "border-rose-200 bg-rose-100 text-rose-700";
  }

  if (urgency >= 6) {
    return "border-amber-200 bg-amber-100 text-amber-800";
  }

  return "border-sky-200 bg-sky-100 text-sky-700";
}

function tagClass(tag: string) {
  if (/impassable|escalated/i.test(tag)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (/rising|water/i.test(tag)) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-slate-200 bg-white text-slate-600";
}

export function IncidentQueue({
  incidents,
  selectedId,
  filter,
  query,
  dismissed,
  onSelect,
  onDismiss,
  onFilterChange,
  onQueryChange,
}: IncidentQueueProps) {
  const filters = QUEUE_FILTERS.map((option) => ({
    ...option,
    count: option.id === "all" ? incidents.length : countBySource(incidents, option.id),
  }));

  return (
    <div className="flex h-[720px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-5">
      <div className="space-y-3 border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Incoming Queue</h2>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">
              {incidents.length}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Sort by: <strong className="font-semibold text-slate-700">Urgency Score</strong>
          </span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          {filters.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onFilterChange(option.id)}
              aria-pressed={filter === option.id}
              className={cn(
                "flex-shrink-0 rounded-lg px-3 py-1 font-medium transition-colors",
                filter === option.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search Report ID, Citizen name, Barangay..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-9 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
        {incidents.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-400">No incidents match this filter.</p>
        ) : null}

        {incidents.map((incident) => {
          const selected = incident.id === selectedId;
          const isDismissed = dismissed.has(incident.id);
          const reporterDisplay = incident.reporter.includes("+63")
            ? maskPhoneNumber(incident.reporter)
            : incident.reporter;

          return (
            <div
              key={incident.id}
              onClick={() => onSelect(incident.id)}
              className={cn(
                "relative cursor-pointer border-l-4 p-4 transition-colors",
                selected
                  ? "border-sky-600 bg-sky-50/70 hover:bg-sky-50"
                  : "border-transparent hover:bg-slate-50/80",
                isDismissed && "opacity-40",
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800">#{incident.id}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                      urgencyClass(incident.urgency),
                    )}
                  >
                    Urgency {incident.urgency.toFixed(1)}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {incident.reportedAt.split("(")[1]?.replace(")", "")}
                </span>
              </div>

              <h3 className="mt-1 text-xs font-bold text-slate-900">{incident.location}</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">{reporterDisplay}</p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                {incident.tags.map((tag) => (
                  <span
                    key={tag}
                    className={cn("rounded border px-2 py-0.5 font-medium", tagClass(tag))}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDismiss(incident.id);
                  }}
                  className="rounded border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-200/60 hover:text-slate-800"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(incident.id);
                  }}
                  className={cn(
                    "rounded px-3 py-1 text-[11px] font-medium",
                    selected
                      ? "bg-sky-800 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  )}
                >
                  {selected ? "Reviewing Detail" : "Open"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
