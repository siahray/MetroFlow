"use client";

import { Download, FileText, Search, Siren } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, fetchJSON } from "@/lib/api";
import type { SOSRequest } from "@/lib/dispatch";
import { downloadBlob, exportAuditCSV, exportIncidentsCSV } from "@/lib/export";
import { listReports, type FieldReport, type ReportStatus } from "@/lib/reports";
import { ErrorNotice } from "./error-notice";
import { Skeleton } from "./skeleton";
import { useToast } from "./toast-provider";

type ViewFilter = "SOS" | "REPORTS";
type SosStatusFilter = "ALL" | "WAITING" | "ASSIGNED" | "EN_ROUTE" | "RESOLVED";
type ReportStatusFilter = "ALL" | ReportStatus;

const REPORT_STATUSES: ReportStatus[] = ["PENDING", "VERIFIED", "REJECTED", "DUPLICATE"];

function sosStatusClass(status: string) {
  switch (status.toUpperCase()) {
    case "WAITING":
      return "bg-rose-100 text-rose-800";
    case "ASSIGNED":
    case "EN_ROUTE":
      return "bg-amber-100 text-amber-800";
    case "RESOLVED":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function reportStatusClass(status: string) {
  switch (status.toUpperCase()) {
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    case "VERIFIED":
      return "bg-emerald-100 text-emerald-800";
    case "REJECTED":
    case "DUPLICATE":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

async function listAllIncidents(): Promise<SOSRequest[]> {
  const [active, dismissed] = await Promise.all([
    fetchJSON<SOSRequest[]>("/api/v1/sos?dismissed=false"),
    fetchJSON<SOSRequest[]>("/api/v1/sos?dismissed=true"),
  ]);
  return [...active, ...dismissed].sort((a, b) => {
    const at = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bt - at;
  });
}

async function listAllFieldReports(): Promise<FieldReport[]> {
  const results = await Promise.allSettled(
    REPORT_STATUSES.map((status) => listReports(status, false)),
  );
  return results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((a, b) => {
      const at = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bt = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return bt - at;
    });
}

export function ExportPanel() {
  const { show } = useToast();
  const [view, setView] = useState<ViewFilter>("SOS");
  const [incidents, setIncidents] = useState<SOSRequest[]>([]);
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<"audit" | "incidents" | null>(null);
  const [query, setQuery] = useState("");
  const [sosStatusFilter, setSosStatusFilter] = useState<SosStatusFilter>("ALL");
  const [reportStatusFilter, setReportStatusFilter] = useState<ReportStatusFilter>("ALL");

  const loadData = useCallback(async () => {
    try {
      const [incidentRows, reportRows] = await Promise.all([
        listAllIncidents(),
        listAllFieldReports(),
      ]);
      setIncidents(incidentRows);
      setReports(reportRows);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; setState runs after await
    void loadData();
  }, [loadData]);

  const sosCounts = useMemo(() => {
    const total = incidents.length;
    const waiting = incidents.filter((i) => i.status.toUpperCase() === "WAITING").length;
    const active = incidents.filter((i) =>
      ["ASSIGNED", "EN_ROUTE"].includes(i.status.toUpperCase()),
    ).length;
    const resolved = incidents.filter((i) => i.status.toUpperCase() === "RESOLVED").length;
    return { total, waiting, active, resolved };
  }, [incidents]);

  const reportCounts = useMemo(() => {
    const total = reports.length;
    const pending = reports.filter((r) => r.status.toUpperCase() === "PENDING").length;
    const verified = reports.filter((r) => r.status.toUpperCase() === "VERIFIED").length;
    const rejected = reports.filter((r) =>
      ["REJECTED", "DUPLICATE"].includes(r.status.toUpperCase()),
    ).length;
    return { total, pending, verified, rejected };
  }, [reports]);

  const filteredIncidents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return incidents.filter((incident) => {
      const status = incident.status.toUpperCase();
      if (sosStatusFilter !== "ALL" && status !== sosStatusFilter) return false;
      if (!q) return true;
      const id = `fr-${incident.sos_id.toString().padStart(4, "0")}`;
      return (
        id.includes(q) ||
        String(incident.sos_id).includes(q) ||
        (incident.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [incidents, query, sosStatusFilter]);

  const filteredReports = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((report) => {
      const status = report.status.toUpperCase();
      if (reportStatusFilter !== "ALL" && status !== reportStatusFilter) return false;
      if (!q) return true;
      return (
        report.report_id.toLowerCase().includes(q) ||
        (report.barangay ?? "").toLowerCase().includes(q) ||
        (report.narrative ?? "").toLowerCase().includes(q) ||
        (report.depth_label ?? "").toLowerCase().includes(q)
      );
    });
  }, [query, reportStatusFilter, reports]);

  const handleExportAudit = async () => {
    setIsExporting("audit");
    try {
      const blob = await exportAuditCSV();
      downloadBlob(blob, "audit_log.csv");
      show("Audit log exported successfully");
    } catch (cause) {
      show(cause instanceof ApiError ? cause.message : "Failed to export audit log");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportIncidents = async () => {
    setIsExporting("incidents");
    try {
      const blob = await exportIncidentsCSV();
      downloadBlob(blob, "incidents.csv");
      show("Incidents exported successfully");
    } catch (cause) {
      show(cause instanceof ApiError ? cause.message : "Failed to export incidents");
    } finally {
      setIsExporting(null);
    }
  };

  const shownCount = view === "SOS" ? filteredIncidents.length : filteredReports.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Incident Reports</h3>
          <p className="mt-1 text-xs text-slate-500">
            Review SOS incidents and field reports, with CSV exports for audit and reporting.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportAudit}
            disabled={isExporting !== null}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileText className="h-4 w-4" />
            <span>{isExporting === "audit" ? "Exporting..." : "Export Audit Log"}</span>
          </button>
          <button
            onClick={handleExportIncidents}
            disabled={isExporting !== null}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            <span>{isExporting === "incidents" ? "Exporting..." : "Export Incidents CSV"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {view === "SOS" ? (
          <>
            <SummaryCard label="Total SOS" value={sosCounts.total} detail="All SOS records" />
            <SummaryCard
              label="Waiting"
              value={sosCounts.waiting}
              detail="Need assignment"
              tone="rose"
            />
            <SummaryCard
              label="Active"
              value={sosCounts.active}
              detail="Assigned or en route"
              tone="amber"
            />
            <SummaryCard
              label="Resolved"
              value={sosCounts.resolved}
              detail="Closed incidents"
              tone="emerald"
            />
          </>
        ) : (
          <>
            <SummaryCard
              label="Total reports"
              value={reportCounts.total}
              detail="All field reports"
            />
            <SummaryCard
              label="Pending"
              value={reportCounts.pending}
              detail="Awaiting moderation"
              tone="amber"
            />
            <SummaryCard
              label="Verified"
              value={reportCounts.verified}
              detail="Approved reports"
              tone="emerald"
            />
            <SummaryCard
              label="Rejected/Duplicate"
              value={reportCounts.rejected}
              detail="Closed without publish"
              tone="rose"
            />
          </>
        )}
      </div>

      {error ? <ErrorNotice message={error} onRetry={() => void loadData()} /> : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Siren className="h-4 w-4 text-slate-500" />
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(["SOS", "REPORTS"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    view === option
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {option === "SOS" ? "SOS" : "Reports"}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-500">{shownCount} shown</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  view === "SOS" ? "Search SOS ID or note" : "Search report ID, barangay, note"
                }
                className="w-52 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              />
            </div>
            {view === "SOS" ? (
              <select
                value={sosStatusFilter}
                onChange={(e) => setSosStatusFilter(e.target.value as SosStatusFilter)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              >
                <option value="ALL">All statuses</option>
                <option value="WAITING">Waiting</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="EN_ROUTE">En route</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            ) : (
              <select
                value={reportStatusFilter}
                onChange={(e) => setReportStatusFilter(e.target.value as ReportStatusFilter)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
                <option value="DUPLICATE">Duplicate</option>
              </select>
            )}
          </div>
        </header>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : view === "SOS" ? (
          filteredIncidents.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">
              {incidents.length === 0
                ? "No SOS incidents found."
                : "No SOS incidents match the current filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] tracking-wider text-slate-500 uppercase">
                    <th scope="col" className="px-4 py-2 font-semibold">
                      ID
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      Created
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      Location
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      Note
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">
                      Unit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncidents.map((incident) => (
                    <tr key={incident.sos_id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2 font-mono font-semibold whitespace-nowrap text-slate-800">
                        #FR-{incident.sos_id.toString().padStart(4, "0")}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-slate-600">
                        {formatDate(incident.created_at)}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${sosStatusClass(incident.status)}`}
                          >
                            {incident.status.toUpperCase()}
                          </span>
                          {incident.dismissed_at ? (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                              DISMISSED
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-slate-600">
                        {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
                      </td>
                      <td
                        className="max-w-[16rem] truncate px-2 py-2 text-slate-600"
                        title={incident.note ?? ""}
                      >
                        {incident.note?.trim() || "—"}
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap text-slate-600">
                        {incident.vehicle_id != null ? `#${incident.vehicle_id}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filteredReports.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-500">
            {reports.length === 0
              ? "No field reports found."
              : "No field reports match the current filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] tracking-wider text-slate-500 uppercase">
                  <th scope="col" className="px-4 py-2 font-semibold">
                    ID
                  </th>
                  <th scope="col" className="px-2 py-2 font-semibold">
                    Submitted
                  </th>
                  <th scope="col" className="px-2 py-2 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-2 py-2 font-semibold">
                    Depth
                  </th>
                  <th scope="col" className="px-2 py-2 font-semibold">
                    Barangay
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    Urgency
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.report_id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 font-mono font-semibold whitespace-nowrap text-slate-800">
                      #{report.report_id.slice(0, 8)}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-slate-600">
                      {formatDate(report.submitted_at)}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${reportStatusClass(report.status)}`}
                      >
                        {report.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-slate-600">
                      {report.depth_label || report.depth_level}
                    </td>
                    <td
                      className="max-w-[16rem] truncate px-2 py-2 text-slate-600"
                      title={report.barangay ?? ""}
                    >
                      {report.barangay || "—"}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap font-mono text-slate-600">
                      {Number.isFinite(report.urgency_score)
                        ? report.urgency_score.toFixed(2)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-[10px] text-amber-800">
          <strong>Note:</strong> Exported files contain full audit trail and incident data. Handle
          with appropriate data privacy considerations.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "slate" | "rose" | "amber" | "emerald";
}) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-900",
    rose: "border-rose-100 bg-rose-50/50 text-rose-700",
    amber: "border-amber-100 bg-amber-50/50 text-amber-700",
    emerald: "border-emerald-100 bg-emerald-50/50 text-emerald-700",
  } as const;

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-[10px] font-semibold tracking-wider uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}
