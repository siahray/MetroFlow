import { useEffect, useRef, useState, type ComponentRef, type RefObject } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, MapView, MarkerView } from "@rnmapbox/maps";
import { MapPin, Maximize2, X } from "lucide-react-native";

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
  const [fullView, setFullView] = useState(false);
  const miniCameraRef = useRef<ComponentRef<typeof Camera>>(null);
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

  // Keep the mini map centered on the chosen pin after a pick (including one
  // made in the full-screen view) so returning shows the pinned location.
  useEffect(() => {
    if (!focus || fullView) return;
    miniCameraRef.current?.setCamera({
      centerCoordinate: [focus.longitude, focus.latitude],
      zoomLevel: 14,
      animationDuration: 0,
    });
  }, [focus, fullView, ready]);

  function handlePick(point: LatLng) {
    onPick(point);
  }

  const mapContent = (height: number | "100%", zoom: number, cameraRef?: RefObject<ComponentRef<typeof Camera> | null>) =>
    ready && focus ? (
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={mode === "storm" ? MAPBOX_STYLE_NIGHT : MAPBOX_STYLE_DAY}
        scaleBarEnabled={false}
        onLongPress={(feature) => {
          const [longitude, latitude] = feature.geometry.coordinates;
          handlePick({ latitude, longitude });
        }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [focus.longitude, focus.latitude],
            zoomLevel: zoom,
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
    ) : null;

  return (
    <>
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
        {mapContent(170, 14, miniCameraRef)}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open full map view"
          onPress={() => setFullView(true)}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 32,
            height: 32,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.white,
            borderWidth: 1,
            borderColor: c.slate200,
          }}
        >
          <Maximize2 size={16} color={c.slate700} />
        </TouchableOpacity>
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

      <Modal visible={fullView} animationType="slide" onRequestClose={() => setFullView(false)}>
        <View style={{ flex: 1, backgroundColor: c.black }}>
          {mapContent("100%", value ? 15 : 14)}
          <SafeAreaView
            pointerEvents="box-none"
            edges={["top", "right"]}
            style={{ position: "absolute", top: 0, right: 0 }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close full map view"
              onPress={() => setFullView(false)}
              style={{
                marginTop: 8,
                marginRight: 12,
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: c.white,
                borderWidth: 1,
                borderColor: c.slate200,
              }}
            >
              <X size={20} color={c.slate800} />
            </TouchableOpacity>
          </SafeAreaView>
          <SafeAreaView
            pointerEvents="none"
            edges={["bottom"]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
          >
            <View
              style={{
                margin: 12,
                paddingVertical: space[8],
                paddingHorizontal: space[12],
                borderRadius: 10,
                backgroundColor: "rgba(15,23,42,0.75)",
              }}
            >
              <Text
                style={{ fontSize: fontSize.caption, fontWeight: "600", color: c.white, textAlign: "center" }}
              >
                Long-press the map to drop a pin
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
