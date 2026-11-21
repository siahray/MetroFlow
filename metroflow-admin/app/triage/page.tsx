"use client";

import {
  AlertTriangle,
  ClipboardCheck,
  Gauge,
  Inbox,
  RefreshCw,
  Shield,
  Siren,
  Truck,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ErrorNotice } from "@/components/error-notice";
import { NetworkMap } from "@/components/network-map";
import { Skeleton } from "@/components/skeleton";
import { TrendsCharts } from "@/components/trends-charts";
import { useToast } from "@/components/toast-provider";
import { listHazards, type HazardZone } from "@/lib/hazards";
import { listSOS } from "@/lib/sos-live";
import { listReports, ageLabel, type FieldReport } from "@/lib/reports";
import { summarizeOperations } from "@/lib/operations-summary";
import { listVehicles, type SOSRequest, type Vehicle } from "@/lib/dispatch";
import { listSensors, type Sensor } from "@/lib/sensors";
import { subscribeToHazards, subscribeToSOS, subscribeToVehicles } from "@/lib/live-stream";

/**
 * CR-002 §2.1: Triage and Verification becomes the operations dashboard.
 *
 * Read-only overview of the whole operation — no field-report verification and
 * no SOS dispatch actions, which now live in Moderation and Evidence and the
 * Dispatch Radar respectively. Every figure is derived from the live feeds.
 */

const OPERATIONS_BASE = "Quezon City Hall";

export default function OperationsDashboardPage() {
  const { show } = useToast();
  const [sosList, setSosList] = useState<SOSRequest[]>([]);
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hazards, setHazards] = useState<HazardZone[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const load = async () => {
      const results = await Promise.allSettled([
        listSOS(),
        listReports(),
        listVehicles(),
        listHazards(),
        listSensors(true),
      ]);
      // Only report an error when nothing loaded: one dead feed should not blank
      // the whole board.
      if (results.every((result) => result.status === "rejected")) {
        setError(
          navigator.onLine
            ? "Could not load the operations board. The server may be unavailable."
            : "You are offline. Check your connection and retry.",
        );
        setLoading(false);
        return;
      }
      const [sos, reportRows, vehicleRows, hazardRows, sensorRows] = results;
      setError(null);
      if (sos.status === "fulfilled") setSosList(sos.value);
      if (reportRows.status === "fulfilled") setReports(reportRows.value);
      if (vehicleRows.status === "fulfilled") setVehicles(vehicleRows.value);
      if (hazardRows.status === "fulfilled") setHazards(hazardRows.value);
      if (sensorRows.status === "fulfilled") setSensors(sensorRows.value);
      setLoading(false);
    };

    void load();

    // Reports and sensors have no stream endpoint yet, so they are polled.
    const poll = setInterval(() => {
      listReports()
        .then(setReports)
        .catch(() => {});
      listSensors(true)
        .then(setSensors)
        .catch(() => {});
    }, 10000);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;
    subscribeToSOS(setSosList, signal);
    subscribeToVehicles(setVehicles, signal);
    subscribeToHazards(setHazards, signal);

    return () => {
      abortController.abort();
      clearInterval(poll);
    };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  const summary = summarizeOperations({ sos: sosList, reports, vehicles, hazards });

  const cards = [
    {
      label: "Active SOS",
      value: String(summary.activeSos),
      detail: `${summary.unassignedSos} awaiting a responder`,
      href: "/radar",
      icon: Siren,
      iconClassName: "border-rose-100 bg-rose-50 text-rose-600",
    },
    {
      label: "Pending reports",
      value: String(summary.pendingReports),
      detail: "Awaiting moderation",
      href: "/moderation",
      icon: ClipboardCheck,
      iconClassName: "border-sky-100 bg-sky-50 text-sky-600",
    },
    {
      label: "Fleet readiness",
      value: `${summary.availableUnits}/${summary.totalUnits}`,
      detail: "Units available",
      href: "/fleet",
      icon: Truck,
      iconClassName: "border-emerald-100 bg-emerald-50 text-emerald-600",
    },
    {
      label: "Active hazards",
      value: String(summary.activeHazards),
      detail: "On the live map",
      href: "/hazards",
      icon: Shield,
      iconClassName: "border-indigo-100 bg-indigo-50 text-indigo-600",
    },
  ];

  return (
    <AppShell activeItem="triage" title="Operations Dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-600">
            <Waves className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-sm font-bold text-slate-900">Operations overview</h1>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Operations base: {OPERATIONS_BASE} · live SOS, moderation and fleet status. Report
              verification is handled in Moderation and Evidence; dispatch in the Dispatch Radar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live feed
          </span>
          <button
            type="button"
            onClick={retry}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      {error ? <ErrorNotice message={error} onRetry={retry} /> : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.label}
                href={card.href}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <span
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${card.iconClassName}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                    {card.label}
                  </p>
                  <p className="text-kpi text-slate-900">{card.value}</p>
                  <p className="truncate text-[11px] text-slate-500">{card.detail}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-amber-100 bg-amber-50 text-amber-600">
                <Inbox className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Waiting for attention</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {summary.unassignedSos} SOS without a unit · {summary.pendingReports} reports
                  awaiting moderation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/radar"
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open Dispatch Radar
              </Link>
              <Link
                href="/moderation"
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open Moderation
              </Link>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <WaitingTable
              title="Reports awaiting moderation"
              caption="Five oldest unattended reports"
              href="/moderation"
              empty="The moderation queue is clear."
              rows={summary.waitingReports.map((row) => ({
                id: `#${row.report_id.slice(0, 8)}`,
                detail: `${row.barangay || "no barangay"} · ${row.depth_label}`,
                waiting: ageLabel(row.submitted_at),
              }))}
            />

            <WaitingTable
              title="SOS awaiting a unit"
              caption="Five oldest unattended distress signals"
              href="/radar"
              empty="Every active SOS has a unit assigned."
              rows={summary.waitingSos.map((row) => ({
                id: `#FR-${row.sos_id.toString().padStart(4, "0")}`,
                detail:
                  row.note?.trim() || `${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)}`,
                waiting: ageLabel(row.created_at),
              }))}
            />
          </div>

          <ActiveSensorsPanel sensors={sensors} />

          {/* Stretches to the row bottom, so the map's lower edge lines up with
              the Operational trends column on wide screens. */}
          <div
            role="region"
            aria-label="Live network overview"
            className="relative min-h-[16rem] flex-1 overflow-hidden rounded-xl border border-slate-200 shadow-sm"
          >
            <NetworkMap showGraph showModel={false} onAction={show} />
          </div>
        </div>

        <TrendsCharts sos={sosList} reports={reports} vehicles={vehicles} hazards={hazards} />
      </div>
    </AppShell>
  );
}

