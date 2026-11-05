import { loadCache, saveCache } from "./offline";

// A public driver's own vehicle, for clearance-aware routing — separate from
// the admin-managed rescue fleet (models.Vehicle / user.vehicle_id), which
// only applies to dispatched emergency drivers. Stored on-device only.

export type VehicleType = "motorcycle" | "sedan" | "suv" | "truck";

export type MyVehicle = {
  type: VehicleType;
  clearanceCm: number;
};

export const DEFAULT_MY_VEHICLE: MyVehicle = { type: "sedan", clearanceCm: 28 };

const KEY = "my_vehicle";

export async function loadMyVehicle(): Promise<MyVehicle> {
  return (await loadCache<MyVehicle>(KEY)) ?? DEFAULT_MY_VEHICLE;
}

export async function saveMyVehicle(vehicle: MyVehicle): Promise<void> {
  await saveCache(KEY, vehicle);
}
