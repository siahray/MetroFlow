import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/**
 * Driver preferences (P2-7 notification settings, P3-4 telemetry consent).
 * Persisted locally on the device; both default to on so existing behaviour
 * is unchanged until the driver opts out.
 */
export type DriverPrefs = {
  /** In-app banner when a verified hazard comes within the alert radius. */
  hazardAlerts: boolean;
  /** Periodic speed/position pings to the fleet telemetry endpoint. */
  telemetry: boolean;
  /** Follow the clock between light and storm themes (NFR-023); off = manual. */
  autoTheme: boolean;
};

const DEFAULTS: DriverPrefs = { hazardAlerts: true, telemetry: true, autoTheme: true };
const STORAGE_KEY = "metroflow_driver_prefs";

let cached: DriverPrefs | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export async function loadPrefs(): Promise<DriverPrefs> {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cached = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DriverPrefs>) } : DEFAULTS;
  } catch {
    cached = DEFAULTS;
  }
  return cached;
}

export async function savePrefs(next: DriverPrefs): Promise<void> {
  cached = next;
  notify();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Preference persistence is best-effort; the in-memory value still applies.
  }
}

/** Reactive prefs for components; re-renders when any screen saves. */
export function usePrefs(): DriverPrefs {
  const [prefs, setPrefs] = useState<DriverPrefs>(cached ?? DEFAULTS);

  useEffect(() => {
    let mounted = true;
    void loadPrefs().then((loaded) => {
      if (mounted) setPrefs(loaded);
    });
    const listener = () => {
      if (mounted && cached) setPrefs(cached);
    };
    listeners.add(listener);
    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  return prefs;
}
