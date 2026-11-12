"use client";

import { CircleCheck, PhoneCall, Shield, Siren, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { IncidentDetail } from "@/components/incident-detail";
import { IncidentQueue } from "@/components/incident-queue";
import { LogSOSModal } from "@/components/log-sos-modal";
import { TrendsCharts } from "@/components/trends-charts";
import { useToast } from "@/components/toast-provider";
import {
  EMPTY_ADVANCED_FILTERS,
  matchesAdvancedFilters,
  type AdvancedFilters,
} from "@/lib/advanced-filters";
import {
  compareIncidents,
  matchesQueueFilter,
  type QueueFilter,
  type Incident,
} from "@/lib/incidents";
import { listSOS } from "@/lib/sos-live";
import { dismissIncident, restoreIncident } from "@/lib/dismissed";
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
  const [advanced, setAdvanced] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);
  const [sosList, setSosList] = useState<SOSRequest[]>([]);
  const [liveIncidents, setLiveIncidents] = useState<Incident[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hazards, setHazards] = useState<HazardZone[]>([]);
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [view, setView] = useState<"active" | "dismissed">("active");
  const [logOpen, setLogOpen] = useState(false);
  const [dismissedSos, setDismissedSos] = useState<SOSRequest[]>([]);
  const [dismissedReports, setDismissedReports] = useState<FieldReport[]>([]);
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

  const loadDismissed = useCallback(async () => {
    const [sosRows, reportRows] = await Promise.all([
      listSOS(undefined, true).catch(() => []),
      listReports("PENDING", true).catch(() => []),
    ]);
    setDismissedSos(sosRows);
    setDismissedReports(reportRows);
  }, []);

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
        void loadDismissed();
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
  }, [reloadKey, loadDismissed]);

  const dismissedIncidents = useMemo(
    () =>
      [
        ...dismissedSos.map((s) => ({
          ...sosToIncident(s, { reports: dismissedReports, vehicles, hazards }),
          dismissedAt: s.dismissed_at,
        })),
        ...dismissedReports.map((r) => ({
          ...reportToIncident(r, { vehicles, hazards }),
          dismissedAt: r.dismissed_at,
        })),
      ].sort(compareIncidents),
    [dismissedSos, dismissedReports, vehicles, hazards],
  );

  const allIncidents = view === "dismissed" ? dismissedIncidents : liveIncidents;

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

      return matchesFilter && matchesQuery && matchesAdvancedFilters(incident, advanced);
    });
  }, [allIncidents, filter, query, advanced]);

  const selected = selectedId
    ? (incidentById.get(selectedId) ?? allIncidents[0] ?? null)
    : (allIncidents[0] ?? null);
  const activeId = selected?.id ?? "";
  const pendingCount = liveIncidents.length;

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleDismiss = useCallback(
    async (id: string) => {
      const incident = incidentById.get(id);
      if (!incident) return;
      try {
        await dismissIncident(incident);
      } catch (err) {
        show(err instanceof Error ? err.message : "Could not dismiss the incident");
        return;
      }
      // The SOS stream drops the row itself; field reports are polled, so drop it here.
      setSosList((rows) =>
        incident.incidentType === "report"
          ? rows
          : rows.filter((row) => sosToIncident(row).id !== id),
      );
      setReports((rows) =>
        rows.filter(
          (row) => row.report_id !== incident.reportId || incident.incidentType !== "report",
        ),
      );
      await loadDismissed();
      show(`Incident #${id} moved to Dismissed; it is deleted after 72 hours`);
    },
    [show, loadDismissed, incidentById],
  );

  const handleRestore = useCallback(
    async (id: string) => {
      const incident = incidentById.get(id);
      if (!incident) return;
      try {
        await restoreIncident(incident);
      } catch (err) {
        show(err instanceof Error ? err.message : "Could not restore the incident");
        return;
      }
      // The restored SOS reaches the queue through the stream; reports are re-read.
      setReports(await listReports().catch(() => []));
      await loadDismissed();
      show(`Incident #${id} restored to the queue`);
    },
    [show, loadDismissed, incidentById],
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

  // FSD-FR-087: a distress call taken by telephone enters the same queue and map.
  const handleCallLogged = useCallback(
    (sos: SOSRequest) => {
      setLogOpen(false);
      setView("active");
      setSelectedId(`SOS-${sos.sos_id}`);
      // The SOS stream usually delivers it; reload as well so a dropped stream
      // cannot hide an incident the dispatcher just created.
      setReloadKey((key) => key + 1);
      show(`Call-in incident #SOS-${sos.sos_id} added to the queue`);
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
      trend: { text: "Active", className: "text-emerald-700" },
      icon: CircleCheck,
      iconClassName: "border-emerald-100 bg-emerald-50 text-emerald-600",
    },
    {
      label: "Fleet Readiness",
      value: `${availableVehiclesCount}/${totalVehiclesCount}`,
      trend: { text: "Standby", className: "text-sky-700" },
      icon: Truck,
      iconClassName: "border-sky-100 bg-sky-50 text-sky-600",
    },
    {
      label: "Active Hazards",
      value: String(activeHazardsCount),
      trend: { text: "Live", className: "text-indigo-600" },
      icon: Shield,
      iconClassName: "border-indigo-100 bg-indigo-50 text-indigo-600",
    },
  ];

  return (
    <AppShell activeItem="triage" title="Incident Triage & Verification">
      {/* One compact strip: the numbers a dispatcher scans, plus the call-in
          action in the same band instead of a separate row. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-600">
            <Siren className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              Pending Triage
            </p>
            <p className="flex items-baseline gap-1.5">
              <span className="text-kpi text-slate-900">{pendingCount}</span>
              <span className="text-[11px] text-slate-500">awaiting review</span>
            </p>
          </div>
        </div>

        <span className="hidden h-9 w-px bg-slate-200 sm:block" aria-hidden="true" />

        {kpiCards.map((card) => {
          const Icon = card.icon;

          return (
            <div key={card.label} className="flex items-center gap-2.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg border ${card.iconClassName}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  {card.label}
                </p>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-kpi text-slate-900">{card.value}</span>
                  {card.trend ? (
                    <span className={`text-[11px] font-medium ${card.trend.className}`}>
                      {card.trend.text}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          );
        })}

        <span className="flex-1" />

        {/* FSD-FR-087: a distress call that arrives by telephone is logged here. */}
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <PhoneCall className="h-4 w-4" />
          Log a call-in distress signal
        </button>
      </div>

      {/* Main Triage & Verification Split Pane */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <IncidentQueue
          incidents={visible}
          allIncidents={allIncidents}
          selectedId={selected?.id || ""}
          filter={filter}
          query={query}
          advanced={advanced}
          view={view}
          dismissedCount={dismissedIncidents.length}
          onViewChange={setView}
          loading={loading}
          error={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            setReloadKey((k) => k + 1);
          }}
          onSelect={handleSelect}
          onDismiss={handleDismiss}
          onRestore={handleRestore}
          onFilterChange={setFilter}
          onQueryChange={setQuery}
          onAdvancedChange={setAdvanced}
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

      <TrendsCharts sos={sosList} reports={reports} vehicles={vehicles} hazards={hazards} />

      {logOpen ? (
        <LogSOSModal onLogged={handleCallLogged} onClose={() => setLogOpen(false)} />
      ) : null}
    </AppShell>
  );
}
