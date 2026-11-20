"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PhoneCall, Radar } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { IncidentDetail } from "@/components/incident-detail";
import { IncidentQueue } from "@/components/incident-queue";
import { LogSOSModal } from "@/components/log-sos-modal";
import { ResponderTracking } from "@/components/responder-tracking";
import { ErrorNotice } from "@/components/error-notice";
import { Skeleton } from "@/components/skeleton";
import { useToast } from "@/components/toast-provider";
import {
  EMPTY_ADVANCED_FILTERS,
  matchesAdvancedFilters,
  type AdvancedFilters,
} from "@/lib/advanced-filters";
import { dismissIncident, restoreIncident } from "@/lib/dismissed";
import { compareIncidents, matchesQueueFilter, type QueueFilter } from "@/lib/incidents";
import { listReports, type FieldReport } from "@/lib/reports";
import { listSOS } from "@/lib/sos-live";
import { sosToIncident } from "@/lib/sos-to-incidents";
import { responderTrack } from "@/lib/tracking";
import { listVehicles, type SOSRequest, type Vehicle } from "@/lib/dispatch";
import { subscribeToSOS, subscribeToVehicles } from "@/lib/live-stream";

/**
 * CR-002 §2.2 / §2.3: the Dispatch Radar handles user SOS requests only.
 *
 * Assignment and the dispatch/confirmation flow are the incident docket's own
 * workflow; responder tracking is the panel above it, fed by the vehicles
 * stream (live GPS) and the mission timeline (periodic status/ETA updates).
 * User-generated report verification lives in Moderation and Evidence instead.
 */

