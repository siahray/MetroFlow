import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/** Brand palette. Primary is slate-900, success emerald (AGENTS.md); use these, not raw hex. */
export const lightColors = {
  white: "#ffffff",
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
  blue600: "#2563eb",
  blue700: "#1d4ed8",
  sky600: "#0284c7",
  red50: "#fef2f2",
  red500: "#ef4444",
  red600: "#dc2626",
  red700: "#b91c1c",
  red800: "#991b1b",
  green600: "#16a34a",
  green700: "#15803d",
  amber100: "#fef3c7",
  amber800: "#92400e",
  /** Backgrounds for a chip/button that needs to read as "ink" regardless of theme. */
  inkBg: "#0f172a",
  /** Text on a permanently dark surface (turn card, ink button): light in every theme. */
  onInk: "#ffffff",
  inkMuted: "#cbd5e1",
} as const;

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
 */
export const stormColors = {
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
  sky600: "#38bdf8",
  red50: "#3a0a0a",
  red500: "#f87171",
  red600: "#f87171",
  red700: "#fca5a5",
  red800: "#fecaca",
  green600: "#4ade80",
  green700: "#86efac",
  amber100: "#3a2a06",
  amber800: "#fcd34d",
  inkBg: "#1d4ed8",
  onInk: "#ffffff",
  inkMuted: "#cbd5e1",
} as const;

/**
 * The type scale. Existing screens still carry their own StyleSheet numbers, so
 * this is the one place to retune sizes (BACKLOG U-5 does that pass); new or
 * edited styles should take a step from here instead of a new literal.
 */
export const fontSize = {
  micro: 10, // timestamps, badges
  caption: 11, // helper and meta text
  body: 12, // default body
  label: 13, // buttons, field labels
  subtitle: 15, // section headings
  title: 18, // screen titles
  display: 22, // numeric readouts
} as const;

/** Spacing on a 4pt grid, for the same reason: one place to retune. */
export const space = {
  hair: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export type ThemeColors = Record<keyof typeof lightColors, string>;
export type ThemeMode = "light" | "storm";

const STORAGE_KEY = "metroflow_theme_mode";

type ThemeState = {
  mode: ThemeMode;
  toggle: () => void;
  c: ThemeColors;
};

const ThemeContext = createContext<ThemeState>({
  mode: "light",
  toggle: () => {},
  c: lightColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "storm") setMode("storm");
      })
      .catch(() => {
        // Default to light; the toggle still works for this run.
      });
  }, []);

  const toggle = () => {
    setMode((prev) => {
      const next: ThemeMode = prev === "light" ? "storm" : "light";
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  };

  const value = useMemo<ThemeState>(
    () => ({ mode, toggle, c: mode === "storm" ? stormColors : lightColors }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Static light palette for screens not yet retrofitted for storm mode. */
export const colors = lightColors;
