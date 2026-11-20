"use client";

import { ArchiveRestore, Inbox, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ReportDesk } from "@/components/report-desk";
import { ReportQueue, type ReportFilter } from "@/components/report-queue";
import { useToast } from "@/components/toast-provider";
import { ApiError } from "@/lib/api";
import {
  approveReport,
  clockLabel,
  dismissReport,
  escalateReport,
  holdReport,
  listReports,
  rejectReport,
  restoreReport,
  type FieldReport,
} from "@/lib/reports";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * CR-002 §2.4: Moderation and Evidence is the only screen for user-generated
 * field reports — verification, evidence review, and every moderation action
 * (approve, reject/duplicate, hold, escalate, dismiss) lives here.
 */
export default function ModerationPage() {
  const { show } = useToast();
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<"active" | "dismissed">("active");
  const [loading, setLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (target: "active" | "dismissed" = "active") => {
    try {
      const list = await listReports("PENDING", target === "dismissed");
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
      await load(view);
    })();
    const interval = setInterval(() => {
      // A decision in flight would race the refresh and could reselect the row
      // the dispatcher is acting on, so polling pauses while a decision posts.
      if (!busy) load(view);
    }, 10000);
    return () => clearInterval(interval);
  }, [load, busy, view]);

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

  // Every decision runs the same shape: post it, say what happened, reload.
  const decide = useCallback(
    async (
      action: (report: FieldReport) => Promise<unknown>,
      success: string,
      fallback: string,
    ) => {
      if (!selected) return;
      setBusy(true);
      setDecisionError(null);
      try {
        await action(selected);
        show(success);
        await load(view);
      } catch (error) {
        const message = errorMessage(error, fallback);
        setDecisionError(message);
        show(message);
        // A 409 means another officer decided it first; reload to show the truth.
        if (error instanceof ApiError && error.status === 409) await load(view);
      } finally {
        setBusy(false);
      }
    },
    [load, selected, show, view],
  );

  const handleApprove = useCallback(
    (notes: string) =>
      decide(
        (report) => approveReport(report.report_id, notes),
        `Report #${selected?.report_id.slice(0, 8)} approved — the hazard is live on the map`,
        "The report could not be approved.",
      ),
    [decide, selected],
  );

  const handleReject = useCallback(
    (reason: string, duplicateOf: string | null) =>
      decide(
        (report) => rejectReport(report.report_id, reason, duplicateOf),
        duplicateOf
          ? `Report #${selected?.report_id.slice(0, 8)} recorded as a duplicate`
          : `Report #${selected?.report_id.slice(0, 8)} rejected — reason saved to the audit trail`,
        "The decision could not be recorded.",
      ),
    [decide, selected],
  );

  const handleHold = useCallback(
    (reason: string) =>
      decide(
        (report) => holdReport(report.report_id, reason),
        `Report #${selected?.report_id.slice(0, 8)} held for a sensor update`,
        "The report could not be held.",
      ),
    [decide, selected],
  );

  const handleEscalate = useCallback(
    (reason: string, agency: string) =>
      decide(
        (report) => escalateReport(report.report_id, reason, agency),
        `Report #${selected?.report_id.slice(0, 8)} escalated to ${agency}`,
        "The report could not be escalated.",
      ),
    [decide, selected],
  );

  const handleDismiss = useCallback(
    () =>
      decide(
        (report) => dismissReport(report.report_id),
        `Report #${selected?.report_id.slice(0, 8)} dismissed; it is deleted after 72 hours`,
        "The report could not be dismissed.",
      ),
    [decide, selected],
  );

  const handleRestore = useCallback(
    () =>
      decide(
        (report) => restoreReport(report.report_id),
        `Report #${selected?.report_id.slice(0, 8)} restored to the queue`,
        "The report could not be restored.",
      ),
    [decide, selected],
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
      await load(view);
      setBusy(false);
    },
    [load, show, view],
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
      await load(view);
      setBusy(false);
    },
    [load, show, view],
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
              age. Approving publishes a hazard; rejecting, holding, escalating or marking a
              duplicate records the reason.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(
              [
                ["active", "Queue"],
                ["dismissed", "Dismissed"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-pressed={view === id}
                className={`rounded px-2.5 py-1 font-semibold transition-colors ${
                  view === id ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => load(view)}
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
          onBulkApprove={(ids) => void (view === "active" && handleBulkApprove(ids))}
          onBulkReject={(ids, reason) => void (view === "active" && handleBulkReject(ids, reason))}
          onSelect={setSelectedId}
          onFilterChange={setFilter}
          onQueryChange={setQuery}
        />

        {selected && view === "dismissed" ? (
          <div className="col-span-1 space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
            <h2 className="font-mono text-sm font-bold text-slate-900">
              #{selected.report_id.slice(0, 8)}
            </h2>
            <p className="text-xs text-slate-600">
              {selected.depth_label} · {selected.barangay || "no barangay"} · dismissed{" "}
              {clockLabel(selected.dismissed_at ?? null)}
            </p>
            <p className="text-[11px] text-slate-500">
              A dismissed report leaves the queue and is deleted 72 hours after it was dismissed.
              Restoring it puts it back in the queue with its evidence intact.
            </p>
            <button
              type="button"
              onClick={() => void handleRestore()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <ArchiveRestore className="h-3.5 w-3.5" /> Restore to queue
            </button>
          </div>
        ) : selected ? (
          <div className="col-span-1 space-y-3 lg:col-span-7">
            <ReportDesk
              key={selected.report_id}
              report={selected}
              peers={peers}
              busy={busy}
              error={decisionError}
              onApprove={handleApprove}
              onReject={handleReject}
              onHold={handleHold}
              onEscalate={handleEscalate}
            />
            <button
              type="button"
              onClick={() => void handleDismiss()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Dismiss report
            </button>
          </div>
        ) : (
          <div className="col-span-1 flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-center lg:col-span-7">
            <Inbox className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">
              {loading
                ? "Loading the queue…"
                : view === "dismissed"
                  ? "No dismissed reports"
                  : "The queue is clear"}
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
