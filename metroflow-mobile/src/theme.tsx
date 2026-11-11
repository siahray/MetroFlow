import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { savePrefs, usePrefs } from "./prefs";

/** Brand palette. Primary is slate-900, success emerald (AGENTS.md); use these, not raw hex. */
export const lightColors = {
  white: "#ffffff",
  black: "#000000",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",
  blue50: "#eff6ff",
  blue100: "#dbeafe",
  blue200: "#bfdbfe",
  blue300: "#93c5fd",
  blue400: "#60a5fa",
  blue500: "#3b82f6",
  blue600: "#2563eb",
  blue700: "#1d4ed8",
  blue800: "#1e40af",
  blue900: "#1e3a8a",
  sky50: "#f0f9ff",
  sky200: "#bae6fd",
  sky400: "#38bdf8",
  sky600: "#0284c7",
  sky700: "#0369a1",
  cyan600: "#0891b2",
  red50: "#fef2f2",
  red100: "#fee2e2",
  red200: "#fecaca",
  red300: "#fca5a5",
  red400: "#f87171",
  red500: "#ef4444",
  red600: "#dc2626",
  red700: "#b91c1c",
  red800: "#991b1b",
  rose600: "#e11d48",
  green50: "#f0fdf4",
  green200: "#bbf7d0",
  green300: "#86efac",
  green400: "#4ade80",
  green600: "#16a34a",
  green700: "#15803d",
  green800: "#166534",
  emerald50: "#ecfdf5",
  emerald100: "#d1fae5",
  emerald200: "#a7f3d0",
  emerald600: "#059669",
  emerald700: "#047857",
  emerald800: "#065f46",
  emerald950: "#052e1b",
  amber100: "#fef3c7",
  amber200: "#fde68a",
  amber300: "#fcd34d",
  amber500: "#f59e0b",
  amber600: "#d97706",
  amber700: "#b45309",
  amber800: "#92400e",
  orange50: "#fff7ed",
  orange200: "#fed7aa",
  orange800: "#9a3412",
  /** Warning/info banner surface; dark counterpart lives in stormColors. */
  amberSurface: "#fffbeb",
  /** Off-white card/surface tints used on the report form. */
  surface: "#fafbfc",
  surfaceAlt: "#f4f7fa",
  /** Backgrounds for a chip/button that needs to read as "ink" regardless of theme. */
  inkBg: "#0f172a",
  /** Text on a permanently dark surface (turn card, ink button): light in every theme. */
  onInk: "#ffffff",
  inkMuted: "#cbd5e1",
} as const;

export type ThemeColors = { [K in keyof typeof lightColors]: string };

/**
 * Night/storm palette for the driver app (NFR-023): a low-glare theme for
 * navigating after dark or in heavy rain.
 *
 * This is not a blanket inversion of `lightColors` -- several tokens (notably
 * `slate900`) play both a text role (dark text on a light screen) and a
 * background role (a dark button/chip) in the same screens, and inverting
 * both the same way would make one of them unreadable. The ramp below keeps
 * each named shade close to its *contrast role*: very light shades (white,
 * slate50-300) become the new dark backgrounds/borders, very dark shades
 * (slate700-900) become light text, and the already-mid grays (slate400-600)
 * are left close to where they were -- they read fine on a dark background
 * too, often better than they did on white. `inkBg` is the one dedicated
 * background token so a chip/button does not go dark-on-dark; `onInk` and
 * `inkMuted` are its text pair and stay light in every theme, because the
 * turn-by-turn card keeps a dark background in both.
 *
 * Only the shades the storm-mode screens actually render are overridden;
 * everything else falls back to its light value when the palettes merge.
 */
export const stormColors: Partial<ThemeColors> = {
  white: "#0b1220",
  slate50: "#111c2e",
  slate100: "#1e293b",
  slate200: "#334155",
  slate300: "#475569",
  slate400: "#94a3b8",
  slate500: "#cbd5e1",
  slate600: "#e2e8f0",
  slate700: "#f1f5f9",
  slate800: "#f8fafc",
  slate900: "#f8fafc",
  blue50: "#0c2338",
  blue100: "#123450",
  blue600: "#60a5fa",
  blue700: "#93c5fd",
  blue900: "#bfdbfe",
  sky50: "#082f49",
  sky200: "#075985",
  sky600: "#38bdf8",
  sky700: "#7dd3fc",
  red50: "#3a0a0a",
  red500: "#f87171",
  red600: "#f87171",
  red700: "#fca5a5",
  red800: "#fecaca",
  green600: "#4ade80",
  green700: "#86efac",
  amber100: "#3a2a06",
  amber800: "#fcd34d",
  amberSurface: "#3a2a06",
  surface: "#111c2e",
  surfaceAlt: "#0a1220",
  green50: "#052e1b",
  inkBg: "#1d4ed8",
  onInk: "#ffffff",
  inkMuted: "#cbd5e1",
};

/**
 * The type scale (BACKLOG U-5). Every `fontSize:` literal in the app snaps
 * to one of these steps; retune here rather than reintroducing literals.
 */
export const fontSize = {
  nano: 8, // unit suffixes inside badges
  tiny: 9, // micro labels, stat captions
  micro: 10, // timestamps, badges
  caption: 11, // helper and meta text
  body: 12, // default body
  label: 13, // buttons, field labels
  lead: 14, // emphasized body
  subtitle: 15, // section headings
  heading: 16, // card titles
  title: 18, // screen titles
  display: 22, // numeric readouts
  jumbo: 24, // hero numerals
  hero: 28, // wordmark, avatar initials
} as const;

/**
 * Spacing ramp in px, indexed by value (`space[12]`). The keys are the values
 * the screens actually use on a 4pt-ish rhythm; add a step here instead of
 * reintroducing a literal.
 */
export const space = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  10: 10,
  12: 12,
  13: 13,
  14: 14,
  15: 15,
  16: 16,
  18: 18,
  20: 20,
  22: 22,
  24: 24,
  28: 28,
  32: 32,
  60: 60,
} as const;

export type ThemeMode = "light" | "storm";

const STORAGE_KEY = "metroflow_theme_mode";

type ThemeState = {
  mode: ThemeMode;
  toggle: () => void;
  c: ThemeColors;
};

/** Daytime is 06:00–17:59 on the device clock; storm takes over after dark. */
export function modeForHour(hour: number): ThemeMode {
  return hour >= 6 && hour < 18 ? "light" : "storm";
}

const ThemeContext = createContext<ThemeState>({
  mode: "light",
  toggle: () => {},
  c: lightColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const prefs = usePrefs();
  const [manualMode, setManualMode] = useState<ThemeMode>("light");
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "storm") setManualMode("storm");
      })
      .catch(() => {
        // Default to light; the toggle still works for this run.
      });
  }, []);

  // Ticks the clock so the auto schedule flips at 6am/6pm without a reload.
  // Runs cheaply even when auto is off; `value` is memoized on `mode`, so the
  // subtree only re-renders when the theme actually changes.
  useEffect(() => {
    const tick = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const mode = prefs.autoTheme ? modeForHour(hour) : manualMode;

  const value = useMemo<ThemeState>(
    () => ({
      mode,
      // Toggling is a manual override: flip whatever is on screen and turn
      // the time schedule off, so the sun/moon buttons always visibly work.
      toggle: () => {
        const next: ThemeMode = mode === "light" ? "storm" : "light";
        if (prefs.autoTheme) void savePrefs({ ...prefs, autoTheme: false });
        setManualMode(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
      c: mode === "storm" ? { ...lightColors, ...stormColors } : lightColors,
    }),
    [mode, prefs],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
