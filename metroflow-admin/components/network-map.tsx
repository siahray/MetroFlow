"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { CloudRain, Gauge, Route as RouteIcon, ShieldAlert, Truck, Waves } from "lucide-react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  Popup as MapLibrePopup,
} from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { SOSRequest, Vehicle } from "@/lib/dispatch";
import { subscribeToHazards, subscribeToSOS, subscribeToVehicles } from "@/lib/live-stream";
import type { HazardZone } from "@/lib/hazards";
import {
  fetchNetworkState,
  fetchRoute,
  formatDepthCm,
  MAP_COLORS,
  runRainfallSimulation,
  STATUS_COLORS,
  STATUS_LABELS,
  summariseNetwork,
  type EdgeProperties,
  type NetworkState,
  type NetworkSummary,
  type RouteResult,
} from "@/lib/network";
import { listSOS } from "@/lib/sos-live";
import { listSensors, type Sensor } from "@/lib/sensors";
import { listVehiclesLive } from "@/lib/vehicles-live";

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

/**
 * Live overlays (FSD-FR-075, FSD-FR-076). Each toggle owns the layers listed
 * here so a layer can never be left visible without its data source.
 */
const OVERLAY_LAYERS = {
  hazards: ["map-hazard-fill", "map-hazard-outline", "map-hazard-edges", "map-hazard-labels"],
  fleet: ["map-fleet-points", "map-fleet-labels"],
  sos: ["map-sos-points", "map-sos-labels"],
  sensors: ["map-sensors-points", "map-sensors-labels"],
} as const;

type OverlayKey = keyof typeof OVERLAY_LAYERS;

const OVERLAY_LABELS: Record<OverlayKey, string> = {
  hazards: "Verified hazards",
  fleet: "Fleet units",
  sos: "SOS signals",
  sensors: "Sensors",
};

/** Same colour language the driver app uses for obstruction levels. */
function hazardColor(level: string): string {
  switch (level.toUpperCase()) {
    case "IMPASSABLE":
      return MAP_COLORS.hazardImpassable;
    case "LEVEL_3":
      return MAP_COLORS.hazardSevere;
    case "LEVEL_2":
      return MAP_COLORS.alert;
    default:
      return MAP_COLORS.warning;
  }
}

type HazardFeature = {
  type: "Feature";
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "LineString"; coordinates: [number, number][] };
  properties: { name: string; level: string; color: string };
};

function hazardCollection(hazards: HazardZone[], edges: NetworkState | null) {
  const edgeLines = new Map<number, [number, number][]>();
  for (const edge of edges?.edges.features ?? []) {
    edgeLines.set(edge.properties.edge_id, edge.geometry.coordinates);
  }

  const features: HazardFeature[] = [];
  for (const hazard of hazards) {
    if (hazard.active === false) continue;
    const properties = {
      name: hazard.name,
      level: hazard.obstruction_level,
      color: hazardColor(hazard.obstruction_level),
    };
    if (hazard.geometry?.coordinates?.length) {
      features.push({
        type: "Feature",
        geometry: hazard.geometry as { type: "Polygon"; coordinates: number[][][] },
        properties,
      });
      continue;
    }
    // A hazard authored by edge id has no polygon; highlighting the edge it
    // closes is what keeps the map honest about where the closure is.
    const line = hazard.edge_id === null ? undefined : edgeLines.get(hazard.edge_id);
    if (!line) continue;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: line },
      properties,
    });
  }

  return { type: "FeatureCollection" as const, features };
}

function fleetCollection(vehicles: Vehicle[]) {
  return {
    type: "FeatureCollection" as const,
    features: vehicles.flatMap((vehicle) => {
      const { current_location_lon: lon, current_location_lat: lat } = vehicle;
      if (lon === null || lat === null) return [];
      return [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [lon, lat] },
          properties: {
            label: vehicle.call_sign,
            status: vehicle.status,
            speed: vehicle.speed_kmh === null ? "—" : `${Math.round(vehicle.speed_kmh)} km/h`,
          },
        },
      ];
    }),
  };
}

function sosCollection(requests: SOSRequest[]) {
  return {
    type: "FeatureCollection" as const,
    features: requests
      .filter((request) => request.status.toUpperCase() !== "RESOLVED")
      .map((request) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [request.longitude, request.latitude],
        },
        properties: {
          label: `SOS #${request.sos_id}`,
          note: request.note ?? "",
        },
      })),
  };
}

