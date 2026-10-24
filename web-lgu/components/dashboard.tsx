"use client";

import {
  Bot,
  ChevronRight,
  CircleCheck,
  CloudRain,
  Siren,
  Timer,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { DispatchRadar } from "./dispatch-radar";
import { FloodClosureEditor } from "./flood-closure-editor";
import { IncidentDetail } from "./incident-detail";
import { IncidentQueue } from "./incident-queue";
import { RescueTracking } from "./rescue-tracking";
import { Sidebar } from "./sidebar";
import { useToast } from "./toast-provider";
import {
  INCIDENTS,
  INCIDENT_BY_ID,
  INITIAL_LOGS,
  type LogEntry,
  type QueueFilter,
} from "@/lib/incidents";

type View = "triage" | "radar" | "sensors" | "fleet";

const VIEW_TITLES: Record<View, string> = {
  triage: "Incident Triage & Verification",
  radar: "Emergency Dispatch Radar",
  sensors: "Live Map & Hazard Authoring",
  fleet: "Rescue Fleet & Mission Operations",
};

type KpiCard = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  iconClassName: string;
  trend?: { text: string; icon?: LucideIcon; className: string };
};

const KPI_CARDS: KpiCard[] = [
  {
    label: "Verified Today",
    value: "34",
    detail: "29 Dispatched to Responders",
    trend: { text: "+28%", icon: TrendingUp, className: "text-emerald-600" },
    icon: CircleCheck,
    iconClassName: "border-emerald-100 bg-emerald-50 text-emerald-600",
  },
  {
    label: "Avg Triage Speed",
    value: "4.2 min",
    detail: "Target SLA: < 5.0 mins",
    icon: Timer,
    iconClassName: "border-sky-100 bg-sky-50 text-sky-600",
  },
  {
    label: "AI Fraud / Duplicate Filter",
    value: "99.1%",
    detail: "11 duplicate spams screened",
    trend: { text: "Accurate", className: "text-sky-600" },
    icon: Bot,
    iconClassName: "border-indigo-100 bg-indigo-50 text-indigo-600",
  },
];

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const { show } = useToast();
  const [view, setView] = useState<View>("triage");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(INCIDENTS[0].id);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>(INITIAL_LOGS);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return INCIDENTS.filter((incident) => {
      const matchesFilter = filter === "all" || incident.source === filter;
      const matchesQuery =
        needle === "" ||
        [incident.id, incident.reporter, incident.location, incident.barangay].some((value) =>
          value.toLowerCase().includes(needle),
        );

      return matchesFilter && matchesQuery;
    });
  }, [filter, query]);

  const selected = INCIDENT_BY_ID.get(selectedId) ?? INCIDENTS[0];
  const selectedLogs = logs[selected.id] ?? [];
  const pendingCount = INCIDENTS.length - dismissed.size;

  const appendLog = useCallback((id: string, text: string, kind: LogEntry["kind"]) => {
    setLogs((current) => ({
      ...current,
      [id]: [...(current[id] ?? []), { time: nowLabel(), text, kind }],
    }));
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleDismiss = useCallback(
    (id: string) => {
      setDismissed((current) => new Set(current).add(id));
      show(`Incident #${id} dismissed from active queue`);
    },
    [show],
  );

  const handleAction = useCallback(
    (label: string) => {
      show(`${label} executed for #${selected.id}`);
      appendLog(selected.id, `Action: ${label} by Operator M. Santos.`, "action");
    },
    [appendLog, selected.id, show],
  );

  const handleAddNote = useCallback(
    (text: string) => {
      appendLog(selected.id, `Note: ${text}`, "note");
      show("Internal note saved to incident log");
    },
    [appendLog, selected.id, show],
  );

  const handleNavigate = useCallback(
    (id: string, label: string) => {
      if (id === "triage" || id === "fleet" || id === "sensors" || id === "radar") {
        setView(id as View);
        return;
      }

      show(`${label} is out of scope for pilot.`);
    },
    [show],
  );

  const handleDispatchConfirmed = useCallback(
    (unitCallSign: string, incidentId: string) => {
      show(`Rescue Unit ${unitCallSign} successfully dispatched to #${incidentId}!`);
      setView("fleet");
    },
    [show],
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 text-slate-800 select-none">
      <Sidebar
        activeItem={view}
        queueCount={pendingCount}
        onSignOut={onSignOut}
        onNavigate={handleNavigate}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Operations Header */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 z-20">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400">Operations HQ</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="font-semibold text-slate-800">{VIEW_TITLES[view]}</span>
            <span className="rounded border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-700">
              SECTOR DELTA ACTIVE
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-600">
              <CloudRain className="h-3.5 w-3.5 text-sky-600" />
              <span>28°C Rain Advisory (38 mm/hr)</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" />
              <span>Active SOS: 14</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                MS
              </div>
              <div>
                <div className="leading-tight font-semibold text-slate-800">Maria Santos</div>
                <div className="text-[10px] text-slate-400">Lead Dispatch Officer</div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 space-y-6 overflow-y-auto p-6">
          {view === "fleet" ? (
            <RescueTracking onBack={() => setView("triage")} onAction={show} />
          ) : view === "sensors" ? (
            <FloodClosureEditor onAction={show} />
          ) : view === "radar" ? (
            <DispatchRadar
              incident={selected}
              logs={selectedLogs}
              queueCount={pendingCount}
              onBack={() => setView("triage")}
              onAction={handleAction}
              onMessage={show}
              onAddNote={handleAddNote}
              onOpenDispatchModal={() => setView("triage")}
            />
          ) : (
            <>
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      Pending Triage
                    </p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-slate-900">{pendingCount}</span>
                      <span className="text-xs font-semibold text-rose-600">3 Critical</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">Queue velocity: +4 in last hr</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-600">
                    <Siren className="h-5 w-5" />
                  </div>
                </div>

                {KPI_CARDS.map((card) => {
                  const Icon = card.icon;
                  const TrendIcon = card.trend?.icon;

                  return (
                    <div
                      key={card.label}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div>
                        <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                          {card.label}
                        </p>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-slate-900">{card.value}</span>
                          {card.trend ? (
                            <span
                              className={`flex items-center text-xs font-medium ${card.trend.className}`}
                            >
                              {TrendIcon ? <TrendIcon className="mr-0.5 h-3 w-3" /> : null}
                              {card.trend.text}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">{card.detail}</p>
                      </div>
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg border ${card.iconClassName}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Main Triage & Verification Split Pane */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <IncidentQueue
                  incidents={visible}
                  selectedId={selected.id}
                  filter={filter}
                  query={query}
                  dismissed={dismissed}
                  onSelect={handleSelect}
                  onDismiss={handleDismiss}
                  onFilterChange={setFilter}
                  onQueryChange={setQuery}
                />

                <IncidentDetail
                  incident={selected}
                  logs={selectedLogs}
                  onAction={handleAction}
                  onAddNote={handleAddNote}
                  onDispatchConfirmed={handleDispatchConfirmed}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
