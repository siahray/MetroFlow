"use client";

import { RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ReportDesk } from "@/components/report-desk";
import { ReportQueue, type ReportFilter } from "@/components/report-queue";
import { useToast } from "@/components/toast-provider";
import { ApiError } from "@/lib/api";
import {
  approveReport,
  listReports,
  rejectReport,
  type FieldReport,
  type ReportStatus,
} from "@/lib/reports";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function ModerationPage() {
  const { show } = useToast();
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (status: ReportStatus = "PENDING") => {
    try {
      const list = await listReports(status);
      setReports(list);
      setSelectedId((current) =>
        list.some((report) => report.report_id === current) ? current : (list[0]?.report_id ?? ""),
      );
      setQueueError(null);
    } catch (error) {
      setQueueError(
        errorMessage(error, "The moderation queue could not be loaded. Is the API reachable?"),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The initial read is async, so its state updates land in a promise callback
    // rather than synchronously in the effect body.
    void (async () => {
      await load();
    })();
    const interval = setInterval(() => {
      // A decision in flight would race the refresh and could reselect the row
      // the dispatcher is acting on, so polling pauses while a decision posts.
      if (!busy) load();
    }, 10000);
    return () => clearInterval(interval);
  }, [load, busy]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesSource = filter === "all" || report.source === filter;
      const matchesQuery =
        needle === "" ||
        [
          report.report_id,
          report.barangay ?? "",
          report.narrative ?? "",
          report.depth_label,
          report.source,
        ].some((value) => value.toLowerCase().includes(needle));

      return matchesSource && matchesQuery;
    });
  }, [reports, filter, query]);

  const selected = visible.find((report) => report.report_id === selectedId) ?? visible[0] ?? null;
  const peers = selected ? visible.filter((report) => report.report_id !== selected.report_id) : [];

  const handleApprove = useCallback(
    async (notes: string) => {
      if (!selected) return;
      setBusy(true);
      setDecisionError(null);
      try {
        const decided = await approveReport(selected.report_id, notes);
        show(
          `Report #${selected.report_id.slice(0, 8)} approved — hazard #${decided.hazard_id} is live on the map`,
        );
        await load();
      } catch (error) {
        const message = errorMessage(error, "The report could not be approved.");
        setDecisionError(message);
        show(message);
        // A 409 means another officer decided it first; reload to show the truth.
        if (error instanceof ApiError && error.status === 409) await load();
      } finally {
        setBusy(false);
      }
    },
    [load, selected, show],
  );

  const handleReject = useCallback(
    async (reason: string, duplicateOf: string | null) => {
      if (!selected) return;
      setBusy(true);
      setDecisionError(null);
      try {
        await rejectReport(selected.report_id, reason, duplicateOf);
        show(
          duplicateOf
            ? `Report #${selected.report_id.slice(0, 8)} recorded as a duplicate`
            : `Report #${selected.report_id.slice(0, 8)} rejected — reason saved to the audit trail`,
        );
        await load();
      } catch (error) {
        const message = errorMessage(error, "The decision could not be recorded.");
        setDecisionError(message);
        show(message);
        if (error instanceof ApiError && error.status === 409) await load();
      } finally {
        setBusy(false);
      }
    },
    [load, selected, show],
  );

  // P3-3: bulk decisions run the same audited endpoints one row at a time —
  // the API has no batch verb, and per-row calls keep the audit trail intact.
  const handleBulkApprove = useCallback(
    async (reportIds: string[]) => {
      setBusy(true);
      let succeeded = 0;
      let failed = 0;
      for (const id of reportIds) {
        try {
          await approveReport(id);
          succeeded += 1;
        } catch {
          failed += 1;
        }
      }
      show(
        failed === 0
          ? `${succeeded} report${succeeded === 1 ? "" : "s"} approved — hazards are live on the map`
          : `${succeeded} approved, ${failed} failed — the queue was refreshed`,
      );
      await load();
      setBusy(false);
    },
    [load, show],
  );

  const handleBulkReject = useCallback(
    async (reportIds: string[], reason: string) => {
      setBusy(true);
      let succeeded = 0;
      let failed = 0;
      for (const id of reportIds) {
        try {
          await rejectReport(id, reason, null);
          succeeded += 1;
        } catch {
          failed += 1;
        }
      }
      show(
        failed === 0
          ? `${succeeded} report${succeeded === 1 ? "" : "s"} rejected`
          : `${succeeded} rejected, ${failed} failed — the queue was refreshed`,
      );
      await load();
      setBusy(false);
    },
    [load, show],
  );

  return (
    <AppShell activeItem="moderation" title="Moderation & Evidence Desk">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-600">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-sm font-bold text-slate-900">Field report moderation</h1>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Queue order is the live urgency score: depth, source and corroboration, decayed by
              age. Approving publishes a hazard; rejecting or marking a duplicate records the
              reason.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Auto-refresh 10 s
          </span>
          <button
            type="button"
            onClick={() => load()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      {queueError ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
        >
          {queueError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <ReportQueue
          reports={visible}
          selectedId={selected?.report_id ?? ""}
          filter={filter}
          query={query}
          busy={busy}
          onBulkApprove={(ids) => void handleBulkApprove(ids)}
          onBulkReject={(ids, reason) => void handleBulkReject(ids, reason)}
          onSelect={setSelectedId}
          onFilterChange={setFilter}
          onQueryChange={setQuery}
        />

        {selected ? (
          <ReportDesk
            key={selected.report_id}
            report={selected}
            peers={peers}
            busy={busy}
            error={decisionError}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ) : (
          <div className="col-span-1 flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-center lg:col-span-7">
            <ShieldCheck className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">
              {loading ? "Loading the queue…" : "The queue is clear"}
            </p>
            <p className="max-w-sm text-[11px] text-slate-500">
              {loading
                ? "Reading pending field reports from the API."
                : "No pending field reports match this filter. Approved and rejected reports leave the queue and stay in the audit trail."}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
