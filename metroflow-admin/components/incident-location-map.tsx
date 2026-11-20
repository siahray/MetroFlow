"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import { LocateFixed } from "lucide-react";
import { useEffect, useRef } from "react";

import { MAP_COLORS } from "@/lib/network";

/**
 * A single-marker map for one incident's own coordinates -- not the live
 * network map (that needs auth, polling and a much heavier bundle for a
 * detail panel that only ever shows one point). Same keyless Carto basemap
 * and worker-URL fix `network-map.tsx` already uses, so no new asset or env
 * var is needed.
 */
const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

type Props = {
  latitude: number;
  longitude: number;
  /** Defaults to the alert red used for the incident itself. */
  markerColor?: string;
};

export function IncidentLocationMap({
  latitude,
  longitude,
  markerColor = MAP_COLORS.alert,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);

  // One map instance for the component's life; only the marker moves if the
  // coordinates change (e.g. the queue advances to a different incident
  // without this panel unmounting).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let map: MapLibreMap | null = null;

    void (async () => {
      const { Map, Marker, NavigationControl, setWorkerUrl } = await import("maplibre-gl");
      if (disposed) return;

      setWorkerUrl("/maplibre-gl-worker.mjs");

      map = new Map({
        container,
        style: BASEMAP_STYLE,
        center: [longitude, latitude],
        zoom: 15,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
      markerRef.current = new Marker({ color: markerColor })
        .setLngLat([longitude, latitude])
        .addTo(map);
    })();

    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Intentionally only on mount: the effect below handles a coordinate
    // change without tearing down and rebuilding the whole map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    markerRef.current?.setLngLat([longitude, latitude]);
    mapRef.current?.setCenter([longitude, latitude]);
  }, [latitude, longitude]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {/* The panel is read-only, so a stray pan/zoom is easy to undo in one click. */}
      <button
        type="button"
        onClick={() => mapRef.current?.easeTo({ center: [longitude, latitude], zoom: 15 })}
        aria-label="Recenter on the pin"
        title="Recenter on the pin"
        className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm hover:bg-white"
      >
        <LocateFixed className="h-3 w-3" /> Recenter
      </button>
    </div>
  );
}
