import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polygon, Polyline, type Region } from "react-native-maps";

import type { HazardInfo, RoutePlan } from "../api";
import { polygonRing, routeCoordinates, type LatLng } from "./geo";

type MapHazard = Pick<HazardInfo, "hazard_id" | "name" | "obstruction_level" | "geometry">;

type Props = {
  route: RoutePlan | null;
  position: LatLng | null;
  destination: LatLng | null;
  destinationName: string | null;
  hazards: MapHazard[];
};

function blocking(level: string) {
  return ["LEVEL_2", "LEVEL_3", "IMPASSABLE"].includes(level.toUpperCase());
}

function regionFor(coordinates: LatLng[], fallback: LatLng | null): Region | null {
  if (coordinates.length === 0) {
    return fallback ? { ...fallback, latitudeDelta: 0.02, longitudeDelta: 0.02 } : null;
  }

  const latitudes = coordinates.map((point) => point.latitude);
  const longitudes = coordinates.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.012),
    longitudeDelta: Math.max((maxLon - minLon) * 1.5, 0.012),
  };
}

export function RouteMap({ route, position, destination, destinationName, hazards }: Props) {
  // A route determines the framing; between routes the map follows the driver.
  // Computing it during render avoids a state round-trip that would otherwise
  // animate the camera twice for every plan.
  const routeRegion = useMemo(
    () => (route ? regionFor(routeCoordinates(route), null) : null),
    [route],
  );
  const idleRegion = useMemo(() => regionFor([], position), [position]);
  const region = routeRegion ?? idleRegion;

  const line = route ? routeCoordinates(route) : [];

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        region={region ?? undefined}
        showsUserLocation={false}
        toolbarEnabled={false}
      >
        {line.length > 1 ? (
          <Polyline
            coordinates={line}
            strokeColor="#2563eb"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}

        {hazards.map((hazard) => {
          const ring = polygonRing(hazard.geometry);
          if (ring.length < 3) return null;
          const closed = blocking(hazard.obstruction_level);
          return (
            <Polygon
              key={hazard.hazard_id}
              coordinates={ring}
              fillColor={closed ? "rgba(220,38,38,0.25)" : "rgba(245,158,11,0.22)"}
              strokeColor={closed ? "#dc2626" : "#f59e0b"}
              strokeWidth={2}
            />
          );
        })}

        {position ? (
          <Marker
            coordinate={position}
            title="Your location"
            pinColor="#2563eb"
            tracksViewChanges={false}
          />
        ) : null}

        {destination ? (
          <Marker
            coordinate={destination}
            title={destinationName ?? "Destination"}
            pinColor="#dc2626"
            tracksViewChanges={false}
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden", backgroundColor: "#e2e8f0" },
});