function RadarContent() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("id");
  const { show } = useToast();

  const [filter, setFilter] = useState<QueueFilter>("all");
  const [query, setQuery] = useState("");
  const [advanced, setAdvanced] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);
  const [view, setView] = useState<"active" | "dismissed">("active");
  const [selectedId, setSelectedId] = useState<string>("");
  const [sosList, setSosList] = useState<SOSRequest[]>([]);
  const [dismissedSos, setDismissedSos] = useState<SOSRequest[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  // Read-only: a nearby report is shown as corroborating evidence, never moderated here.
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [logOpen, setLogOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const selectedIdRef = useRef<string>("");

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadDismissed = useCallback(async () => {
    setDismissedSos(await listSOS(undefined, true).catch(() => []));
  }, []);

  useEffect(() => {
    const load = async () => {
      const results = await Promise.allSettled([listSOS(), listVehicles(), listReports()]);
      const [sosResult, vehicleResult, reportResult] = results;
      // One dead feed should not blank the radar; only say so when nothing loaded.
      if (results.every((result) => result.status === "rejected")) {
        setError(
          navigator.onLine
            ? "Could not load the dispatch queue. Check your connection and retry."
            : "You are offline. Check your connection and retry.",
        );
        setLoading(false);
        return;
      }
      setError(null);
      const sos = sosResult.status === "fulfilled" ? sosResult.value : [];
      if (sosResult.status === "fulfilled") setSosList(sos);
      if (vehicleResult.status === "fulfilled") setVehicles(vehicleResult.value);
      if (reportResult.status === "fulfilled") setReports(reportResult.value);
      void loadDismissed();

      const current = selectedIdRef.current;
      const known = (id: string) =>
        sos.some((row) => `FR-${row.sos_id.toString().padStart(4, "0")}` === id);
      if (requestedId && known(requestedId)) {
        setSelectedId(requestedId);
      } else if (sos.length > 0 && !known(current)) {
        setSelectedId(`FR-${sos[0].sos_id.toString().padStart(4, "0")}`);
      } else if (sos.length === 0) {
        setSelectedId("");
      }
      setLoading(false);
    };

    void load();

    // Reports have no stream endpoint; poll them for the corroboration context.
    const poll = setInterval(() => {
      listReports()
        .then(setReports)
        .catch(() => {});
    }, 10000);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;
    subscribeToSOS(setSosList, signal);
    subscribeToVehicles(setVehicles, signal);

    return () => {
      abortController.abort();
      clearInterval(poll);
    };
  }, [requestedId, reloadKey, loadDismissed]);

  const activeIncidents = useMemo(
    () => sosList.map((row) => sosToIncident(row, { reports, vehicles })).sort(compareIncidents),
    [sosList, reports, vehicles],
  );

  const dismissedIncidents = useMemo(
    () =>
      dismissedSos
        .map((row) => ({
          ...sosToIncident(row, { reports, vehicles }),
          dismissedAt: row.dismissed_at,
        }))
        .sort(compareIncidents),
    [dismissedSos, reports, vehicles],
  );

  const allIncidents = view === "dismissed" ? dismissedIncidents : activeIncidents;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allIncidents.filter((incident) => {
      const matchesQuery =
        needle === "" ||
        [incident.id, incident.reporter, incident.location, incident.barangay].some((value) =>
          value.toLowerCase().includes(needle),
        );
      return (
        matchesQueueFilter(incident, filter) &&
        matchesQuery &&
        matchesAdvancedFilters(incident, advanced)
      );
    });
  }, [allIncidents, filter, query, advanced]);

  const selected = visible.find((incident) => incident.id === selectedId) ?? visible[0] ?? null;
  const selectedSos = selected
    ? sosList.find((row) => `FR-${row.sos_id.toString().padStart(4, "0")}` === selected.id)
    : undefined;
  // CR-002 §2.3: the docket's own view of the unit, fed by the same vehicles stream.
  const responder = selectedSos ? responderTrack(selectedSos, vehicles) : null;

  const handleDismiss = useCallback(
    async (id: string) => {
      const incident = allIncidents.find((row) => row.id === id);
      if (!incident) return;
      try {
        await dismissIncident(incident);
      } catch (err) {
        show(err instanceof Error ? err.message : "Could not dismiss the incident");
        return;
      }
      // The SOS stream drops the row; keep the list honest until it does.
      setSosList((rows) =>
        rows.filter((row) => `FR-${row.sos_id.toString().padStart(4, "0")}` !== id),
      );
      await loadDismissed();
      show(`Incident #${id} moved to Dismissed; it is deleted after 72 hours`);
    },
    [allIncidents, loadDismissed, show],
  );

  const handleRestore = useCallback(
    async (id: string) => {
      const incident = allIncidents.find((row) => row.id === id);
      if (!incident) return;
      try {
        await restoreIncident(incident);
      } catch (err) {
        show(err instanceof Error ? err.message : "Could not restore the incident");
        return;
      }
      await loadDismissed();
      show(`Incident #${id} restored to the queue`);
    },
    [allIncidents, loadDismissed, show],
  );

  const handleCallLogged = useCallback(
    (sos: SOSRequest) => {
      setLogOpen(false);
      setView("active");
      setSelectedId(`FR-${sos.sos_id.toString().padStart(4, "0")}`);
      setReloadKey((key) => key + 1);
      show(`Call-in incident #FR-${sos.sos_id.toString().padStart(4, "0")} added to the queue`);
    },
    [show],
  );

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  return (
    <AppShell activeItem="radar" title="Emergency Dispatch Radar">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-600">
            <Radar className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-sm font-bold text-slate-900">
              SOS dispatch and responder tracking
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Citizen distress signals only. Assign a specific rescue unit, confirm the dispatch and
              follow its live position and mission milestones.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <PhoneCall className="h-4 w-4" />
          Log a call-in distress signal
        </button>
      </div>

      {error ? <ErrorNotice message={error} onRetry={retry} /> : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : allIncidents.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No active distress signals in queue
          </p>
          <p className="mt-1 text-xs text-slate-400">
            The radar lists citizen SOS requests. Field reports are handled in Moderation and
            Evidence.
          </p>
        </div>
      ) : (
        <>
          {selected && selectedSos ? (
            <ResponderTracking sos={selectedSos} vehicles={vehicles} />
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <IncidentQueue
              incidents={visible}
              selectedId={selected?.id ?? ""}
              filter={filter}
              query={query}
              advanced={advanced}
              view={view}
              dismissedCount={dismissedIncidents.length}
              onViewChange={setView}
              onSelect={setSelectedId}
              onDismiss={handleDismiss}
              onRestore={handleRestore}
              onFilterChange={setFilter}
              onQueryChange={setQuery}
              onAdvancedChange={setAdvanced}
            />

            {selected ? (
              <IncidentDetail incident={selected} onAction={show} responder={responder} />
            ) : (
              <div className="col-span-1 flex items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 lg:col-span-7">
                No incident selected
              </div>
            )}
          </div>
        </>
      )}

      {logOpen ? (
        <LogSOSModal onLogged={handleCallLogged} onClose={() => setLogOpen(false)} />
      ) : null}
    </AppShell>
  );
}

export default function RadarPage() {
  return (
    <Suspense fallback={null}>
      <RadarContent />
    </Suspense>
  );
}
