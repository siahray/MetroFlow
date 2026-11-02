"use client";

import { Camera, Copy, MapPin, Search, Users } from "lucide-react";

import { cn } from "@/lib/cn";
import { ageLabel, type FieldReport } from "@/lib/reports";

export type ReportFilter = "all" | "PHOTO" | "CALL" | "SENSOR";

export const REPORT_FILTERS: { id: ReportFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "PHOTO", label: "Photo" },
  { id: "CALL", label: "Call" },
  { id: "SENSOR", label: "Sensor" },
];

type ReportQueueProps = {
  reports: FieldReport[];
  selectedId: string;
  filter: ReportFilter;
  query: string;
  onSelect: (reportId: string) => void;
  onFilterChange: (filter: ReportFilter) => void;
  onQueryChange: (query: string) => void;
};

function urgencyClass(urgency: number) {
  if (urgency >= 3) return "border-rose-200 bg-rose-100 text-rose-700";
  if (urgency >= 1.5) return "border-amber-200 bg-amber-100 text-amber-800";
  return "border-sky-200 bg-sky-100 text-sky-700";
}

function depthClass(level: string) {
  switch (level) {
    case "IMPASSABLE":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "KNEE":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-sky-200 bg-sky-50 text-sky-700";
  }
}

export function ReportQueue({
  reports,
  selectedId,
  filter,
  query,
  onSelect,
  onFilterChange,
  onQueryChange,
}: ReportQueueProps) {
  const filters = REPORT_FILTERS.map((option) => ({
    ...option,
    count:
      option.id === "all"
        ? reports.length
        : reports.filter((report) => report.source === option.id).length,
  }));

  return (
    <div className="flex h-[760px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-5">
      <div className="space-y-3 border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Pending Reports</h2>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">
              {reports.length}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Sort by: <strong className="font-semibold text-slate-700">Live urgency</strong>
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
            placeholder="Search report ID, barangay, narrative..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-9 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
        {reports.length === 0 ? (
          <div className="space-y-1 p-6 text-center">
            <p className="text-xs font-semibold text-slate-600">No pending reports</p>
            <p className="text-[11px] text-slate-400">
              A field report appears here the moment a driver submits one, newest evidence first.
            </p>
          </div>
        ) : null}

        {reports.map((report) => {
          const selected = report.report_id === selectedId;

          return (
            <button
              key={report.report_id}
              type="button"
              onClick={() => onSelect(report.report_id)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "block w-full border-l-4 p-4 text-left transition-colors",
                selected
                  ? "border-sky-600 bg-sky-50/70 hover:bg-sky-50"
                  : "border-transparent hover:bg-slate-50/80",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800">
                    #{report.report_id.slice(0, 8)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                      urgencyClass(report.urgency_score),
                    )}
                  >
                    Urgency {report.urgency_score.toFixed(1)}
                  </span>
                </div>
                <span className="flex-shrink-0 text-[11px] text-slate-400">
                  {ageLabel(report.submitted_at)}
                </span>
              </div>

              <h3 className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-900">
                <MapPin className="h-3 w-3 flex-shrink-0 text-slate-400" />
                {report.barangay || "Barangay not given"}
              </h3>

              <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                {report.narrative || "No narrative supplied."}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span
                  className={cn(
                    "rounded border px-2 py-0.5 font-semibold",
                    depthClass(report.depth_level),
                  )}
                >
                  {report.depth_label}
                </span>
                <span className="rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-600">
                  {report.source}
                </span>
                {report.photo ? (
                  <span className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-600">
                    <Camera className="h-3 w-3" /> Evidence
                  </span>
                ) : null}
                {report.nearby_reports > 0 ? (
                  <span className="flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                    <Users className="h-3 w-3" /> +{report.nearby_reports} nearby
                  </span>
                ) : null}
                {report.possible_duplicate_of ? (
                  <span className="flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                    <Copy className="h-3 w-3" /> Possible duplicate
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
