"use client";

import { Check, MapPin, Navigation, Pentagon, Route, Spline, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ErrorNotice } from "./error-notice";
import { NetworkMap, type DrawnGeometry } from "./network-map";
import { subscribeToHazards } from "@/lib/live-stream";
import { createHazard, publishHazard, withdrawHazard, type HazardZone } from "@/lib/hazards";
import { fetchNetworkState, type NetworkSummary } from "@/lib/network";

type FloodClosureEditorProps = {
  onAction: (message: string) => void;
};

// The levels the router understands. LEVEL_2 and above close the segment for routing;
// CAUTION warns drivers but leaves it passable.
const LEVELS = [
  { id: "CAUTION", label: "Caution: passable, drivers are warned" },
  { id: "LEVEL_2", label: "Level 2: closed to routing (knee-deep)" },
  { id: "LEVEL_3", label: "Level 3: closed to routing (deep)" },
  { id: "IMPASSABLE", label: "Impassable: closed to routing" },
] as const;

type Segment = { edgeId: number; label: string };

export function FloodClosureEditor({ onAction }: FloodClosureEditorProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [edgeId, setEdgeId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]["id"]>("LEVEL_2");
  const [depthCm, setDepthCm] = useState("");
  const [hazards, setHazards] = useState<HazardZone[]>([]);
  // The stream sends a snapshot on connect, so this flips false on the first payload.
  // shortcut: a dead feed stays on "Connecting…" because subscribe() retries silently;
  // add an onError hook to live-stream.ts if the panel must say the feed failed.
  const [hazardsLoading, setHazardsLoading] = useState(true);
  const [segmentsLoading, setSegmentsLoading] = useState(true);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [segmentsReloadKey, setSegmentsReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);
  const [networkSummary, setNetworkSummary] = useState<NetworkSummary | null>(null);
  // FSD-FR-082, FR-083: a hazard can be attached to one road segment (the
  // default) or drawn as a flood polygon / closure line on the map.
  const [shape, setShape] = useState<"segment" | "polygon" | "line">("segment");
  const [drawnGeometry, setDrawnGeometry] = useState<DrawnGeometry | null>(null);
  // The map's clearance/rainfall/routing controls portal into this element
  // instead of floating over the map canvas. A ref alone would not trigger
  // the re-render NetworkMap needs once the node exists, so it's state.
  const [controlsContainer, setControlsContainer] = useState<HTMLDivElement | null>(null);

  // Stable so the map's summary effect does not re-run on every parent render.
  const handleNetworkSummary = useCallback((summary: NetworkSummary) => {
    setNetworkSummary(summary);
  }, []);

  // The road segments a hazard can be attached to come straight from the network.
  useEffect(() => {
    const controller = new AbortController();
    fetchNetworkState(30, controller.signal)
      .then((state) => {
        setSegments(
          state.edges.features.map((edge) => ({
            edgeId: edge.properties.edge_id,
            label: `${edge.properties.start_name ?? `Node ${edge.properties.start_node_id}`} → ${
              edge.properties.end_name ?? `Node ${edge.properties.end_node_id}`
            }`,
          })),
        );
        setSegmentsError(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSegments([]);
          setSegmentsError("Could not load the road segments. Check the connection and retry.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSegmentsLoading(false);
      });
    return () => controller.abort();
  }, [segmentsReloadKey]);

  // Live hazard list (FSD-FR-086): the stream pushes each change once and the snapshot covers
  // whatever happened while this tab was disconnected.
  useEffect(() => {
    const controller = new AbortController();
    void subscribeToHazards((rows) => {
      setHazards([...rows].sort((a, b) => b.hazard_id - a.hazard_id));
      setHazardsLoading(false);
    }, controller.signal);
    return () => controller.abort();
  }, []);

  const canPublish =
    !saving &&
    name.trim().length > 0 &&
    (shape === "segment" ? edgeId !== null : drawnGeometry !== null);

  async function handlePublish() {
    if (!canPublish) return;
    setSaving(true);
    try {
      const created = await createHazard({
        name: name.trim(),
        obstruction_level: level,
        avg_depth_cm: depthCm === "" ? undefined : Number(depthCm),
        edge_id: shape === "segment" ? edgeId : null,
        geometry: shape === "segment" ? null : drawnGeometry,
      });
      const published = await publishHazard(created.hazard_id);
      setHazards((current) => [
        published,
        ...current.filter((h) => h.hazard_id !== published.hazard_id),
      ]);
      onAction(`Published hazard #${published.hazard_id}: ${published.name}`);
      setName("");
      setDepthCm("");
      setDrawnGeometry(null);
    } catch {
      onAction(`Failed to publish the hazard "${name.trim()}"`);
    } finally {
      setSaving(false);
    }
  }

  async function handleWithdraw(hazard: HazardZone) {
    setWithdrawingId(hazard.hazard_id);
    try {
      const withdrawn = await withdrawHazard(hazard.hazard_id);
      setHazards((current) =>
        current.map((h) => (h.hazard_id === withdrawn.hazard_id ? withdrawn : h)),
      );
      onAction(`Withdrew hazard #${withdrawn.hazard_id}: ${withdrawn.name}`);
    } catch {
      onAction(`Failed to withdraw hazard #${hazard.hazard_id}`);
    } finally {
      setWithdrawingId(null);
    }
  }

  const segmentLabel = (id: number | null) => segments.find((s) => s.edgeId === id)?.label;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          Live Road Network &amp; Hazards
        </h2>
        <p className="text-xs text-slate-500">
          Publish a hazard on a road segment, or draw a flood area or closure line directly on the
          map, so drivers are warned and, from Level 2 up, routed around it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Live network map + its controls, stacked so the grid always treats
            them as one column next to the sidebar (not a 3rd auto-placed item) */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="relative h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-brand-primary shadow-sm">
            <NetworkMap
              showGraph
              onAction={onAction}
              onSummary={handleNetworkSummary}
              drawMode={shape === "segment" ? null : shape}
              onDrawComplete={(geometry) => {
                setDrawnGeometry(geometry);
                if (!geometry) setShape("segment");
              }}
              controlsContainer={controlsContainer}
            />
          </div>

          {/* Clearance/rainfall/routing controls, below the map rather than over it */}
          <div ref={setControlsContainer} />
        </div>

        {/* Publish form and live hazards */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <MapPin className="h-4 w-4 text-sky-600" /> Publish a road hazard
          </h3>

          <div>
            <span className="mb-1.5 block text-xs font-semibold text-slate-700 uppercase">
              Shape
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "segment", label: "Road segment", Icon: Route },
                  { id: "polygon", label: "Flood area", Icon: Pentagon },
                  { id: "line", label: "Closure line", Icon: Spline },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setShape(id);
                    setDrawnGeometry(null);
                  }}
                  className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors ${
                    shape === id
                      ? "border-slate-900 bg-brand-primary text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-3 w-3" /> {label}
                </button>
              ))}
            </div>
          </div>

          {shape === "segment" ? (
            <div>
              <label
                htmlFor="hazard-segment"
                className="mb-1 block text-xs font-semibold text-slate-700 uppercase"
              >
                Road segment
              </label>
              {segmentsError ? (
                <ErrorNotice
                  message={segmentsError}
                  onRetry={() => {
                    setSegmentsError(null);
                    setSegmentsLoading(true);
                    setSegmentsReloadKey((key) => key + 1);
                  }}
                />
              ) : (
                <select
                  id="hazard-segment"
                  value={edgeId ?? ""}
                  onChange={(e) => setEdgeId(e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium focus:border-slate-900 focus:outline-none"
                >
                  <option value="">
                    {segmentsLoading ? "Loading segments…" : "Choose a segment"}
                  </option>
                  {segments.map((s) => (
                    <option key={s.edgeId} value={s.edgeId}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              {drawnGeometry
                ? `Shape ready (${shape === "polygon" ? "flood area" : "closure line"}).`
                : `Draw the ${shape === "polygon" ? "flood area" : "closure line"} on the map, then click "Finish shape".`}
            </p>
          )}

          <div>
            <label
              htmlFor="hazard-name"
              className="mb-1 block text-xs font-semibold text-slate-700 uppercase"
            >
              Name
            </label>
            <input
              id="hazard-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={segmentLabel(edgeId) ?? "e.g. Flooded underpass"}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="hazard-level"
              className="mb-1 block text-xs font-semibold text-slate-700 uppercase"
            >
              Severity
            </label>
            <select
              id="hazard-level"
              value={level}
              onChange={(e) => setLevel(e.target.value as (typeof LEVELS)[number]["id"])}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium focus:border-slate-900 focus:outline-none"
            >
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="hazard-depth"
              className="mb-1 block text-xs font-semibold text-slate-700 uppercase"
            >
              Water depth (cm, optional)
            </label>
            <input
              id="hazard-depth"
              type="number"
              min={0}
              max={500}
              value={depthCm}
              onChange={(e) => setDepthCm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium focus:border-slate-900 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handlePublish}
            disabled={!canPublish}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-primary py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> {saving ? "Publishing…" : "Publish to drivers"}
          </button>

          {/* Live hazards */}
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-[10px] font-bold text-slate-600 uppercase">Active hazards</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                {hazardsLoading ? "—" : hazards.length}
              </span>
            </div>
            {hazardsLoading ? (
              <p className="py-1 text-[11px] text-slate-400">Connecting to the live hazard feed…</p>
            ) : hazards.length === 0 ? (
              <p className="py-1 text-[11px] text-slate-400">No active hazards.</p>
            ) : (
              <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                {hazards.slice(0, 10).map((hazard) => (
                  <li
                    key={hazard.hazard_id}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="truncate font-medium text-slate-800">
                      #{hazard.hazard_id} {hazard.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="font-mono text-[10px] text-slate-500">
                        {hazard.obstruction_level}
                        {hazard.avg_depth_cm != null ? ` · ${hazard.avg_depth_cm} cm` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleWithdraw(hazard)}
                        disabled={withdrawingId === hazard.hazard_id}
                        aria-label={`Withdraw hazard ${hazard.name}`}
                        title="Withdraw"
                        className="rounded p-0.5 text-slate-400 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Reroute preview from the map (start and target picked on the map) */}
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
            <div className="mb-0.5 flex items-center gap-1 text-[10px] font-bold tracking-wider text-sky-800 uppercase">
              <Navigation className="h-3 w-3" /> Route preview
            </div>
            {networkSummary?.route ? (
              <p className="text-[11px] leading-snug text-sky-900">
                Node {networkSummary.route.path[0]} →{" "}
                {networkSummary.route.path[networkSummary.route.path.length - 1]} via{" "}
                {networkSummary.route.nodes} nodes, {networkSummary.route.minutes.toFixed(1)} min at{" "}
                {networkSummary.clearanceCm} cm clearance.
              </p>
            ) : (
              <p className="text-[11px] leading-snug text-sky-900">
                Choose a start and target node on the map to preview the flood-safe route.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
