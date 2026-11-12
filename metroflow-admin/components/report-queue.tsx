"use client";

import { Camera, CheckSquare, Copy, MapPin, Search, Square, Users } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { ageLabel, type FieldReport } from "@/lib/reports";
import { ConfirmDialog } from "./confirm-dialog";

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
  /** P3-3: bulk decisions. The page owns the API calls and the reload. */
  busy?: boolean;
  onBulkApprove: (reportIds: string[]) => void;
  onBulkReject: (reportIds: string[], reason: string) => void;
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
  busy = false,
  onBulkApprove,
  onBulkReject,
  onSelect,
  onFilterChange,
  onQueryChange,
}: ReportQueueProps) {
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmingApprove, setConfirmingApprove] = useState(false);

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setChecked(new Set());
    setRejecting(false);
    setRejectReason("");
    setConfirmingApprove(false);
  }

  function confirmApprove() {
    onBulkApprove([...checked]);
    exitSelectMode();
  }

  function confirmReject() {
    const reason = rejectReason.trim();
    if (!reason) return;
    onBulkReject([...checked], reason);
    exitSelectMode();
  }
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
            <button
              type="button"
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              aria-pressed={selectMode}
              className={cn(
                "rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                selectMode
                  ? "border-sky-600 bg-sky-50 text-sky-800"
                  : "border-slate-200 text-slate-500 hover:bg-slate-100",
              )}
            >
              {selectMode ? "Done" : "Select"}
            </button>
          </div>
          <span className="text-xs text-slate-500">
            Sort by: <strong className="font-semibold text-slate-700">Live urgency</strong>
          </span>
        </div>

        {selectMode ? (
          <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sky-900">{checked.size} selected</span>
              <button
                type="button"
                onClick={() => setChecked(new Set(reports.map((r) => r.report_id)))}
                className="font-medium text-sky-700 hover:underline"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setChecked(new Set())}
                className="font-medium text-sky-700 hover:underline"
              >
                None
              </button>
              <span className="flex-1" />
              <button
                type="button"
                disabled={checked.size === 0 || busy}
                onClick={() => setConfirmingApprove(true)}
                className="rounded-lg bg-emerald-600 px-2.5 py-1 font-bold text-white disabled:opacity-40"
              >
                Approve selected
              </button>
              <button
                type="button"
                disabled={checked.size === 0 || busy}
                onClick={() => setRejecting((open) => !open)}
                className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 font-bold text-rose-600 disabled:opacity-40"
              >
                Reject selected
              </button>
            </div>
            {rejecting ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label="Rejection reason for selected reports"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Reason applied to every selected report…"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!rejectReason.trim() || busy}
                  onClick={confirmReject}
                  className="flex-shrink-0 rounded-lg bg-rose-600 px-2.5 py-1 font-bold text-white disabled:opacity-40"
                >
                  Confirm reject
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

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
                  ? "bg-brand-primary text-white"
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
          const isChecked = checked.has(report.report_id);

          return (
            <button
              key={report.report_id}
              type="button"
              onClick={() =>
                selectMode ? toggleChecked(report.report_id) : onSelect(report.report_id)
              }
              aria-current={selected ? "true" : undefined}
              className={cn(
                "block w-full border-l-4 p-4 text-left transition-colors",
                selected
                  ? "border-sky-600 bg-sky-50/70 hover:bg-sky-50"
                  : "border-transparent hover:bg-slate-50/80",
                selectMode && isChecked && "bg-sky-100/60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {selectMode ? (
                    isChecked ? (
                      <CheckSquare className="h-4 w-4 flex-shrink-0 text-sky-700" />
                    ) : (
                      <Square className="h-4 w-4 flex-shrink-0 text-slate-300" />
                    )
                  ) : null}
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

      {confirmingApprove ? (
        <ConfirmDialog
          title={`Approve ${checked.size} report${checked.size === 1 ? "" : "s"}?`}
          confirmLabel={`Approve ${checked.size} report${checked.size === 1 ? "" : "s"}`}
          tone="primary"
          busy={busy}
          onConfirm={confirmApprove}
          onClose={() => setConfirmingApprove(false)}
        >
          Approving creates and publishes a hazard at each report&apos;s location, immediately
          visible to driver routing. This cannot be undone from the queue.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
