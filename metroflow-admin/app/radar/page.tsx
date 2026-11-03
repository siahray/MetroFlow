"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckSquare } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DispatchRadar } from "@/components/dispatch-radar";
import { useToast } from "@/components/toast-provider";
import { type Incident } from "@/lib/incidents";
import { listSOS } from "@/lib/sos-live";
import { sosToIncident, reportToIncident } from "@/lib/sos-to-incidents";
import { listReports, type FieldReport } from "@/lib/reports";
import { listVehicles, type Vehicle, type SOSRequest } from "@/lib/dispatch";
import { subscribeToSOS, sosFromEvent } from "@/lib/sos-stream";
import { subscribeToVehicles, vehiclesFromEvent } from "@/lib/vehicle-stream";

function RadarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("id");
  const { show } = useToast();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reports, setReports] = useState<FieldReport[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const sosListRef = useRef<SOSRequest[]>([]);
  const selectedIdRef = useRef<string>("");

  // Keep selectedId ref in sync
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Recalculate incidents when any dependency changes
  useEffect(() => {
    const recalculate = () => {
      const sosIncidents = sosListRef.current.map((s) => sosToIncident(s, { reports, vehicles }));
      const reportIncidents = reports.map((r) => reportToIncident(r, { vehicles }));
      const mapped = [...sosIncidents, ...reportIncidents].sort((a, b) => b.urgency - a.urgency);
      setIncidents(mapped);
    };
    recalculate();
  }, [reports, vehicles]);

  useEffect(() => {
    // Initial load to get snapshot data
    const load = async () => {
      try {
        const [sosList, reportList, vehicleList] = await Promise.all([
          listSOS().catch(() => []),
          listReports().catch(() => []),
          listVehicles().catch(() => []),
        ]);
        sosListRef.current = sosList;
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
      } catch {
        // keep fallback
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
    subscribeToSOS((event) => {
      const sosList = sosFromEvent(event);
      if (sosList) {
        sosListRef.current = sosList;
      }
    }, signal);

    // Subscribe to vehicle stream
    subscribeToVehicles((event) => {
      const vehicleList = vehiclesFromEvent(event);
      if (vehicleList) {
        setVehicles(vehicleList);
      }
    }, signal);

    return () => {
      abortController.abort();
      clearInterval(reportInterval);
    };
  }, [requestedId]);

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
      {selected ? (
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
