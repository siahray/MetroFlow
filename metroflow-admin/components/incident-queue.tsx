"use client";

import {
  Search,
  RefreshCw,
  AlertCircle,
  Inbox,
  FilterX,
  SlidersHorizontal,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { hoursUntilPurge } from "@/lib/dismissed";
import {
  EMPTY_ADVANCED_FILTERS,
  isAdvancedFilterActive,
  type AdvancedFilters,
} from "@/lib/advanced-filters";
import {
  QUEUE_FILTERS,
  countByFilter,
  maskPhoneNumber,
  type Incident,
  type QueueFilter,
} from "@/lib/incidents";
import { IncidentQueueSkeleton } from "./skeleton";

type IncidentQueueProps = {
  incidents: Incident[];
  /** Unfiltered incidents, used to offer every barangay in the advanced panel. */
  allIncidents: Incident[];
  selectedId: string;
  filter: QueueFilter;
  query: string;
  advanced: AdvancedFilters;
  view: "active" | "dismissed";
  dismissedCount: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelect: (id: string) => void;
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
  onViewChange: (view: "active" | "dismissed") => void;
  onFilterChange: (filter: QueueFilter) => void;
  onQueryChange: (query: string) => void;
  onAdvancedChange: (filters: AdvancedFilters) => void;
};

const PRESETS_KEY = "metroflow.queue.presets.v1";

type SavedPreset = { name: string; filters: AdvancedFilters };

function loadPresets(): SavedPreset[] {
  try {
    const raw = window.localStorage.getItem(PRESETS_KEY);
    return raw ? (JSON.parse(raw) as SavedPreset[]) : [];
  } catch {
    return [];
  }
}

function storePresets(presets: SavedPreset[]) {
  try {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // Presets are a convenience; a full/blocked store just skips them.
  }
}

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

const AGE_OPTIONS = [
  { value: "", label: "Any age" },
  { value: "1", label: "Last hour" },
  { value: "24", label: "Last 24 hours" },
  { value: "168", label: "Last 7 days" },
] as const;

const URGENCY_OPTIONS = [
  { value: "", label: "Any urgency" },
  { value: "3", label: "Score ≥ 3" },
  { value: "5", label: "Score ≥ 5" },
  { value: "7", label: "Score ≥ 7" },
] as const;

const selectClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none";

export function IncidentQueue({
  incidents,
  allIncidents,
  selectedId,
  filter,
  query,
  advanced,
  view,
  dismissedCount,
  loading = false,
  error = null,
  onRetry,
  onSelect,
  onDismiss,
  onRestore,
  onViewChange,
  onFilterChange,
  onQueryChange,
  onAdvancedChange,
}: IncidentQueueProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [presets, setPresets] = useState<SavedPreset[]>(() =>
    typeof window === "undefined" ? [] : loadPresets(),
  );
  const [presetName, setPresetName] = useState("");
  // P3-3: bulk selection. `confirmBulk` holds the pending bulk verb so the
  // destructive-ish action takes two clicks instead of one.
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState<"dismiss" | "restore" | null>(null);

  const barangays = useMemo(
    () =>
      [...new Set(allIncidents.map((i) => i.barangay).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [allIncidents],
  );

  const advancedActive = isAdvancedFilterActive(advanced);

  function patchAdvanced(patch: Partial<AdvancedFilters>) {
    onAdvancedChange({ ...advanced, ...patch });
  }

  function savePreset() {
    const name = presetName.trim();
    if (!name || !advancedActive) return;
    const next = [...presets.filter((p) => p.name !== name), { name, filters: advanced }];
    setPresets(next);
    storePresets(next);
    setPresetName("");
  }

  function deletePreset(name: string) {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    storePresets(next);
  }

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
    setConfirmBulk(null);
  }

  async function runBulk() {
    const verb = view === "dismissed" ? "restore" : "dismiss";
    for (const id of checked) {
      await (verb === "dismiss" ? onDismiss(id) : onRestore(id));
    }
    exitSelectMode();
  }
  const filters = QUEUE_FILTERS.map((option) => ({
    ...option,
    count: option.id === "all" ? incidents.length : countByFilter(incidents, option.id),
  }));

  return (
    <div className="flex h-[720px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-5">
      <div className="space-y-3 border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Incoming Queue</h2>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">
              {loading ? "..." : incidents.length}
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
            Sort by: <strong className="font-semibold text-slate-700">Urgency Score</strong>
          </span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          {(
            [
              ["active", "Queue"],
              ["dismissed", `Dismissed (${dismissedCount})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              aria-pressed={view === id}
              className={cn(
                "flex-shrink-0 rounded-lg border px-3 py-1 font-semibold transition-colors",
                view === id
                  ? "border-sky-700 bg-sky-50 text-sky-800"
                  : "border-slate-200 text-slate-500 hover:bg-slate-100",
              )}
            >
              {label}
            </button>
          ))}
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
                  ? "bg-brand-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>

        {selectMode ? (
          <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs">
            <span className="font-semibold text-sky-900">{checked.size} selected</span>
            <button
              type="button"
              onClick={() => setChecked(new Set(incidents.map((i) => i.id)))}
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
            {confirmBulk ? (
              <>
                <span className="font-medium text-sky-900">
                  {view === "dismissed" ? "Restore" : "Dismiss"} {checked.size} incident
                  {checked.size === 1 ? "" : "s"}?
                </span>
                <button
                  type="button"
                  onClick={() => void runBulk()}
                  className="rounded-lg bg-brand-primary px-2.5 py-1 font-bold text-white"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBulk(null)}
                  className="rounded-lg border border-sky-300 px-2.5 py-1 font-medium text-sky-800"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={checked.size === 0}
                onClick={() => setConfirmBulk(view === "dismissed" ? "restore" : "dismiss")}
                className="rounded-lg bg-brand-primary px-2.5 py-1 font-bold text-white disabled:opacity-40"
              >
                {view === "dismissed" ? "Restore selected" : "Dismiss selected"}
              </button>
            )}
          </div>
        ) : null}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              id="incident-search"
              type="search"
              aria-label="Search incidents"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search Report ID, Citizen name, Barangay..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-9 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
            aria-label="Advanced filters"
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              advancedOpen || advancedActive
                ? "border-sky-600 bg-sky-50 text-sky-800"
                : "border-slate-200 text-slate-600 hover:bg-slate-100",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {advancedActive ? <span className="h-1.5 w-1.5 rounded-full bg-sky-600" /> : null}
          </button>
        </div>

        {advancedOpen ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                Barangay
                <select
                  aria-label="Filter by barangay"
                  value={advanced.barangay}
                  onChange={(event) => patchAdvanced({ barangay: event.target.value })}
                  className={cn(selectClass, "mt-1")}
                >
                  <option value="">Any barangay</option>
                  {barangays.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                Type
                <select
                  aria-label="Filter by incident type"
                  value={advanced.type}
                  onChange={(event) =>
                    patchAdvanced({ type: event.target.value as AdvancedFilters["type"] })
                  }
                  className={cn(selectClass, "mt-1")}
                >
                  <option value="all">SOS + Reports</option>
                  <option value="sos">SOS signals</option>
                  <option value="report">Field reports</option>
                </select>
              </label>
              <label className="block text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                Age
                <select
                  aria-label="Filter by age"
                  value={advanced.maxAgeHours === null ? "" : String(advanced.maxAgeHours)}
                  onChange={(event) =>
                    patchAdvanced({
                      maxAgeHours: event.target.value === "" ? null : Number(event.target.value),
                    })
                  }
                  className={cn(selectClass, "mt-1")}
                >
                  {AGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                Urgency
                <select
                  aria-label="Filter by minimum urgency"
                  value={advanced.minUrgency === null ? "" : String(advanced.minUrgency)}
                  onChange={(event) =>
                    patchAdvanced({
                      minUrgency: event.target.value === "" ? null : Number(event.target.value),
                    })
                  }
                  className={cn(selectClass, "mt-1")}
                >
                  {URGENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-2">
              {presets.length > 0 ? (
                <select
                  aria-label="Saved filter presets"
                  value=""
                  onChange={(event) => {
                    const preset = presets.find((p) => p.name === event.target.value);
                    if (preset) onAdvancedChange(preset.filters);
                  }}
                  className={selectClass}
                >
                  <option value="">Saved presets…</option>
                  {presets.map((preset) => (
                    <option key={preset.name} value={preset.name}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  title={`Delete preset ${preset.name}`}
                  aria-label={`Delete preset ${preset.name}`}
                  onClick={() => deletePreset(preset.name)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              ))}
              {advancedActive ? (
                <>
                  <input
                    type="text"
                    aria-label="Preset name"
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                    placeholder="Preset name"
                    className={cn(selectClass, "min-w-0 flex-1")}
                  />
                  <button
                    type="button"
                    onClick={savePreset}
                    disabled={!presetName.trim()}
                    className="flex-shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  >
                    Save
                  </button>
                </>
              ) : null}
              {advancedActive ? (
                <button
                  type="button"
                  onClick={() => onAdvancedChange(EMPTY_ADVANCED_FILTERS)}
                  className="flex-shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-200"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-rose-500" />
            <p className="text-xs text-slate-600">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            )}
          </div>
        ) : loading ? (
          <IncidentQueueSkeleton count={5} />
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <Inbox className="h-12 w-12 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No incidents match this filter</p>
            <p className="text-xs text-slate-500">
              {query.trim() || filter !== "all"
                ? "Try adjusting your search or filter to see more incidents."
                : view === "dismissed"
                  ? "Dismissed incidents stay here for 72 hours, then are deleted."
                  : "All incidents have been processed. Great work!"}
            </p>
            {filter !== "all" && (
              <button
                type="button"
                onClick={() => onFilterChange("all")}
                className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <FilterX className="h-3 w-3" />
                Clear filter
              </button>
            )}
          </div>
        ) : (
          incidents.map((incident) => {
            const selected = incident.id === selectedId;
            const reporterDisplay = incident.reporter.includes("+63")
              ? maskPhoneNumber(incident.reporter)
              : incident.reporter;

            const isChecked = checked.has(incident.id);
            return (
              <div
                key={incident.id}
                onClick={() => (selectMode ? toggleChecked(incident.id) : onSelect(incident.id))}
                className={cn(
                  "relative cursor-pointer border-l-4 p-4 transition-colors",
                  selected
                    ? "border-sky-600 bg-sky-50/70 hover:bg-sky-50"
                    : "border-transparent hover:bg-slate-50/80",
                  selectMode && isChecked && "bg-sky-100/60",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {selectMode ? (
                      isChecked ? (
                        <CheckSquare className="h-4 w-4 flex-shrink-0 text-sky-700" />
                      ) : (
                        <Square className="h-4 w-4 flex-shrink-0 text-slate-300" />
                      )
                    ) : null}
                    <span className="font-mono text-xs font-bold text-slate-800">
                      #{incident.id}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                        incident.urgency === null
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : urgencyClass(incident.urgency),
                      )}
                    >
                      {incident.urgency === null ? "SOS" : `Urgency ${incident.urgency.toFixed(1)}`}
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
                      (view === "dismissed" ? onRestore : onDismiss)(incident.id);
                    }}
                    className="rounded border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-200/60 hover:text-slate-800"
                  >
                    {view === "dismissed" ? "Restore" : "Dismiss"}
                  </button>
                  {incident.dismissedAt ? (
                    <span className="self-center text-[10px] text-slate-400">
                      Deleted in {hoursUntilPurge(incident.dismissedAt)}h
                    </span>
                  ) : null}
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
          })
        )}
      </div>
    </div>
  );
}
