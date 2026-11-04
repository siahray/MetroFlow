"use client";

import { CircleCheck, Shield, Siren, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { IncidentDetail } from "@/components/incident-detail";
import { IncidentQueue } from "@/components/incident-queue";
import { useToast } from "@/components/toast-provider";
import {
  compareIncidents,
  matchesQueueFilter,
  type QueueFilter,
  type Incident,
} from "@/lib/incidents";
import { listSOS } from "@/lib/sos-live";
import { sosToIncident, reportToIncident } from "@/lib/sos-to-incidents";
import { listVehicles, type Vehicle, type SOSRequest } from "@/lib/dispatch";
import { listHazards, type HazardZone } from "@/lib/hazards";
import { listReports, type FieldReport } from "@/lib/reports";
import { subscribeToHazards, subscribeToSOS, subscribeToVehicles } from "@/lib/live-stream";

export default function TriagePage() {
  const router = useRouter();
  const { show } = useToast();
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [query, setQuery] = useState("");
  const [sosList, setSosList] = useState<SOSRequest[]>([]);
  const [liveIncidents, setLiveIncidents] = useState<Incident[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hazards, setHazards] = useState<HazardZone[]>([]);
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const selectedIdRef = useRef<string>("");

  // Keep selectedId ref in sync
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Recalculate incidents when any dependency changes
  useEffect(() => {
    const recalculate = () => {
      const sosIncidents = sosList.map((s) => sosToIncident(s, { reports, vehicles, hazards }));
      const reportIncidents = reports.map((r) => reportToIncident(r, { vehicles, hazards }));
      const incidents = [...sosIncidents, ...reportIncidents].sort(compareIncidents);
      setLiveIncidents(incidents);
    };
    recalculate();
  }, [sosList, reports, vehicles, hazards]);

  useEffect(() => {
    // Initial load to get snapshot data
    const load = async () => {
      try {
        const [sosList, reportList, vehicleList, hazardList] = await Promise.all([
          listSOS(),
          listReports().catch(() => []),
          listVehicles().catch(() => []),
          listHazards().catch(() => []),
        ]);
        setError(null);
        setSosList(sosList);
        setVehicles(vehicleList);
        setHazards(hazardList);
        setReports(reportList);
        // Auto-select first incident on initial load
        const currentSelectedId = selectedIdRef.current;
        if (sosList.length > 0 && !sosList.some((s) => `SOS-${s.sos_id}` === currentSelectedId)) {
          setSelectedId(`SOS-${sosList[0].sos_id}`);
        } else if (
          reportList.length > 0 &&
          !reportList.some((r) => r.report_id === currentSelectedId)
        ) {
          setSelectedId(reportList[0].report_id);
        } else if (sosList.length === 0 && reportList.length === 0) {
          setSelectedId("");
        }
      } catch {
        setError(
          navigator.onLine
            ? "Could not load incidents. The server may be unavailable."
            : "You are offline. Check your connection and retry.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();

    // Poll reports periodically (no SSE endpoint for reports yet)
    const loadReports = async () => {
      try {
        const reportList = await listReports();
        setReports(reportList);
      } catch {
        // Silent fail for reports
      }
    };
    const reportInterval = setInterval(loadReports, 10000);

    // Set up SSE streams for real-time updates
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;

    // Subscribe to SOS stream
    subscribeToSOS(setSosList, signal);

    // Subscribe to vehicle stream
    subscribeToVehicles(setVehicles, signal);

    // Subscribe to hazard stream
    subscribeToHazards(setHazards, signal);

    return () => {
      abortController.abort();
      clearInterval(reportInterval);
    };
  }, [reloadKey]);

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
      const matchesFilter = matchesQueueFilter(incident, filter);
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
  const pendingCount = allIncidents.length - dismissed.size;

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

  // FSD-FR-043: the log is persisted per incident and read back by the detail
  // panel, so this screen only reports the outcome.
  const handleAction = useCallback(
    (label: string) => {
      show(activeId ? `${label} for #${activeId}` : label);
    },
    [activeId, show],
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
          loading={loading}
          error={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            setReloadKey((k) => k + 1);
          }}
          onSelect={handleSelect}
          onDismiss={handleDismiss}
          onFilterChange={setFilter}
          onQueryChange={setQuery}
        />

        {selected ? (
          <IncidentDetail
            incident={selected}
            onAction={handleAction}
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
