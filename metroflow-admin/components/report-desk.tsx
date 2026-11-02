"use client";

import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Copy,
  FileWarning,
  Fingerprint,
  MapPin,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { ageLabel, clockLabel, shortHash, type FieldReport, getReportPhoto, getNearestSensorReading, type NearestSensorReading } from "@/lib/reports";

type ReportDeskProps = {
  report: FieldReport;
  /** Other pending reports, offered as targets when recording a duplicate. */
  peers: FieldReport[];
  busy: boolean;
  error: string | null;
  onApprove: (notes: string) => Promise<void>;
  onReject: (reason: string, duplicateOf: string | null) => Promise<void>;
};

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="text-right text-[11px] font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

export function ReportDesk({ report, peers, busy, error, onApprove, onReject }: ReportDeskProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [duplicateOf, setDuplicateOf] = useState<string>("");
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [nearestSensor, setNearestSensor] = useState<NearestSensorReading | null>(null);

  // Evidence is behind an authenticated route, so it is fetched as a blob and
  // turned into an object URL that is revoked when the selection changes. The
  // page keys this component by report id, so per-report state starts clean.
  const hasPhoto = report.photo !== null;
  useEffect(() => {
    if (!hasPhoto) return;

    let cancelled = false;
    let objectUrl: string | null = null;
    getReportPhoto(report.report_id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setPhotoError("Evidence could not be loaded.");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [report.report_id, hasPhoto]);

  // Load nearest sensor reading (FSD-FR-079)
  useEffect(() => {
    getNearestSensorReading(report.report_id)
      .then((sensor) => setNearestSensor(sensor))
      .catch(() => setNearestSensor(null));
  }, [report.report_id]);

  const exif = report.exif ?? {};
  const exifEntries = Object.entries(exif).filter(([, value]) => value !== null && value !== "");
  const camera = [exif.camera_make, exif.camera_model].filter(Boolean).join(" ");
  const duplicateTarget = report.possible_duplicate_of ?? null;

  function applyDuplicate(target: string) {
    setDuplicateOf(target);
    if (reason.trim().length < 3) {
      setReason(`Same event as report ${target.slice(0, 8)}.`);
    }
  }

  async function handleApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onApprove(notes);
    setConfirmingPublish(false);
  }

  async function handleReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim().length < 3) return;
    await onReject(reason, duplicateOf || null);
  }

  return (
    <div className="flex h-[760px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-7">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Evidence desk</h2>
            <span className="font-mono text-xs text-slate-500">
              #{report.report_id.slice(0, 8)}
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {report.status}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Submitted {ageLabel(report.submitted_at)} · urgency {report.urgency_score.toFixed(2)}
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-700">
          <Clock className="h-3 w-3" />
          {report.depth_label}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <section className="border-b border-slate-200 bg-slate-950/95 p-3">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- evidence is a blob URL, not an optimisable asset
            <img
              src={photoUrl}
              alt={`Evidence submitted for report ${report.report_id.slice(0, 8)}`}
              className="mx-auto max-h-72 rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
              {report.photo ? (
                <>
                  <FileWarning className="h-6 w-6" />
                  <p className="text-xs">{photoError ?? "Loading evidence…"}</p>
                </>
              ) : (
                <>
                  <Camera className="h-6 w-6" />
                  <p className="text-xs">No photo attached — this report is a witness statement.</p>
                </>
              )}
            </div>
          )}
          {report.photo ? (
            <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
              <span>{report.photo.mime}</span>
              <span>{Math.round(report.photo.bytes / 1024)} KB</span>
              <span className="font-mono">sha256 {report.photo.sha256.slice(0, 12)}…</span>
            </p>
          ) : null}
        </section>

        <section className="grid gap-x-6 gap-y-0 border-b border-slate-200 p-4 md:grid-cols-2">
          <dl>
            <StatRow label="Barangay" value={report.barangay || "not given"} />
            <StatRow label="Source" value={report.source} />
            <StatRow label="Depth band" value={report.depth_label} />
            <StatRow label="Reported at" value={clockLabel(report.submitted_at)} />
          </dl>
          <dl>
            <StatRow
              label="Coordinates"
              value={
                report.latitude !== null && report.longitude !== null
                  ? `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`
                  : "not given"
              }
            />
            <StatRow label="Captured at" value={clockLabel(report.captured_at)} />
            <StatRow
              label="Reported location"
              value={report.location_plausible ? "Inside pilot area" : "Outside pilot area"}
            />
            <StatRow label="Reporter" value={`${shortHash(report.reporter_hash)} (hashed)`} />
          </dl>
        </section>

        {report.narrative ? (
          <section className="border-b border-slate-200 p-4">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              Witness narrative
            </h3>
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
              “{report.narrative}”
            </p>
          </section>
        ) : null}

        <section className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              <Camera className="h-3.5 w-3.5" /> Camera metadata
            </h3>
            {exifEntries.length === 0 ? (
              <p className="mt-2 text-[11px] text-slate-500">
                No EXIF in the evidence, or none was attached.
              </p>
            ) : (
              <dl className="mt-1">
                <StatRow label="Camera" value={camera || "not recorded"} />
                <StatRow label="Captured" value={exif.captured_at || "not recorded"} />
                <StatRow
                  label="Camera position"
                  value={
                    exif.gps_latitude !== undefined && exif.gps_longitude !== undefined
                      ? `${exif.gps_latitude.toFixed(4)}, ${exif.gps_longitude.toFixed(4)}`
                      : "not recorded"
                  }
                />
              </dl>
            )}
            {exif.gps_in_pilot_area === false ? (
              <p className="mt-2 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 p-2 text-[10px] font-medium text-amber-800">
                <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                The photo&apos;s own GPS is outside Metro Manila, so it cannot evidence this flood
                on its own.
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              <ShieldCheck className="h-3.5 w-3.5" /> Corroboration
            </h3>
            <dl className="mt-1">
              <StatRow label="Nearby reports" value={String(report.nearby_reports)} />
              <StatRow
                label="Possible duplicate"
                value={
                  duplicateTarget ? `#${duplicateTarget.slice(0, 8)}` : "none within 150 m / 15 min"
                }
              />
              <StatRow
                label="Reporter hash"
                value={<span className="font-mono">{shortHash(report.reporter_hash)}</span>}
              />
            </dl>
            {nearestSensor && nearestSensor.sensor_id ? (
              <div className="mt-3 rounded border border-sky-200 bg-sky-50 p-2">
                <p className="mb-1 text-[10px] font-semibold text-sky-800">Nearest rain gauge</p>
                <dl className="space-y-0.5">
                  <StatRow
                    label="Sensor"
                    value={nearestSensor.sensor_name || nearestSensor.sensor_id?.slice(0, 8)}
                  />
                  <StatRow
                    label="Distance"
                    value={nearestSensor.distance_km ? `${nearestSensor.distance_km.toFixed(2)} km` : "unknown"}
                  />
                  <StatRow
                    label="Latest reading"
                    value={
                      nearestSensor.latest_value !== null
                        ? `${nearestSensor.latest_value} ${nearestSensor.latest_unit}`
                        : "no readings"
                    }
                  />
                  <StatRow
                    label="Reading time"
                    value={nearestSensor.latest_recorded_at ? clockLabel(nearestSensor.latest_recorded_at) : "unknown"}
                  />
                  {nearestSensor.is_breach ? (
                    <p className="mt-1 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 p-1.5 text-[10px] font-medium text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      Threshold breach detected
                    </p>
                  ) : null}
                </dl>
              </div>
            ) : null}
            {duplicateTarget ? (
              <button
                type="button"
                onClick={() => applyDuplicate(duplicateTarget)}
                className="mt-2 flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-100"
              >
                <Copy className="h-3 w-3" /> Record as duplicate of #{duplicateTarget.slice(0, 8)}
              </button>
            ) : null}
          </div>
        </section>

        {error ? (
          <p role="alert" className="border-b border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </p>
        ) : null}

        <section className="grid gap-3 p-4 md:grid-cols-2">
          <form
            onSubmit={handleApprove}
            className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3"
          >
            <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-emerald-800 uppercase">
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </h3>
            <p className="text-[11px] text-emerald-900/80">
              Creates and publishes a hazard at this location, immediately visible to driver
              routing.
            </p>
            <label className="block text-[11px] font-medium text-slate-700" htmlFor="report-notes">
              Operator note (optional)
            </label>
            <textarea
              id="report-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="What did you confirm?"
              className="w-full rounded border border-emerald-200 bg-white p-2 text-xs text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
            {confirmingPublish ? (
              <div className="space-y-2 rounded border border-emerald-300 bg-white p-2">
                <p className="text-[11px] font-semibold text-emerald-900">
                  Publishing removes this hazard from the queue and puts it on the live map.
                  Confirm?
                </p>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? "Publishing…" : "Confirm publish"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingPublish(false)}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingPublish(true)}
                disabled={busy}
                className="w-full rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve &amp; publish hazard
              </button>
            )}
          </form>

          <form
            onSubmit={handleReject}
            className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/60 p-3"
          >
            <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-rose-800 uppercase">
              <XCircle className="h-3.5 w-3.5" /> Reject or duplicate
            </h3>
            <label className="block text-[11px] font-medium text-slate-700" htmlFor="reject-reason">
              Reason (required, recorded in the audit trail)
            </label>
            <textarea
              id="reject-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Why is this report not actionable?"
              className="w-full rounded border border-rose-200 bg-white p-2 text-xs text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
            />
            <label className="block text-[11px] font-medium text-slate-700" htmlFor="duplicate-of">
              Duplicate of (optional)
            </label>
            <select
              id="duplicate-of"
              value={duplicateOf}
              onChange={(event) => setDuplicateOf(event.target.value)}
              className="w-full rounded border border-rose-200 bg-white p-2 text-xs text-slate-800 focus:border-rose-500 focus:outline-none"
            >
              <option value="">Not a duplicate</option>
              {peers.map((peer) => (
                <option key={peer.report_id} value={peer.report_id}>
                  #{peer.report_id.slice(0, 8)} · {peer.barangay || "no barangay"} ·{" "}
                  {peer.depth_label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy || reason.trim().length < 3}
              className="w-full rounded border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              {busy ? "Recording…" : duplicateOf ? "Record as duplicate" : "Reject report"}
            </button>
          </form>
        </section>
      </div>

      <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <Fingerprint className="h-3 w-3" />
          Reporter identity is stored as a salted hash only.
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {cn(report.location_plausible ? "text-emerald-700" : "text-amber-700")}
          {report.location_plausible ? "Point inside pilot area" : "Point outside pilot area"}
        </span>
      </footer>
    </div>
  );
}
