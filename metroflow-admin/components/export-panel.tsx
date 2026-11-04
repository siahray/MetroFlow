"use client";

import { FileText, Users } from "lucide-react";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { downloadBlob, exportAuditCSV, exportIncidentsCSV } from "@/lib/export";
import { useToast } from "./toast-provider";

export function ExportPanel() {
  const { show } = useToast();
  const [isExporting, setIsExporting] = useState<"audit" | "incidents" | null>(null);

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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3">Data Export (FSD-FR-049)</h3>
        <p className="text-xs text-slate-500 mb-4">
          Export audit logs and incident data as CSV files for analysis and reporting.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          onClick={handleExportAudit}
          disabled={isExporting === "audit"}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          <FileText className="h-4 w-4" />
          <span>{isExporting === "audit" ? "Exporting..." : "Export Audit Log"}</span>
        </button>

        <button
          onClick={handleExportIncidents}
          disabled={isExporting === "incidents"}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          <Users className="h-4 w-4" />
          <span>{isExporting === "incidents" ? "Exporting..." : "Export Incidents"}</span>
        </button>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-[10px] text-amber-800">
          <strong>Note:</strong> Exported files contain full audit trail and incident data. Handle
          with appropriate data privacy considerations.
        </p>
      </div>
    </div>
  );
}
