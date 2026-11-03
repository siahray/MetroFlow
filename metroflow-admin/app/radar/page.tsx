"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckSquare } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DispatchRadar } from "@/components/dispatch-radar";
import { useToast } from "@/components/toast-provider";
import { compareIncidents, type Incident } from "@/lib/incidents";
import { listSOS } from "@/lib/sos-live";
import { sosToIncident, reportToIncident } from "@/lib/sos-to-incidents";
import { listReports } from "@/lib/reports";
import { listVehicles } from "@/lib/dispatch";

function RadarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("id");
  const { show } = useToast();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        const [sosList, reportList, vehicleList] = await Promise.all([
          listSOS().catch(() => []),
          listReports().catch(() => []),
          listVehicles().catch(() => []),
        ]);
        const sosIncidents = sosList.map((s) =>
          sosToIncident(s, { reports: reportList, vehicles: vehicleList }),
        );
        const reportIncidents = reportList.map((r) =>
          reportToIncident(r, { vehicles: vehicleList }),
        );
        const mapped = [...sosIncidents, ...reportIncidents].sort(compareIncidents);
        setIncidents(mapped);
        if (requestedId && mapped.some((i) => i.id === requestedId)) {
          setSelectedId(requestedId);
        } else if (mapped.length > 0 && !selectedId) {
          setSelectedId(mapped[0].id);
        }
      } catch {
        // keep fallback
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [requestedId, selectedId]);

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
