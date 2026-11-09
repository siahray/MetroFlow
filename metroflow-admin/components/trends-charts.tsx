"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_COLORS } from "@/lib/network";
import type { SOSRequest, Vehicle } from "@/lib/dispatch";
import type { HazardZone } from "@/lib/hazards";
import type { FieldReport } from "@/lib/reports";

/**
 * P2-4: operational charts for the triage page. Everything is computed from
 * the live queues the page already polls — there is no historical analytics
 * endpoint, so the volume chart covers the trailing 24 hours of *queued*
 * signals, not all-time traffic.
 */

const PIE_COLORS = CHART_COLORS.fleet;

function parseTime(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

type VolumeRow = { hour: string; sos: number; reports: number };

function volumeSeries(sos: SOSRequest[], reports: FieldReport[]): VolumeRow[] {
  const now = Date.now();
  const buckets: VolumeRow[] = Array.from({ length: 24 }, (_, i) => {
    const start = new Date(now - (23 - i) * 3_600_000);
    start.setMinutes(0, 0, 0);
    return {
      hour: start.toLocaleTimeString(undefined, { hour: "numeric" }),
      sos: 0,
      reports: 0,
    };
  });
  const bucketStart = (time: number) => {
    const d = new Date(time);
    d.setMinutes(0, 0, 0);
    return d.getTime();
  };
  const firstBucket = bucketStart(now - 23 * 3_600_000);

  const bump = (time: number | null, key: "sos" | "reports") => {
    if (time === null) return;
    const start = bucketStart(time);
    const index = Math.floor((start - firstBucket) / 3_600_000);
    if (index >= 0 && index < buckets.length) buckets[index][key] += 1;
  };

  for (const row of sos) bump(parseTime(row.created_at), "sos");
  for (const row of reports) bump(parseTime(row.submitted_at), "reports");
  return buckets;
}

type NamedCount = { name: string; value: number };

function countBy<T>(rows: T[], key: (row: T) => string): NamedCount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const name = key(row);
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

const tooltipStyle = {
  fontSize: 11,
  borderRadius: 8,
  border: `1px solid ${CHART_COLORS.tooltipBorder}`,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
};

export function TrendsCharts({
  sos,
  reports,
  vehicles,
  hazards,
}: {
  sos: SOSRequest[];
  reports: FieldReport[];
  vehicles: Vehicle[];
  hazards: HazardZone[];
}) {
  const volume = volumeSeries(sos, reports);
  const fleet = countBy(vehicles, (v) => v.status || "UNKNOWN");
  const hazardLevels = countBy(
    hazards.filter((h) => h.active !== false),
    (h) => h.obstruction_level,
  );

  const empty =
    volume.every((row) => row.sos + row.reports === 0) &&
    fleet.length === 0 &&
    hazardLevels.length === 0;

  if (empty) {
    return null;
  }

  return (
    <section
      aria-label="Operational trends"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Operational trends</h2>
          <p className="text-[11px] text-slate-500">
            Live queue activity — trailing 24 hours, current fleet and hazards.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-100 p-3">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Signals — last 24 h
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volume} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9, fill: CHART_COLORS.axis }}
                  tickLine={false}
                  interval={3}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 9, fill: CHART_COLORS.axis }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: CHART_COLORS.cursor }} />
                <Bar dataKey="sos" name="SOS" fill={CHART_COLORS.sos} radius={[2, 2, 0, 0]} />
                <Bar
                  dataKey="reports"
                  name="Reports"
                  fill={CHART_COLORS.report}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 p-3">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Fleet utilization
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fleet}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={34}
                  outerRadius={58}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {fleet.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {fleet.map((entry, index) => (
              <span key={entry.name} className="flex items-center gap-1 text-[10px] text-slate-500">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                />
                {entry.name} ({entry.value})
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 p-3">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Active hazards by level
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={hazardLevels}
                layout="vertical"
                margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid
                  stroke={CHART_COLORS.grid}
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 9, fill: CHART_COLORS.axis }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  tick={{ fontSize: 9, fill: CHART_COLORS.axis }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: CHART_COLORS.cursor }} />
                <Bar
                  dataKey="value"
                  name="Hazards"
                  fill={CHART_COLORS.hazard}
                  radius={[0, 2, 2, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
