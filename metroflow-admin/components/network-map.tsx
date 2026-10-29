"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { CloudRain, Route as RouteIcon, Waves } from "lucide-react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  Popup as MapLibrePopup,
} from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  fetchNetworkState,
  fetchRoute,
  formatDepthCm,
  runRainfallSimulation,
  STATUS_COLORS,
  STATUS_LABELS,
  summariseNetwork,
  type EdgeProperties,
  type NetworkState,
  type NetworkSummary,
  type RouteResult,
} from "@/lib/network";

/**
 * Keyless basemap. Carto's Positron style is free to use with attribution and
 * deliberately desaturated, so the network status colours are the only
 * saturated thing on screen (TSD ADR-020: no per-event tile provider call).
 */
const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const NETWORK_LAYER_IDS = [
  "network-edges-casing",
  "network-edges-live",
  "network-nodes",
  "network-node-labels",
] as const;

const EMPTY_COLLECTION = { type: "FeatureCollection" as const, features: [] };

const STATUS_FILTER: Record<
  "PASSABLE" | "LIGHT_FLOOD" | "SUBMERGED",
  "passable" | "lightFlood" | "submerged"
> = {
  PASSABLE: "passable",
  LIGHT_FLOOD: "lightFlood",
  SUBMERGED: "submerged",
};

type NetworkMapProps = {
  /** Layer checkbox in the editor: hide the graph, keep the basemap. */
  showGraph: boolean;
  /** Toast sink, so simulation and routing results land in the same place. */
  onAction: (message: string) => void;
  /** Called whenever the rendered verdicts or the active route change. */
  onSummary: (summary: NetworkSummary) => void;
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "The network request failed.";
}

/** Build the edge popup with DOM nodes: names come from the database, not HTML. */
function buildPopupContent(props: EdgeProperties): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.fontSize = "12px";
  wrapper.style.lineHeight = "1.45";
  wrapper.style.color = "#0f172a";

  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.style.marginBottom = "2px";
  title.textContent = `${props.start_name ?? `Node ${props.start_node_id}`} → ${
    props.end_name ?? `Node ${props.end_node_id}`
  }`;

  const status = document.createElement("div");
  status.style.fontWeight = "700";
  status.style.color = STATUS_COLORS[props.status] ?? "#0f172a";
  status.textContent = `${STATUS_LABELS[props.status] ?? props.status} · ${formatDepthCm(
    props.water_depth_cm,
  )}`;

  const meta = document.createElement("div");
  meta.style.color = "#475569";
  meta.textContent = `Edge #${props.edge_id} · ${Math.round(props.distance_m)} m · ${Math.round(
    props.avg_speed_kmh,
  )} km/h`;

  wrapper.append(title, status, meta);
  return wrapper;
}

