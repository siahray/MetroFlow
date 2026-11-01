"use client";

import { CircleCheck, Shield, Siren, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { IncidentDetail } from "@/components/incident-detail";
import { IncidentQueue } from "@/components/incident-queue";
import { useToast } from "@/components/toast-provider";
import { type LogEntry, type QueueFilter, type Incident } from "@/lib/incidents";
import { listSOS } from "@/lib/sos-live";
import { sosToIncident, reportToIncident } from "@/lib/sos-to-incidents";
import { fetchIncidentLog, listVehicles, type Vehicle } from "@/lib/dispatch";
import { listHazards, type HazardZone } from "@/lib/hazards";
import { listReports } from "@/lib/reports";

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TriagePage() {
  const router = useRouter();
  const { show } = useToast();
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
        const [sosList, reportList, vehicleList, hazardList] = await Promise.all([
          listSOS().catch(() => []),
          listReports().catch(() => []),
          listVehicles().catch(() => []),
          listHazards().catch(() => []),
        ]);
        const sosIncidents = sosList.map((s) =>
          sosToIncident(s, { reports: reportList, vehicles: vehicleList, hazards: hazardList }),
        );
        const reportIncidents = reportList.map((r) =>
          reportToIncident(r, { vehicles: vehicleList, hazards: hazardList }),
        );
        const incidents = [...sosIncidents, ...reportIncidents].sort(
          (a, b) => b.urgency - a.urgency,
        );
        setLiveIncidents(incidents);
        setVehicles(vehicleList);
        setHazards(hazardList);
        if (incidents.length > 0 && !incidents.some((i) => i.id === selectedId)) {
          setSelectedId(incidents[0].id);
        } else if (incidents.length === 0) {
          setSelectedId("");
        }
      } catch {
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

  const selected = selectedId
    ? (incidentById.get(selectedId) ?? allIncidents[0] ?? null)
    : (allIncidents[0] ?? null);
  const activeId = selected?.id ?? "";
  const selectedLogs = selected ? (logs[selected.id] ?? []) : [];
  const pendingCount = allIncidents.length - dismissed.size;

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    fetchIncidentLog(selected).then((items) => {
      if (!cancelled && items && items.length > 0) {
        setLogs((prev) => ({
          ...prev,
          [selected.id]: items.map((i) => ({ time: i.time, text: i.text, kind: i.kind })),
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

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
      if (activeId) {
        show(`${label} executed for #${activeId}`);
        appendLog(activeId, `Action: ${label} by Dispatch Officer.`, "action");
      } else {
        show(label);
      }
    },
    [appendLog, activeId, show],
  );

  const handleAddNote = useCallback(
    (text: string) => {
      if (activeId) {
        appendLog(activeId, `Note: ${text}`, "note");
      }
      show("Internal note saved to incident log");
    },
    [appendLog, activeId, show],
  );

  const handleDispatchConfirmed = useCallback(
    (unitCallSign: string, incidentId: string) => {
      show(`Rescue Unit ${unitCallSign} successfully dispatched to #${incidentId}!`);
      router.push("/fleet");
    },
    [show, router],
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

  return (
    <AppShell activeItem="triage" title="Incident Triage & Verification">
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
    </AppShell>
  );
}
