import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Camera, MapView, MarkerView } from "@rnmapbox/maps";
import { MapPin } from "lucide-react-native";

import { MAPBOX_STYLE_DAY, MAPBOX_STYLE_NIGHT, mapboxReady } from "./mapbox";
import type { LatLng } from "./geo";
import { fontSize, space, useTheme } from "../theme";

/**
 * A small one-marker map for choosing a point by hand: long-press anywhere to
 * drop the pin. Deliberately not `RouteMap`, which carries the whole live
 * network, routing and camera machinery for a form that needs one point.
 */
export function PlacePickerMap({
  value,
  center,
  onPick,
}: {
  /** The chosen point, pinned on the map. */
  value: LatLng | null;
  /** Where to open the camera when nothing is chosen yet. */
  center: LatLng | null;
  onPick: (point: LatLng) => void;
}) {
  const { c, mode } = useTheme();
  const [ready, setReady] = useState(false);
  // Same token race as RouteMap: mounting before setAccessToken resolves shows
  // the native "Invalid token" banner (see navigation/mapbox.ts).
  useEffect(() => {
    let cancelled = false;
    void mapboxReady.then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const focus = value ?? center;

  return (
    <View
      style={{
        height: 170,
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: c.slate200,
        backgroundColor: c.slate100,
      }}
    >
      {ready && focus ? (
        <MapView
          style={StyleSheet.absoluteFill}
          styleURL={mode === "storm" ? MAPBOX_STYLE_NIGHT : MAPBOX_STYLE_DAY}
          scaleBarEnabled={false}
          onLongPress={(feature) => {
            const [longitude, latitude] = feature.geometry.coordinates;
            onPick({ latitude, longitude });
          }}
        >
          <Camera
            defaultSettings={{
              centerCoordinate: [focus.longitude, focus.latitude],
              zoomLevel: 14,
            }}
          />
          {value ? (
            <MarkerView coordinate={[value.longitude, value.latitude]}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: c.red600,
                  borderWidth: 2,
                  borderColor: c.white,
                }}
              >
                <MapPin size={13} color={c.white} />
              </View>
            </MarkerView>
          ) : null}
        </MapView>
      ) : null}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingVertical: space[6],
          paddingHorizontal: space[10],
          backgroundColor: "rgba(15,23,42,0.6)",
        }}
      >
        <Text
          style={{ fontSize: fontSize.caption, fontWeight: "600", color: c.white, textAlign: "center" }}
        >
          Long-press the map to drop a pin
        </Text>
      </View>
    </View>
  );
}