export function NetworkMap({ showGraph, onAction, onSummary }: NetworkMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<MapLibrePopup | null>(null);
  const fittedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [network, setNetwork] = useState<NetworkState | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"simulation" | "route" | null>(null);
  const [clearanceCm, setClearanceCm] = useState(30);
  const [rainfallMmHr, setRainfallMmHr] = useState(0);
  const [startNodeId, setStartNodeId] = useState<number | null>(null);
  const [targetNodeId, setTargetNodeId] = useState<number | null>(null);

  // --- Map lifecycle -------------------------------------------------------
  // MapLibre touches `window`, so it is imported inside the effect and the
  // component stays server-renderable.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let map: MapLibreMap | null = null;

    void (async () => {
      const { Map, NavigationControl, Popup, setWorkerUrl } = await import("maplibre-gl");
      if (disposed) return;

      // Turbopack rewrites `import.meta.url`, so MapLibre cannot find its
      // worker next to the bundled chunk. scripts/sync-maplibre-worker.mjs
      // copies it into public/ and this points at that copy.
      setWorkerUrl("/maplibre-gl-worker.mjs");

      map = new Map({
        container,
        style: BASEMAP_STYLE,
        center: [121.064, 14.565],
        zoom: 13.1,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

      map.on("load", () => {
        if (disposed || !map) return;

        map.addSource("network-edges", { type: "geojson", data: EMPTY_COLLECTION });
        map.addSource("network-nodes", { type: "geojson", data: EMPTY_COLLECTION });
        map.addSource("network-route", { type: "geojson", data: EMPTY_COLLECTION });
        map.addSource("network-route-ends", { type: "geojson", data: EMPTY_COLLECTION });

        map.addLayer({
          id: "network-edges-casing",
          type: "line",
          source: "network-edges",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#f8fafc", "line-width": 6.5, "line-opacity": 0.9 },
        });

        map.addLayer({
          id: "network-edges-live",
          type: "line",
          source: "network-edges",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": [
              "match",
              ["get", "status"],
              "SUBMERGED",
              STATUS_COLORS.SUBMERGED,
              "LIGHT_FLOOD",
              STATUS_COLORS.LIGHT_FLOOD,
              STATUS_COLORS.PASSABLE,
            ],
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              11,
              ["match", ["get", "status"], "SUBMERGED", 4.5, "LIGHT_FLOOD", 4, 3],
              16,
              ["match", ["get", "status"], "SUBMERGED", 9, "LIGHT_FLOOD", 8, 6],
            ],
          },
        });

        map.addLayer({
          id: "network-route-halo",
          type: "line",
          source: "network-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#0ea5e9", "line-width": 10, "line-opacity": 0.22 },
        });
        map.addLayer({
          id: "network-route-line",
          type: "line",
          source: "network-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#0369a1",
            "line-width": 4.5,
            "line-dasharray": [1.6, 1],
          },
        });
        map.addLayer({
          id: "network-route-ends",
          type: "circle",
          source: "network-route-ends",
          paint: {
            "circle-radius": 5,
            "circle-color": "#0369a1",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        map.addLayer({
          id: "network-nodes",
          type: "circle",
          source: "network-nodes",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2, 15, 4],
            "circle-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#0f172a",
          },
        });
        map.addLayer({
          id: "network-node-labels",
          type: "symbol",
          source: "network-nodes",
          minzoom: 13,
          layout: {
            "text-field": ["coalesce", ["get", "name"], ""],
            "text-size": 10,
            "text-offset": [0, 1.1],
            "text-anchor": "top",
            "text-allow-overlap": false,
            "text-ignore-placement": false,
          },
          paint: {
            "text-color": "#0f172a",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.6,
          },
        });

        map.on("click", "network-edges-live", (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          if (!map || !feature) return;
          const props = feature.properties as unknown as EdgeProperties;
          popupRef.current?.remove();
          popupRef.current = new Popup({ closeButton: true, maxWidth: "280px" })
            .setLngLat(event.lngLat)
            .setDOMContent(buildPopupContent(props))
            .addTo(map);
        });
        map.on("mouseenter", "network-edges-live", () => {
          if (map) map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "network-edges-live", () => {
          if (map) map.getCanvas().style.cursor = "";
        });

        setReady(true);
      });
    })();

    return () => {
      disposed = true;
      popupRef.current?.remove();
      popupRef.current = null;
      mapRef.current = null;
      map?.remove();
      setReady(false);
    };
  }, []);

  // --- Data ----------------------------------------------------------------
  // Debounced so dragging the clearance slider does not fire a request per tick.
  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetchNetworkState(clearanceCm, controller.signal)
        .then((state) => {
          if (cancelled) return;
          setNetwork(state);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(errorMessage(err));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [ready, clearanceCm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !network) return;

    const edgeSource = map.getSource("network-edges") as GeoJSONSource | undefined;
    const nodeSource = map.getSource("network-nodes") as GeoJSONSource | undefined;
    if (!edgeSource || !nodeSource) return;

    edgeSource.setData(network.edges);
    nodeSource.setData(network.nodes);

    // Frame the graph once. Later refetches must not yank the camera away from
    // wherever the operator has panned to.
    if (!fittedRef.current && network.nodes.features.length > 0) {
      fittedRef.current = true;
      const longitudes = network.nodes.features.map((node) => node.geometry.coordinates[0]);
      const latitudes = network.nodes.features.map((node) => node.geometry.coordinates[1]);
      map.fitBounds(
        [
          [Math.min(...longitudes), Math.min(...latitudes)],
          [Math.max(...longitudes), Math.max(...latitudes)],
        ],
        {
          // Leave room for the toolbars at the top and the controls at the right.
          padding: { top: 90, right: 320, bottom: 100, left: 90 },
          maxZoom: 14.5,
          duration: 0,
        },
      );
    }
  }, [network]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const routeSource = map.getSource("network-route") as GeoJSONSource | undefined;
    const endsSource = map.getSource("network-route-ends") as GeoJSONSource | undefined;
    if (!routeSource || !endsSource) return;

    if (!route || route.geometry.coordinates.length < 2) {
      routeSource.setData(EMPTY_COLLECTION);
      endsSource.setData(EMPTY_COLLECTION);
      return;
    }

    const coordinates = route.geometry.coordinates;
    routeSource.setData({
      type: "Feature",
      geometry: route.geometry,
      properties: {},
    });
    endsSource.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: coordinates[0] },
          properties: {},
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: coordinates[coordinates.length - 1] },
          properties: {},
        },
      ],
    });
  }, [route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const layerId of NETWORK_LAYER_IDS) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", showGraph ? "visible" : "none");
      }
    }
  }, [showGraph, ready]);

  const nodeOptions = useMemo(() => {
    const features = network?.nodes.features ?? [];
    return [...features].sort((a, b) => a.properties.node_id - b.properties.node_id);
  }, [network]);

  // The endpoints are derived, not stored: the first node of the seeded graph
  // is the Market Market end of C5 and the last is the Amang Rodriguez corner.
  // Deriving keeps a refetch from needing an effect to repair stale ids.
  const nodeIds = useMemo(() => nodeOptions.map((node) => node.properties.node_id), [nodeOptions]);
  const fallbackStart = nodeIds.length > 0 ? nodeIds[0] : null;
  const fallbackTarget = nodeIds.length > 0 ? nodeIds[nodeIds.length - 1] : null;
  const effectiveStart =
    startNodeId !== null && nodeIds.includes(startNodeId) ? startNodeId : fallbackStart;
  const effectiveTarget =
    targetNodeId !== null && nodeIds.includes(targetNodeId) ? targetNodeId : fallbackTarget;

  const summary = useMemo(
    () => (network ? summariseNetwork(network, route) : null),
    [network, route],
  );

  useEffect(() => {
    if (summary) onSummary(summary);
  }, [summary, onSummary]);

  // --- Actions -------------------------------------------------------------
  const handleClearanceChange = useCallback((value: number) => {
    setClearanceCm(value);
    // A route is only valid for the clearance it was computed with.
    setRoute(null);
  }, []);

  const handleSimulation = useCallback(async () => {
    if (busy) return;
    setBusy("simulation");
    setError(null);
    try {
      const result = await runRainfallSimulation(rainfallMmHr, clearanceCm);
      setNetwork(result);
      setRoute(null);
      onAction(
        rainfallMmHr === 0
          ? "Rainfall reset: simulated flood depths cleared."
          : `Simulated ${rainfallMmHr} mm/hr: ${result.affected_edges} edges recomputed, ${result.runoff_mm} mm runoff.`,
      );
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }, [busy, clearanceCm, onAction, rainfallMmHr]);

  const handleRoute = useCallback(async () => {
    if (busy || effectiveStart === null || effectiveTarget === null) return;
    if (effectiveTarget === effectiveStart) return;
    setBusy("route");
    setError(null);
    try {
      const result = await fetchRoute(effectiveStart, effectiveTarget, clearanceCm);
      setRoute(result);
      onAction(
        `Route ${effectiveStart} → ${effectiveTarget}: ${result.optimal_path_nodes.length} nodes, ${result.estimated_travel_time_minutes.toFixed(
          1,
        )} min.`,
      );
    } catch (err: unknown) {
      setRoute(null);
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }, [busy, clearanceCm, effectiveStart, effectiveTarget, onAction]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-slate-200" />

      {!network && !error ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/90 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-lg">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Loading road network…
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="absolute top-4 left-1/2 z-30 w-[min(420px,90%)] -translate-x-1/2 rounded-lg border border-rose-500/40 bg-rose-950/95 px-3 py-2 text-xs font-medium text-rose-100 shadow-lg">
          {error}
        </div>
      ) : null}

      {/* Simulation + routing controls */}
      <div className="absolute right-4 bottom-24 z-30 w-[272px] space-y-3 rounded-xl border border-slate-800 bg-slate-950/95 p-3 text-slate-100 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            Live Network Model
          </span>
          <span className="font-mono text-[10px] text-emerald-400">
            {loading
              ? "syncing…"
              : summary
                ? `${summary.nodeCount} nodes · ${summary.edgeCount} edges`
                : "…"}
          </span>
        </div>

        <label className="block space-y-1.5">
          <span className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <RouteIcon className="h-3.5 w-3.5 text-sky-400" />
              Vehicle clearance
            </span>
            <span className="font-mono text-sky-300">{clearanceCm} cm</span>
          </span>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={clearanceCm}
            onChange={(event) => handleClearanceChange(Number(event.target.value))}
            aria-label="Vehicle clearance in centimetres"
            className="w-full accent-sky-500"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <CloudRain className="h-3.5 w-3.5 text-sky-400" />
              Rainfall intensity
            </span>
            <span className="font-mono text-sky-300">{rainfallMmHr} mm/hr</span>
          </span>
          <input
            type="range"
            min={0}
            max={150}
            step={10}
            value={rainfallMmHr}
            onChange={(event) => setRainfallMmHr(Number(event.target.value))}
            aria-label="Rainfall intensity in millimetres per hour"
            className="w-full accent-sky-500"
          />
        </label>

        <button
          type="button"
          onClick={handleSimulation}
          disabled={busy !== null}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
            busy === "simulation"
              ? "cursor-wait bg-slate-700 text-slate-300"
              : "bg-sky-600 text-white hover:bg-sky-500",
          )}
        >
          <Waves className="h-3.5 w-3.5" />
          {busy === "simulation"
            ? "Running hydrology…"
            : rainfallMmHr === 0
              ? "Reset flood state"
              : `Apply ${rainfallMmHr} mm/hr`}
        </button>

        <div className="flex flex-wrap gap-1.5 border-t border-slate-800 pt-2.5">
          {(["PASSABLE", "LIGHT_FLOOD", "SUBMERGED"] as const).map((status) => (
            <span
              key={status}
              className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300"
            >
              <span
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
              {summary ? summary[STATUS_FILTER[status]] : "–"}
            </span>
          ))}
        </div>

        <div className="space-y-2 border-t border-slate-800 pt-2.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                From
              </span>
              <select
                value={effectiveStart ?? ""}
                onChange={(event) => setStartNodeId(Number(event.target.value))}
                aria-label="Route start node"
                className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-slate-100 focus:border-sky-500 focus:outline-none"
              >
                {nodeOptions.map((node) => (
                  <option key={node.properties.node_id} value={node.properties.node_id}>
                    {node.properties.node_id} · {node.properties.name ?? "Unnamed"}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                To
              </span>
              <select
                value={effectiveTarget ?? ""}
                onChange={(event) => setTargetNodeId(Number(event.target.value))}
                aria-label="Route target node"
                className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-slate-100 focus:border-sky-500 focus:outline-none"
              >
                {nodeOptions.map((node) => (
                  <option key={node.properties.node_id} value={node.properties.node_id}>
                    {node.properties.node_id} · {node.properties.name ?? "Unnamed"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={handleRoute}
            disabled={
              busy !== null ||
              effectiveTarget === null ||
              effectiveStart === null ||
              effectiveTarget === effectiveStart
            }
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition-colors hover:border-sky-500 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RouteIcon className="h-3.5 w-3.5" />
            {busy === "route" ? "Searching A*…" : "Find flood-safe route"}
          </button>
          {summary?.route ? (
            <p className="font-mono text-[10px] text-sky-300">
              {summary.route.nodes} nodes · {summary.route.minutes.toFixed(1)} min ·{" "}
              {summary.route.path[0]} → {summary.route.path[summary.route.path.length - 1]}
            </p>
          ) : (
            <p className="text-[10px] leading-snug text-slate-500">
              Pick two nodes to preview the time-dependent A* reroute for this clearance.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
