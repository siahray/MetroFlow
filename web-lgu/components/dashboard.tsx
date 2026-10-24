"use client";

import {
  Bot,
  ChevronRight,
  CircleCheck,
  CloudRain,
  Shield,
  Siren,
  Timer,
  TrendingUp,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DispatchRadar } from "./dispatch-radar";
import { FloodClosureEditor } from "./flood-closure-editor";
import { IncidentDetail } from "./incident-detail";
import { IncidentQueue } from "./incident-queue";
import { RescueTracking } from "./rescue-tracking";
import { Sidebar } from "./sidebar";
import { useToast } from "./toast-provider";
import {
  type LogEntry,
  type QueueFilter,
  type Incident,
} from "@/lib/incidents";
import { listSOS } from "@/lib/sos-live";
import { sosToIncident } from "@/lib/sos-to-incidents";
import { listVehicles, type Vehicle } from "@/lib/dispatch";
import { listHazards, type HazardZone } from "@/lib/hazards";

type View = "triage" | "radar" | "sensors" | "fleet";

const VIEW_TITLES: Record<View, string> = {
  triage: "Incident Triage & Verification",
  radar: "Emergency Dispatch Radar",
  sensors: "Live Map & Hazard Authoring",
  fleet: "Rescue Fleet & Mission Operations",
};

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Dashboard({ user, onSignOut }: { user?: any; onSignOut: () => void }) {
  const { show } = useToast();
  const [view, setView] = useState<View>("triage");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [query, setQuery] = useState("");
  const [liveIncidents, setLiveIncidents] = useState<Incident[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hazards, setHazards] = useState<HazardZone[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const [sosList, vehicleList, hazardList] = await Promise.all([
          listSOS().catch(() => []),
          listVehicles().catch(() => []),
          listHazards().catch(() => []),
        ]);
        const incidents = sosList.map((s) => sosToIncident(s));
        setLiveIncidents(incidents);
        setVehicles(vehicleList);
        setHazards(hazardList);
        if (incidents.length > 0 && !incidents.some((i) => i.id === selectedId)) {
          setSelectedId(incidents[0].id);
        } else if (incidents.length === 0) {
          setSelectedId("");
        }
      } catch (e) {
        // ignore
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [selectedId]);

  const allIncidents = useMemo(() => {
    return liveIncidents;
  }, [liveIncidents]);

  const incidentById = useMemo(() => {
    const map = new Map<string, Incident>();
    for (const inc of allIncidents) {
      map.set(inc.id, inc);
    }
    return map;
  }, [allIncidents]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return allIncidents.filter((incident) => {
      const matchesFilter = filter === "all" || incident.source === filter;
      const matchesQuery =
        needle === "" ||
        [incident.id, incident.reporter, incident.location, incident.barangay].some((value) =>
          value.toLowerCase().includes(needle),
        );

      return matchesFilter && matchesQuery;
    });
  }, [allIncidents, filter, query]);

  const selected = selectedId ? (incidentById.get(selectedId) ?? allIncidents[0] ?? null) : allIncidents[0] ?? null;
  const selectedLogs = selected ? (logs[selected.id] ?? []) : [];
  const pendingCount = allIncidents.length - dismissed.size;

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
      if (selected?.id) {
        show(`${label} executed for #${selected.id}`);
        appendLog(selected.id, `Action: ${label} by Operator M. Santos.`, "action");
      } else {
        show(label);
      }
    },
    [appendLog, selected?.id, show],
  );

  const handleAddNote = useCallback(
    (text: string) => {
      if (selected?.id) {
        appendLog(selected.id, `Note: ${text}`, "note");
      }
      show("Internal note saved to incident log");
    },
    [appendLog, selected?.id, show],
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

  const assignedCount = liveIncidents.filter((i) => i.tags.includes("Vehicle Assigned")).length;
  const availableVehiclesCount = vehicles.filter(
    (v) => (v.status || "AVAILABLE").toUpperCase() === "AVAILABLE",
  ).length;
  const totalVehiclesCount = vehicles.length;
  const activeHazardsCount = hazards.filter((h) => h.active !== false).length;

  const kpiCards = [
    {
      label: "Dispatched SOS",
      value: String(assignedCount),
      detail: assignedCount === 1 ? "1 unit responding" : `${assignedCount} units responding`,
      trend: { text: "Active", className: "text-emerald-600" },
      icon: CircleCheck,
      iconClassName: "border-emerald-100 bg-emerald-50 text-emerald-600",
    },
    {
      label: "Fleet Readiness",
      value: `${availableVehiclesCount}/${totalVehiclesCount}`,
      detail: `${availableVehiclesCount} units ready for callout`,
      trend: { text: "Standby", className: "text-sky-600" },
      icon: Truck,
      iconClassName: "border-sky-100 bg-sky-50 text-sky-600",
    },
    {
      label: "Active Hazards",
      value: String(activeHazardsCount),
      detail: "Monitored flood closures",
      trend: { text: "Live", className: "text-indigo-600" },
      icon: Shield,
      iconClassName: "border-indigo-100 bg-indigo-50 text-indigo-600",
    },
  ];

  const officerName = user?.name || "MDRRMC Dispatcher";
  const officerRole = user?.role === "SUPER_ADMIN" ? "Super Admin" : "Lead Dispatch Officer";
  const officerInitials =
    officerName
      .split(" ")
      .filter(Boolean)
      .map((w: string) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "DO";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 text-slate-800 select-none">
      <Sidebar
        activeItem={view}
        queueCount={pendingCount}
        user={user}
        fleetCount={totalVehiclesCount}
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
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Monitoring Grid Active</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" />
              <span>Active SOS: {liveIncidents.length}</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {officerInitials}
              </div>
              <div>
                <div className="leading-tight font-semibold text-slate-800">{officerName}</div>
                <div className="text-[10px] text-slate-400">{officerRole}</div>
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
            selected ? (
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
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                No incidents available
              </div>
            )
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
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">Awaiting dispatch review</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-600">
                    <Siren className="h-5 w-5" />
                  </div>
                </div>

                {kpiCards.map((card) => {
                  const Icon = card.icon;

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
                  selectedId={selected?.id || ""}
                  filter={filter}
                  query={query}
                  dismissed={dismissed}
                  onSelect={handleSelect}
                  onDismiss={handleDismiss}
                  onFilterChange={setFilter}
                  onQueryChange={setQuery}
                />

                {selected ? (
                  <IncidentDetail
                    incident={selected}
                    logs={selectedLogs}
                    onAction={handleAction}
                    onAddNote={handleAddNote}
                    onDispatchConfirmed={handleDispatchConfirmed}
                  />
                ) : (
                  <div className="col-span-1 flex items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 lg:col-span-7">
                    No incidents in queue
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