function WaitingTable({
  title,
  caption,
  href,
  empty,
  rows,
}: {
  title: string;
  caption: string;
  href: string;
  empty: string;
  rows: { id: string; detail: string; waiting: string }[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <p className="text-[11px] text-slate-500">{caption}</p>
        </div>
        <Link
          href={href}
          className="flex-shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          View all
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-[11px] text-slate-500">{empty}</p>
      ) : (
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] tracking-wider text-slate-500 uppercase">
              <th scope="col" className="px-4 py-2 font-semibold">
                Ref
              </th>
              <th scope="col" className="px-2 py-2 font-semibold">
                Detail
              </th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">
                Waiting
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2 font-mono font-semibold whitespace-nowrap text-slate-800">
                  {row.id}
                </td>
                <td className="max-w-[11rem] truncate px-2 py-2 text-slate-600" title={row.detail}>
                  {row.detail}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap text-slate-500">
                  {row.waiting}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ActiveSensorsPanel({ sensors }: { sensors: Sensor[] }) {
  const breaches = sensors.filter((sensor) => sensor.last_flagged).length;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-600">
            <Gauge className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Active sensors</h2>
            <p className="text-[11px] text-slate-500">
              {sensors.length} active · {breaches} in breach
            </p>
          </div>
        </div>
        {breaches > 0 ? (
          <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            <AlertTriangle className="h-3 w-3" /> Breach detected
          </span>
        ) : null}
      </header>
      {sensors.length === 0 ? (
        <p className="px-4 py-3 text-[11px] text-slate-500">No active sensors.</p>
      ) : (
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] tracking-wider text-slate-500 uppercase">
              <th scope="col" className="px-4 py-2 font-semibold">
                Sensor
              </th>
              <th scope="col" className="px-2 py-2 font-semibold">
                Threshold
              </th>
              <th scope="col" className="px-2 py-2 font-semibold">
                Last reading
              </th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sensors.map((sensor) => {
              const unit = sensor.threshold_unit === "m" ? "m" : "mm/hr";
              const reading =
                sensor.last_value == null ? "No readings" : `${sensor.last_value} ${unit}`;
              return (
                <tr key={sensor.sensor_id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2">
                    <div className="font-mono font-semibold text-slate-800">{sensor.sensor_id}</div>
                    <div className="truncate text-slate-500">{sensor.name}</div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-slate-600">
                    {sensor.threshold_value} {unit}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-slate-600">{reading}</td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={
                        sensor.last_flagged
                          ? "rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800"
                          : "rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800"
                      }
                    >
                      {sensor.last_flagged ? "BREACH" : "NORMAL"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
