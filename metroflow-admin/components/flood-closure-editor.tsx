"use client";

import {
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle,
  GitCommit,
  Hexagon,
  Layers,
  Map as MapIcon,
  MapPin,
  MousePointer2,
  Navigation,
  RotateCcw,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { NetworkMap } from "./network-map";
import { cn } from "@/lib/cn";
import { hazardsFromEvent, subscribeToHazards } from "@/lib/hazard-stream";
import { createHazard, publishHazard, type HazardZone } from "@/lib/hazards";
import type { NetworkSummary } from "@/lib/network";

type FloodClosureEditorProps = {
  onAction: (message: string) => void;
};

const TOOLS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "select", label: "Select & Move", icon: MousePointer2 },
  { id: "polygon", label: "Draw Flood Polygon", icon: Hexagon },
  { id: "line", label: "Draw Closure Line", icon: GitCommit },
  { id: "pin", label: "Place Hazard Pin", icon: MapPin },
];

const COLOR_SWATCHES = [
  { id: "sky-800", color: "#075985" },
  { id: "sky-500", color: "#0ea5e9" },
  { id: "amber-500", color: "#f59e0b" },
  { id: "rose-500", color: "#f43f5e" },
  { id: "rose-800", color: "#9f1239" },
];

export function FloodClosureEditor({ onAction }: FloodClosureEditorProps) {
  const [activeMode, setActiveMode] = useState<"polygon" | "closure">("polygon");
  const [activeTool, setActiveTool] = useState("select");
  const [polygonName, setPolygonName] = useState("");
  const [depthCm, setDepthCm] = useState(0);
  const [obstructionLevel, setObstructionLevel] = useState("SUBMERGED");
  const [selectedSwatch, setSelectedSwatch] = useState("sky-500");
  const [barrierDeployed, setBarrierDeployed] = useState(true);
  const [hazards, setHazards] = useState<HazardZone[]>([]);
  const [saving, setSaving] = useState(false);
  const [networkSummary, setNetworkSummary] = useState<NetworkSummary | null>(null);
  const [layers, setLayers] = useState({
    graph: true,
    polygons: true,
    fleet: true,
  });

  // Stable so the map's summary effect does not re-run on every parent render.
  const handleNetworkSummary = useCallback((summary: NetworkSummary) => {
    setNetworkSummary(summary);
  }, []);

  // Live hazard layer (FSD-FR-086). A poll left the editor up to 15 s stale, and
  // every dispatcher polled on its own timer; the stream pushes each change once
  // and the snapshot covers whatever happened while this tab was disconnected.
  useEffect(() => {
    const controller = new AbortController();
    const hazardsById = new Map<number, HazardZone>();

    void subscribeToHazards((event) => {
      const incoming = hazardsFromEvent(event);
      if (incoming === null) return;
      if (event.type === "snapshot") hazardsById.clear();

      for (const hazard of incoming) {
        // The snapshot only carries active hazards, so a later update saying
        // "withdrawn" has to remove the row rather than leave a stale polygon.
        if (event.type !== "snapshot" && hazard.active === false) {
          hazardsById.delete(hazard.hazard_id);
        } else {
          hazardsById.set(hazard.hazard_id, hazard);
        }
      }

      setHazards(Array.from(hazardsById.values()).sort((a, b) => b.hazard_id - a.hazard_id));
    }, controller.signal);

    return () => controller.abort();
  }, []);

  async function handlePublish() {
    if (saving) return;
    setSaving(true);
    try {
      const created = await createHazard({
        name: polygonName,
        obstruction_level: obstructionLevel,
        avg_depth_cm: depthCm,
      });
      const published = await publishHazard(created.hazard_id);
      setHazards((current) => [published, ...current]);
      onAction(`Published Hazard #${published.hazard_id}: ${polygonName} (${depthCm} cm)`);
    } catch {
      onAction(`Failed to publish hazard ${polygonName}`);
    } finally {
      setSaving(false);
    }
  }

  function handleWithdraw() {
    onAction(`Withdrawn Hazard: ${polygonName} from road network.`);
  }

  function handleReset() {
    setDepthCm(140);
    setPolygonName("San Pedro Riverside Inundation");
    setObstructionLevel("SUBMERGED");
    setBarrierDeployed(true);
    onAction("Reset map authoring canvas to active telemetry snapshot");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Live Road Network &amp; Hazard Authoring
          </h2>
          <p className="text-xs text-slate-500">
            Draw flood polygons and road closures to publish flood-safe dynamic rerouting for
            drivers
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Telemetry Sync Active indicator */}
          <div className="flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-2"></span>
            Telemetry Sync: Active
          </div>
          <span className="rounded border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-600 shadow-2xs">
            SRID: 4326 PostGIS
          </span>
          <button
            type="button"
            onClick={handlePublish}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
          >
            <UploadCloud className="h-3.5 w-3.5" /> Publish Hazard Live
          </button>
        </div>
      </div>

      {/* Mode Toolbar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMode("polygon")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              activeMode === "polygon"
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span>Flood Polygon</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("closure")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              activeMode === "closure"
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            <span>Road Closure</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Canvas</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Interactive Map Canvas (Left 7 or 8 Cols) */}
        <div className="relative flex min-h-[660px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl lg:col-span-7">
          {/* Floating Draw Tools Header */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/90 p-1.5 shadow-md backdrop-blur">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isSelected = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveTool(tool.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    isSelected
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tool.label}</span>
                </button>
              );
            })}
          </div>

          {/* Floating Canvas Tool Palette (Left Vertical) */}
          <div className="absolute top-16 left-4 z-20 flex flex-col space-y-1 rounded-lg border border-slate-700 bg-slate-950/90 p-1 shadow-md backdrop-blur">
            <button
              type="button"
              className="p-1.5 text-slate-300 hover:bg-slate-800 rounded transition-colors"
              title="Recenter Map"
            >
              <Navigation className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="p-1.5 text-slate-300 hover:bg-slate-800 rounded transition-colors"
              title="Place Pin"
            >
              <MapPin className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="p-1.5 text-emerald-400 hover:bg-slate-800 rounded transition-colors"
              title="Validate Topology"
            >
              <CheckCircle className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Layer Toggles */}
          <div className="absolute top-4 right-4 z-20 space-y-2 rounded-xl border border-slate-800 bg-slate-950/90 p-3 text-xs text-white backdrop-blur">
            <div className="flex items-center gap-1 font-bold text-[11px] text-slate-400 uppercase tracking-wider">
              <Layers className="h-3.5 w-3.5 text-sky-400" />
              <span>Map Layers</span>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={layers.graph}
                onChange={(e) => setLayers((prev) => ({ ...prev, graph: e.target.checked }))}
                className="h-3.5 w-3.5 rounded text-sky-600"
              />
              <span>Live Road Graph</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={layers.polygons}
                onChange={(e) => setLayers((prev) => ({ ...prev, polygons: e.target.checked }))}
                className="h-3.5 w-3.5 rounded text-sky-600"
              />
              <span>Flood Polygons (cm)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={layers.fleet}
                onChange={(e) => setLayers((prev) => ({ ...prev, fleet: e.target.checked }))}
                className="h-3.5 w-3.5 rounded text-sky-600"
              />
              <span>Rescue Units</span>
            </label>
          </div>

          {/* Live road network on a keyless basemap */}
          <div className="absolute inset-0">
            <NetworkMap
              showGraph={layers.graph}
              onAction={onAction}
              onSummary={handleNetworkSummary}
            />

            {/* Bottom Context Bar on Canvas */}
            <div className="absolute bottom-4 inset-x-4 z-20 flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/90 p-3 font-mono text-xs text-slate-300 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center font-medium text-slate-200">
                  <span className="mr-1.5 h-2.5 w-2.5 rounded-sm bg-sky-500"></span>
                  Polygon: {polygonName}
                </span>
                {networkSummary ? (
                  <>
                    <span className="flex items-center font-medium text-emerald-300">
                      <span className="mr-1.5 h-1.5 w-3 rounded-xs bg-emerald-500"></span>
                      {networkSummary.passable} passable
                    </span>
                    <span className="flex items-center font-medium text-amber-300">
                      <span className="mr-1.5 h-1.5 w-3 rounded-xs bg-amber-500"></span>
                      {networkSummary.lightFlood} flooded
                    </span>
                    <span className="flex items-center font-medium text-rose-300">
                      <span className="mr-1.5 h-1.5 w-3 rounded-xs bg-rose-500"></span>
                      {networkSummary.submerged} submerged
                    </span>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-3 text-slate-400">
                <span>Clearance: {networkSummary?.clearanceCm ?? "–"} cm</span>
                <span>Depth: {depthCm} cm</span>
                <span>
                  Graph:{" "}
                  {networkSummary
                    ? `${networkSummary.nodeCount}N / ${networkSummary.edgeCount}E`
                    : "…"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Hazard Properties & Road Closure Side Panel (Right 5 Cols) */}
        <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5 overflow-y-auto min-h-[660px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-800">Flood Polygon</h3>
              </div>
              <span className="rounded bg-sky-50 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-700">
                ID: FP-2026-08
              </span>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 uppercase">
                Polygon Identifier / Name
              </label>
              <div className="relative">
                <MapPin className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={polygonName}
                  onChange={(e) => setPolygonName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-8 text-xs font-medium focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 uppercase">
                Obstruction Severity Level (FSD-FR-084)
              </label>
              <select
                value={obstructionLevel}
                onChange={(e) => setObstructionLevel(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-medium focus:border-sky-500 focus:outline-none"
              >
                <option value="SUBMERGED">High (Impassable to all civilian vehicles)</option>
                <option value="LIGHT_FLOOD">Moderate (Impassable to light vehicles)</option>
                <option value="PASSABLE">Low (Caution, passable)</option>
              </select>
            </div>

            {/* Depth Slider in cm */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Water Depth (cm)
                </label>
                <span className="font-mono text-xs font-bold text-sky-600">{depthCm} cm</span>
              </div>
              <input
                type="range"
                min="10"
                max="250"
                value={depthCm}
                onChange={(e) => setDepthCm(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
              <div className="mt-0.5 flex justify-between font-mono text-[10px] text-slate-400">
                <span>10 cm (Caution)</span>
                <span>140 cm (Deep)</span>
                <span>250 cm (Max)</span>
              </div>
            </div>

            {/* Avg Depth */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Avg. Depth</div>
              <div className="text-sm font-bold text-sky-700">
                {depthCm} cm ({(depthCm / 100).toFixed(1)}m)
              </div>
            </div>

            {/* Live Hazards from Database */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[10px] font-bold text-slate-600 uppercase">
                  Published Hazards (DB)
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                  {hazards.filter((h) => h.published_at).length}
                </span>
              </div>
              {hazards.length === 0 ? (
                <p className="py-1 text-[11px] text-slate-400">No hazards recorded yet.</p>
              ) : (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                  {hazards.slice(0, 8).map((hazard) => (
                    <li
                      key={hazard.hazard_id}
                      className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-semibold text-slate-800">
                          #{hazard.hazard_id} {hazard.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {hazard.obstruction_level} • {hazard.avg_depth_cm ?? 0} cm
                        </div>
                      </div>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                          hazard.published_at
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {hazard.published_at ? "Live" : "Draft"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Overlay Color Swatches */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 uppercase">
                Map Overlay Color Swatch
              </label>
              <div className="flex gap-2">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.id}
                    type="button"
                    onClick={() => setSelectedSwatch(swatch.id)}
                    style={{ backgroundColor: swatch.color }}
                    className={cn(
                      "h-6 w-6 rounded-full cursor-pointer transition-transform",
                      selectedSwatch === swatch.id
                        ? "ring-2 ring-sky-500 ring-offset-2 scale-110"
                        : "hover:scale-105",
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Road Closure Barricade Section */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <AlertOctagon className="h-3.5 w-3.5 text-rose-600" />
                  <span>Road Closure Segment</span>
                </div>
                <span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  Active Barricade
                </span>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">
                  Target Road Segment
                </label>
                <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800">
                  Rizal Avenue (San Pedro - Bridge)
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">
                  Closure Reason
                </label>
                <div className="relative">
                  <input
                    type="text"
                    defaultValue="Flooding / Heavy Submersion"
                    className="w-full rounded border border-rose-200 bg-white py-1.5 pr-8 pl-2.5 text-xs font-semibold text-rose-700 focus:outline-none"
                  />
                  <AlertTriangle className="absolute top-2 right-2.5 h-3.5 w-3.5 text-rose-500" />
                </div>
              </div>

              {/* Physical Barrier Deployed Switch */}
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    Physical Barrier Deployed
                  </div>
                  <div className="text-[10px] text-slate-500">
                    PNP / LGU Traffic Marshal on Site
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBarrierDeployed((prev) => !prev)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    barrierDeployed ? "bg-emerald-500" : "bg-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform shadow-xs",
                      barrierDeployed ? "right-1" : "left-1",
                    )}
                  />
                </button>
              </div>

              {/* Suggested Reroute Advisory Card */}
              <div className="rounded-lg border border-sky-100 bg-sky-50 p-2.5">
                <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider mb-0.5">
                  Suggested Reroute
                </div>
                {networkSummary?.route ? (
                  <p className="text-[11px] text-sky-900 leading-snug">
                    Node {networkSummary.route.path[0]} →{" "}
                    {networkSummary.route.path[networkSummary.route.path.length - 1]} via{" "}
                    {networkSummary.route.nodes} nodes, {networkSummary.route.minutes.toFixed(1)}{" "}
                    min at {networkSummary.clearanceCm} cm clearance.
                  </p>
                ) : (
                  <p className="text-[11px] leading-snug text-sky-900">
                    No route computed yet. Choose a start and target node on the map to preview the
                    flood-safe A* reroute.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={handlePublish}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-slate-800 transition-colors"
            >
              <Check className="h-4 w-4" /> Publish &amp; Broadcast to Drivers
            </button>
            <button
              type="button"
              onClick={handleWithdraw}
              className="w-full rounded-lg border border-rose-200 bg-rose-50 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors"
            >
              Withdraw / Deactivate Zone
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
