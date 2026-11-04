"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckSquare } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DispatchRadar } from "@/components/dispatch-radar";
import { ErrorNotice } from "@/components/error-notice";
import { Skeleton } from "@/components/skeleton";
import { useToast } from "@/components/toast-provider";
import { compareIncidents, type Incident } from "@/lib/incidents";
import { listSOS } from "@/lib/sos-live";
import { sosToIncident, reportToIncident } from "@/lib/sos-to-incidents";
import { listReports, type FieldReport } from "@/lib/reports";
import { listVehicles, type Vehicle, type SOSRequest } from "@/lib/dispatch";
import { subscribeToSOS, subscribeToVehicles } from "@/lib/live-stream";

function RadarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("id");
  const { show } = useToast();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [sosList, setSosList] = useState<SOSRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const selectedIdRef = useRef<string>("");

  // Keep selectedId ref in sync
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Recalculate incidents when any dependency changes
  useEffect(() => {
    const recalculate = () => {
      const sosIncidents = sosList.map((s) => sosToIncident(s, { reports, vehicles }));
      const reportIncidents = reports.map((r) => reportToIncident(r, { vehicles }));
      const mapped = [...sosIncidents, ...reportIncidents].sort(compareIncidents);
      setIncidents(mapped);
    };
    recalculate();
  }, [sosList, reports, vehicles]);

  useEffect(() => {
    // Initial load to get snapshot data
    const load = async () => {
      setLoading(true);
      const results = await Promise.allSettled([listSOS(), listReports(), listVehicles()]);
      const [sosResult, reportResult, vehicleResult] = results;
      // Degrade per field: a vehicle-list failure should not blank out a working
      // SOS queue. Only report the error banner when every source failed.
      if (results.every((r) => r.status === "rejected")) {
        setLoadError("Could not load the dispatch queue. Check your connection and retry.");
        setLoading(false);
        return;
      }
      setLoadError(null);
      const sosList = sosResult.status === "fulfilled" ? sosResult.value : [];
      const reportList = reportResult.status === "fulfilled" ? reportResult.value : [];
      const vehicleList = vehicleResult.status === "fulfilled" ? vehicleResult.value : [];
      setSosList(sosList);
      setVehicles(vehicleList);
      setReports(reportList);
      // Auto-select first incident on initial load
      const currentSelectedId = selectedIdRef.current;
      if (
        requestedId &&
        (sosList.some((s) => `SOS-${s.sos_id}` === requestedId) ||
          reportList.some((r) => r.report_id === requestedId))
      ) {
        setSelectedId(requestedId);
      } else if (
        sosList.length > 0 &&
        !sosList.some((s) => `SOS-${s.sos_id}` === currentSelectedId)
      ) {
        setSelectedId(`SOS-${sosList[0].sos_id}`);
      } else if (
        reportList.length > 0 &&
        !reportList.some((r) => r.report_id === currentSelectedId)
      ) {
        setSelectedId(reportList[0].report_id);
      } else if (sosList.length === 0 && reportList.length === 0) {
        setSelectedId("");
      }
      setLoading(false);
    };

    void load();

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

    subscribeToSOS(setSosList, signal);
    subscribeToVehicles(setVehicles, signal);

    return () => {
      abortController.abort();
      clearInterval(reportInterval);
    };
  }, [requestedId, reloadTick]);

  const selected = incidents.find((i) => i.id === selectedId) || incidents[0] || null;
  const activeId = selected?.id ?? "";

  // FSD-FR-043: actions and notes are persisted by the API and read back per
  // incident, so this screen only reports the outcome.
  const handleAction = useCallback(
    (label: string) => {
      show(activeId ? `${label} for #${activeId}` : label);
    },
    [activeId, show],
  );

  return (
    <AppShell activeItem="radar" title="Emergency Dispatch Radar">
      {loadError ? (
        <ErrorNotice message={loadError} onRetry={() => setReloadTick((t) => t + 1)} />
      ) : loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : selected ? (
        <div className="space-y-4">
          {incidents.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-slate-500 uppercase">Select Target:</span>
              {incidents.map((inc) => (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => setSelectedId(inc.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold font-mono transition-colors ${
                    inc.id === selected.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  #{inc.id}
                </button>
              ))}
            </div>
          )}

          <DispatchRadar
            incident={selected}
            queueCount={incidents.length}
            onBack={() => router.push("/triage")}
            onAction={handleAction}
            onMessage={show}
            onOpenDispatchModal={() => router.push("/triage")}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            No active distress signals in queue
          </p>
          <p className="text-xs text-slate-400">
            Emergency Dispatch Radar tracks live citizen SOS telemetry when active incidents are
            reported.
          </p>
          <Link
            href="/triage"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition-colors"
          >
            <CheckSquare className="h-3.5 w-3.5" /> Open Triage Desk
          </Link>
        </div>
      )}
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