function sensorCollection(sensors: Sensor[]) {
  return {
    type: "FeatureCollection" as const,
    features: sensors.flatMap((sensor) => {
      if (sensor.latitude === null || sensor.longitude === null) return [];
      return [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [sensor.longitude, sensor.latitude] },
          properties: {
            label: sensor.sensor_id,
            color: !sensor.active
              ? MAP_COLORS.sensorOff
              : sensor.last_flagged
                ? MAP_COLORS.warning
                : MAP_COLORS.accent,
          },
        },
      ];
    }),
  };
}

const STATUS_FILTER: Record<
  "PASSABLE" | "LIGHT_FLOOD" | "SUBMERGED",
  "passable" | "lightFlood" | "submerged"
> = {
  PASSABLE: "passable",
  LIGHT_FLOOD: "lightFlood",
  SUBMERGED: "submerged",
};

export type DrawnGeometry =
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "LineString"; coordinates: [number, number][] };

type NetworkMapProps = {
  /** Layer checkbox in the editor: hide the graph, keep the basemap. */
  showGraph: boolean;
  /** Toast sink, so simulation and routing results land in the same place. */
  onAction: (message: string) => void;
  /** Called whenever the rendered verdicts or the active route change. */
  onSummary: (summary: NetworkSummary) => void;
  /**
   * Hazard-shape drawing (FSD-FR-082, FSD-FR-083): "polygon" collects a flood
   * area, "line" a closure line. `null` (the default) leaves ordinary map
   * clicks alone.
   */
  drawMode?: "polygon" | "line" | null;
  /** Fired with the finished shape on "Finish", or `null` on "Cancel". */
  onDrawComplete?: (geometry: DrawnGeometry | null) => void;
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
  wrapper.style.color = MAP_COLORS.ink;

  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.style.marginBottom = "2px";
  title.textContent = `${props.start_name ?? `Node ${props.start_node_id}`} → ${
    props.end_name ?? `Node ${props.end_node_id}`
  }`;

  const status = document.createElement("div");
  status.style.fontWeight = "700";
  status.style.color = STATUS_COLORS[props.status] ?? MAP_COLORS.ink;
  status.textContent = `${STATUS_LABELS[props.status] ?? props.status} · ${formatDepthCm(
    props.water_depth_cm,
  )}`;

  const meta = document.createElement("div");
  meta.style.color = MAP_COLORS.inkMuted;
  meta.textContent = `Edge #${props.edge_id} · ${Math.round(props.distance_m)} m · ${Math.round(
    props.avg_speed_kmh,
  )} km/h`;

  wrapper.append(title, status, meta);
  return wrapper;
}

