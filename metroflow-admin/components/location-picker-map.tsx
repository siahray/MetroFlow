"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { MAP_COLORS } from "@/lib/network";

const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

type Props = {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
};

/**
 * A click-or-drag pin picker for the call-in dialog (FSD-FR-087), so a
 * dispatcher can set a caller's location on the map instead of typing raw
 * coordinates. Single draggable marker over the same keyless Carto basemap
 * `incident-location-map.tsx` uses; not the live network map, which needs
 * auth and polling this form has no use for.
 */
export function LocationPickerMap({ latitude, longitude, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  // The click/drag handlers close over the latest callback without
  // rebuilding the map, which would otherwise reset the view on every pin move.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

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
        zoom: 14,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

      const marker = new Marker({ color: MAP_COLORS.alert, draggable: true })
        .setLngLat([longitude, latitude])
        .addTo(map);
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLngLat();
        onChangeRef.current(lat, lng);
      });
      markerRef.current = marker;

      map.on("click", (event) => {
        const { lat, lng } = event.lngLat;
        marker.setLngLat([lng, lat]);
        onChangeRef.current(lat, lng);
      });
    })();

    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Intentionally only on mount: the effect below moves the pin without
    // tearing down and rebuilding the whole map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A search result sets the coordinates from outside the map; the pin and
  // view follow without re-running the click/drag setup above.
  useEffect(() => {
    markerRef.current?.setLngLat([longitude, latitude]);
    mapRef.current?.easeTo({ center: [longitude, latitude], zoom: 15 });
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Drag the pin or click the map to set the caller's location"
      className="h-48 w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
    />
  );
}
