import { loadCache, saveCache } from "./offline";

// A public driver's own garage of vehicles, for clearance-aware routing — separate
// from the admin-managed rescue fleet (models.Vehicle / user.vehicle_id), which
// only applies to dispatched emergency drivers. Stored on-device only.

export type VehicleType = "motorcycle" | "sedan" | "suv" | "truck";

/** A single saved vehicle in the driver's garage. */
export type GarageVehicle = {
  id: string;
  name: string;
  type: VehicleType;
  clearanceCm: number;
};

/** The active vehicle's routing-relevant fields — the shape routing/home already use. */
export type MyVehicle = { type: VehicleType; clearanceCm: number };

export const DEFAULT_MY_VEHICLE: MyVehicle = { type: "sedan", clearanceCm: 28 };

const GARAGE_KEY = "garage_vehicles";
const ACTIVE_KEY = "active_vehicle_id";
/** Pre-garage single-vehicle setting; migrated into the garage once, then unused. */
const LEGACY_KEY = "my_vehicle";

/** The driver's saved vehicles, migrating the old single-vehicle setting the first time. */
export async function listGarageVehicles(): Promise<GarageVehicle[]> {
  const existing = await loadCache<GarageVehicle[]>(GARAGE_KEY);
  if (existing) return existing;

  const legacy = await loadCache<MyVehicle>(LEGACY_KEY);
  const seeded: GarageVehicle[] = legacy
    ? [{ id: "legacy", name: "My Vehicle", type: legacy.type, clearanceCm: legacy.clearanceCm }]
    : [];
  await saveCache(GARAGE_KEY, seeded);
  if (seeded.length > 0) await saveCache(ACTIVE_KEY, seeded[0].id);
  return seeded;
}

export async function saveGarageVehicles(vehicles: GarageVehicle[]): Promise<void> {
  await saveCache(GARAGE_KEY, vehicles);
}

export async function getActiveVehicleId(): Promise<string | null> {
  return (await loadCache<string>(ACTIVE_KEY)) ?? null;
}

export async function setActiveVehicleId(id: string): Promise<void> {
  await saveCache(ACTIVE_KEY, id);
}

/** The vehicle driving today's routing clearance: the active garage pick, else the
 * first saved vehicle, else a safe default. */
export async function loadMyVehicle(): Promise<MyVehicle> {
  const [vehicles, activeId] = await Promise.all([listGarageVehicles(), getActiveVehicleId()]);
  const active = vehicles.find((v) => v.id === activeId) ?? vehicles[0] ?? null;
  return active ? { type: active.type, clearanceCm: active.clearanceCm } : DEFAULT_MY_VEHICLE;
}