export function NetworkMap({
  showGraph,
  onAction,
  onSummary,
  drawMode = null,
  onDrawComplete,
}: NetworkMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<MapLibrePopup | null>(null);
  const fittedRef = useRef(false);
  const drawModeRef = useRef(drawMode);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);

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
  const [hazards, setHazards] = useState<HazardZone[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [sosRequests, setSosRequests] = useState<SOSRequest[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [overlays, setOverlays] = useState<Record<OverlayKey, boolean>>({
    hazards: true,
    fleet: true,
    sos: true,
    sensors: true,
  });

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
        map.addSource("map-hazards", { type: "geojson", data: EMPTY_COLLECTION });
        map.addSource("map-fleet", { type: "geojson", data: EMPTY_COLLECTION });
        map.addSource("map-sos", { type: "geojson", data: EMPTY_COLLECTION });
        map.addSource("map-sensors", { type: "geojson", data: EMPTY_COLLECTION });

        map.addLayer({
          id: "network-edges-casing",
          type: "line",
          source: "network-edges",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": MAP_COLORS.casing,
            "line-width": 6.5,
            "line-opacity": 0.9,
          },
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
          paint: {
            "line-color": MAP_COLORS.accent,
            "line-width": 10,
            "line-opacity": 0.22,
          },
        });
        map.addLayer({
          id: "network-route-line",
          type: "line",
          source: "network-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": MAP_COLORS.route,
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
            "circle-color": MAP_COLORS.route,
            "circle-stroke-width": 2,
            "circle-stroke-color": MAP_COLORS.paper,
          },
        });

        map.addLayer({
          id: "map-hazard-fill",
          type: "fill",
          source: "map-hazards",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.28,
          },
        });
        map.addLayer({
          id: "map-hazard-outline",
          type: "line",
          source: "map-hazards",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: {
            "line-color": ["get", "color"],
            "line-width": 1.6,
            "line-opacity": 0.9,
          },
        });
        map.addLayer({
          id: "map-hazard-edges",
          type: "line",
          source: "map-hazards",
          filter: ["==", ["geometry-type"], "LineString"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": 7,
            "line-opacity": 0.85,
          },
        });
        map.addLayer({
          id: "map-hazard-labels",
          type: "symbol",
          source: "map-hazards",
          minzoom: 13,
          layout: {
            "text-field": ["get", "name"],
            "text-size": 10,
            "text-anchor": "center",
            "text-max-width": 9,
          },
          paint: {
            "text-color": MAP_COLORS.hazardImpassable,
            "text-halo-color": MAP_COLORS.paper,
            "text-halo-width": 1.8,
          },
        });

        map.addLayer({
          id: "network-nodes",
          type: "circle",
          source: "network-nodes",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2, 15, 4],
            "circle-color": MAP_COLORS.paper,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": MAP_COLORS.ink,
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
            "text-color": MAP_COLORS.ink,
            "text-halo-color": MAP_COLORS.paper,
            "text-halo-width": 1.6,
          },
        });

        map.addLayer({
          id: "map-fleet-points",
          type: "circle",
          source: "map-fleet",
          paint: {
            "circle-radius": 6,
            "circle-color": MAP_COLORS.unit,
            "circle-stroke-width": 2,
            "circle-stroke-color": MAP_COLORS.paper,
          },
        });
        map.addLayer({
          id: "map-fleet-labels",
          type: "symbol",
          source: "map-fleet",
          minzoom: 12,
          layout: {
            "text-field": ["get", "label"],
            "text-size": 10,
            "text-offset": [0, 1.3],
            "text-anchor": "top",
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": MAP_COLORS.unitLabel,
            "text-halo-color": MAP_COLORS.paper,
            "text-halo-width": 1.6,
          },
        });

        map.addLayer({
          id: "map-sos-points",
          type: "circle",
          source: "map-sos",
          paint: {
            "circle-radius": 8,
            "circle-color": MAP_COLORS.alert,
            "circle-stroke-width": 2.5,
            "circle-stroke-color": MAP_COLORS.paper,
          },
        });
        map.addLayer({
          id: "map-sos-labels",
          type: "symbol",
          source: "map-sos",
          minzoom: 12,
          layout: {
            "text-field": ["get", "label"],
            "text-size": 10,
            "text-offset": [0, 1.4],
            "text-anchor": "top",
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": MAP_COLORS.sosLabel,
            "text-halo-color": MAP_COLORS.paper,
            "text-halo-width": 1.6,
          },
        });

        map.addLayer({
          id: "map-sensors-points",
          type: "circle",
          source: "map-sensors",
          paint: {
            "circle-radius": 6,
            "circle-color": ["get", "color"],
            "circle-stroke-width": 2,
            "circle-stroke-color": MAP_COLORS.paper,
          },
        });
        map.addLayer({
          id: "map-sensors-labels",
          type: "symbol",
          source: "map-sensors",
          minzoom: 13,
          layout: {
            "text-field": ["get", "label"],
            "text-size": 10,
            "text-offset": [0, 1.3],
            "text-anchor": "top",
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": MAP_COLORS.sensorLabel,
            "text-halo-color": MAP_COLORS.paper,
            "text-halo-width": 1.6,
          },
        });

        map.addSource("draw-draft", { type: "geojson", data: EMPTY_COLLECTION });
        map.addLayer({
          id: "draw-draft-line",
          type: "line",
          source: "draw-draft",
          filter: ["==", ["geometry-type"], "LineString"],
          paint: {
            "line-color": MAP_COLORS.warning,
            "line-width": 2.5,
            "line-dasharray": [2, 1.5],
          },
        });
        map.addLayer({
          id: "draw-draft-points",
          type: "circle",
          source: "draw-draft",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 5,
            "circle-color": MAP_COLORS.warning,
            "circle-stroke-width": 2,
            "circle-stroke-color": MAP_COLORS.paper,
          },
        });

        map.on("click", (event: MapLayerMouseEvent) => {
          if (!drawModeRef.current) return;
          setDrawPoints((current) => [...current, [event.lngLat.lng, event.lngLat.lat]]);
        });

        map.on("click", "network-edges-live", (event: MapLayerMouseEvent) => {
          if (drawModeRef.current) return;
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

  // --- Hazard-shape drawing (FSD-FR-082, FSD-FR-083) -----------------------
  // Adjusting state during render on a prop change (not in an effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  if (drawModeRef.current !== drawMode) {
    drawModeRef.current = drawMode;
    setDrawPoints([]);
  }

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = drawMode ? "crosshair" : "";
  }, [drawMode]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("draw-draft") as GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: [
        ...(drawPoints.length >= 2
          ? [
              {
                type: "Feature" as const,
                geometry: { type: "LineString" as const, coordinates: drawPoints },
                properties: {},
              },
            ]
          : []),
        ...drawPoints.map((coordinates) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates },
          properties: {},
        })),
      ],
    });
  }, [drawPoints, ready]);

  const minDrawPoints = drawMode === "polygon" ? 3 : 2;

  const undoDrawPoint = useCallback(() => {
    setDrawPoints((current) => current.slice(0, -1));
  }, []);

  const cancelDraw = useCallback(() => {
    setDrawPoints([]);
    onDrawComplete?.(null);
  }, [onDrawComplete]);

  const finishDraw = useCallback(() => {
    if (drawPoints.length < minDrawPoints) return;
    const geometry: DrawnGeometry =
      drawMode === "polygon"
        ? { type: "Polygon", coordinates: [[...drawPoints, drawPoints[0]]] }
        : { type: "LineString", coordinates: drawPoints };
    setDrawPoints([]);
    onDrawComplete?.(geometry);
  }, [drawMode, drawPoints, minDrawPoints, onDrawComplete]);

  // --- Live overlays (FSD-FR-075, FSD-FR-076) ------------------------------
  // One stream per layer, each pushing the whole list, so the map never shows a
  // fleet of one after a single unit reports its position.
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();

    void subscribeToHazards(setHazards, controller.signal);
    void subscribeToVehicles(setVehicles, controller.signal);
    void subscribeToSOS(setSosRequests, controller.signal);

    return () => controller.abort();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const load = async () => {
      const [fleet, signals] = await Promise.all([
        listVehiclesLive().catch(() => [] as Vehicle[]),
        listSOS().catch(() => [] as SOSRequest[]),
      ]);
      if (cancelled) return;
      setVehicles(fleet);
      setSosRequests(signals);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  // Sensors have no live stream (FSD-FR-090, FR-091): a breach only changes
  // when a gateway posts a new reading, so a short poll is enough to keep the
  // map layer current.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const load = () => void listSensors(false).then((rows) => !cancelled && setSensors(rows));
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const hazardSource = map.getSource("map-hazards") as GeoJSONSource | undefined;
    const fleetSource = map.getSource("map-fleet") as GeoJSONSource | undefined;
    const sosSource = map.getSource("map-sos") as GeoJSONSource | undefined;
    const sensorSource = map.getSource("map-sensors") as GeoJSONSource | undefined;
    hazardSource?.setData(hazardCollection(hazards, network));
    fleetSource?.setData(fleetCollection(vehicles));
    sosSource?.setData(sosCollection(sosRequests));
    sensorSource?.setData(sensorCollection(sensors));
  }, [hazards, vehicles, sosRequests, sensors, network, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [key, layerIds] of Object.entries(OVERLAY_LAYERS) as [
      OverlayKey,
      readonly string[],
    ][]) {
      for (const layerId of layerIds) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", overlays[key] ? "visible" : "none");
        }
      }
    }
  }, [overlays, ready]);

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

      {drawMode ? (
        <div className="absolute top-4 left-1/2 z-30 w-[min(360px,90%)] -translate-x-1/2 space-y-2 rounded-xl border border-amber-500/40 bg-slate-950/95 p-3 text-slate-100 shadow-xl backdrop-blur">
          <p className="text-xs font-semibold text-amber-300">
            Click the map to place{" "}
            {drawMode === "polygon" ? "the flood area's" : "the closure line's"} points (
            {drawPoints.length} placed, {minDrawPoints} minimum).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={undoDrawPoint}
              disabled={drawPoints.length === 0}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Undo point
            </button>
            <button
              type="button"
              onClick={finishDraw}
              disabled={drawPoints.length < minDrawPoints}
              className="flex-1 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Finish shape
            </button>
            <button
              type="button"
              onClick={cancelDraw}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:border-rose-500 hover:text-rose-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Live overlay toggles (FSD-FR-075, FSD-FR-076) */}
      <div className="absolute top-4 left-4 z-30 w-[186px] space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/95 p-2.5 text-slate-100 shadow-xl backdrop-blur">
        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
          Live overlays
        </span>
        {(
          [
            ["hazards", ShieldAlert, hazards.length],
            ["fleet", Truck, vehicles.length],
            ["sos", Waves, sosRequests.length],
            ["sensors", Gauge, sensors.length],
          ] as [OverlayKey, typeof ShieldAlert, number][]
        ).map(([key, Icon, count]) => (
          <label
            key={key}
            className="flex cursor-pointer items-center justify-between gap-2 text-[11px] font-semibold text-slate-300"
          >
            <span className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={overlays[key]}
                onChange={(event) =>
                  setOverlays((current) => ({ ...current, [key]: event.target.checked }))
                }
                className="accent-sky-500"
              />
              <Icon className="h-3.5 w-3.5 text-slate-400" />
              {OVERLAY_LABELS[key]}
            </span>
            <span className="font-mono text-[10px] text-slate-400">{count}</span>
          </label>
        ))}
      </div>

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
