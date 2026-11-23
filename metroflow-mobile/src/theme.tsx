import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { savePrefs, usePrefs } from "./prefs";

/**
 * Brand palette. Primary is slate-900, success emerald (AGENTS.md); use these, not raw hex.
 * Grouped by family, and each shade names the UI that consumes it so a token can
 * be retuned without hunting through every screen. "Reserved" means no callers yet.
 */
export const lightColors = {
  // ── Neutrals: surfaces, borders, and the body/title text ramp ─────────────
  white: "#ffffff", // card, input and chip surfaces; icon strokes on dark/ink fills
  black: "#000000", // shadowColor on elevated cards; PlacePickerMap canvas
  slate50: "#f8fafc", // page background (login, offline); route notice cards
  slate100: "#f1f5f9", // subtle icon tiles, header dividers, neutral status chips
  slate200: "#e2e8f0", // default card/input/chip borders and list separators
  slate300: "#cbd5e1", // tertiary text, disabled borders, empty-state icon
  slate400: "#94a3b8", // placeholder/muted text, inactive chip labels, tab tint
  slate500: "#64748b", // secondary and helper t ext beneath titles/labels
  slate600: "#475569", // form labels and route alert body copy
  slate700: "#334155", // field labels, section subtitles, offline headings
  slate800: "#1e293b", // emphasized captions, map control icons, auth accents
  slate900: "#0f172a", // screen titles, hero wordmark, primary buttons (text + bg role)

  // ── Blue: primary actions, info panels and selection ──────────────────────
  blue50: "#eff6ff", // info card fills: SOS update modal, route alerts, login CTA
  blue100: "#dbeafe", // live-network badge, soft card tints and borders
  blue200: "#bfdbfe", // login CTA border, report form focus border
  blue300: "#93c5fd", // storm-mode selected chip borders, profile card outlines
  blue400: "#60a5fa", // storm-mode glow on selected cards and buttons
  blue500: "#3b82f6", // reserved: no current callers
  blue600: "#2563eb", // primary buttons, map pins, focus icons, nav glyphs
  blue700: "#1d4ed8", // accent text on info cards, quick-pick labels, login link
  blue800: "#1e40af", // route screen header pill text
  blue900: "#1e3a8a", // login link emphasis

  // ── Sky / cyan: connectivity and login identity ───────────────────────────
  sky50: "#f0f9ff", // offline info banner surface
  sky200: "#bae6fd", // offline info banner border
  sky400: "#38bdf8", // login hero wave icon
  sky600: "#0284c7", // active tab tint, offline banner icon
  sky700: "#0369a1", // offline banner body text
  cyan600: "#0891b2", // login shield-check badge

  // ── Red / rose: danger, errors, SOS and rejected states ───────────────────
  red50: "#fef2f2", // danger card fill, rejected status chip, required-field hint
  red100: "#fee2e2", // reserved: no current callers
  red200: "#fecaca", // danger borders: offline, garage, profile, SOS alert
  red300: "#fca5a5", // reserved: no current callers
  red400: "#f87171", // storm-mode danger glow, speeding readout
  red500: "#ef4444", // required-field asterisks, danger chip outlines
  red600: "#dc2626", // error text/icons, destructive buttons, map alert borders
  red700: "#b91c1c", // danger body copy, rejected chip text, passability warnings
  red800: "#991b1b", // route refusal title and body
  red900: "#7f1d1d", // reserved: no current callers
  rose600: "#e11d48", // flood map SUBMERGED status (RouteMap)

  // ── Green: success, verified, safe and online ─────────────────────────────
  green50: "#f0fdf4", // success card fill, SOS status panel, verified chip
  green200: "#bbf7d0", // success card borders (route, SOS panel)
  green300: "#86efac", // storm-mode success icons on the SOS status panel
  green400: "#4ade80", // profile verified check
  green600: "#16a34a", // success icons, garage check, modal step rail
  green700: "#15803d", // success text, verified chip, online/offline status
  green800: "#166534", // SOS status panel title (light mode)
  green900: "#14532d", // SOS status panel fill in storm mode

  // ── Emerald: passability and route safety (brand success) ─────────────────
  emerald50: "#ecfdf5", // report-form privacy/success panel fill
  emerald100: "#d1fae5", // SOS status panel borders (light mode)
  emerald200: "#a7f3d0", // report-form success panel border
  emerald600: "#059669", // RouteMap PASSABLE, home online/shield, ready pin
  emerald700: "#047857", // report-form success panel body text
  emerald800: "#065f46", // report-form success panel title
  emerald950: "#052e1b", // reserved: no current callers

  // ── Amber / orange: warnings, pending review and guest callouts ───────────
  amber100: "#fef3c7", // pending chip (report history), SOS modal, warning dialog
  amber200: "#fde68a", // route hazard chip border
  amber300: "#fcd34d", // reserved: no current callers
  amber400: "#fbbf24", // storm-mode SOS warning text
  amber500: "#f59e0b", // route warning banner border, RouteMap marker fill
  amber600: "#d97706", // RouteMap LIGHT_FLOOD, warning icons (home, QuickPicks)
  amber700: "#b45309", // warning copy in route and SOS screens (light mode)
  amber800: "#92400e", // pending/warning text, dialog and SOS modal accents
  /** Warning banner surface; the storm counterpart lives in stormColors. */
  amberSurface: "#fffbeb",
  orange50: "#fff7ed", // report guest/info banner fill
  orange200: "#fed7aa", // report guest/info banner border
  orange800: "#9a3412", // report guest/info banner text

  // ── Semantic surfaces and the ink pairs ───────────────────────────────────
  surface: "#fafbfc", // reserved off-white card tint: no current callers
  surfaceAlt: "#f4f7fa", // reserved alternate card tint: no current callers
  /** Modal/dialog surface: a step above cards so pop-ups read as elevated. */
  surfaceHigh: "#ffffff", // Dialog, SOSUpdateModal, QuickPicks sheet, VehicleGarage
  /** Backgrounds for a chip/button that needs to read as "ink" regardless of theme. */
  inkBg: "#0f172a", // login mark/CTA, route turn card, avatar, QuickPicks, garage
  /** Text on a permanently dark surface (turn card, ink button): light in every theme. */
  onInk: "#ffffff", // login CTAs, route turn/speed readouts, modal buttons
  inkMuted: "#cbd5e1", // muted copy on ink surfaces: route meta, profile card, avatar
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
  // Neutrals — light shades become dark surfaces, dark shades become light text.
  white: "#0b1220", // dark card/input/chip surface; icon strokes on ink fills
  slate50: "#111c2e", // page background (login, offline); route notice cards
  slate100: "#1e293b", // subtle icon tiles, header dividers, neutral status chips
  slate200: "#334155", // card/input/chip borders and list separators
  slate300: "#475569", // tertiary  text, disabled borders, empty-state icon
  slate400: "#94a3b8", // placeholder/muted text, inactive chip labels, tab tint
  slate500: "#cbd5e1", // secondary and helper text beneath titles/labels
  slate600: "#e2e8f0", // form labels and route alert body copy
  slate700: "#f1f5f9", // field labels, section subtitles, offline headings
  slate800: "#f8fafc", // emphasized captions, map control icons, auth accents
  slate900: "#f8fafc", // light screen titles, wordmark, primary buttons

  // Blue — info panels and selected states.
  blue50: "#0c2338", // info card fills: SOS update modal, route alerts, login CTA
  blue100: "#123450", // live-network badge, soft card tints and borders
  blue600: "#60a5fa", // primary buttons, map pins, focus icons, nav glyphs
  blue700: "#93c5fd", // info-card accent text, quick-pick labels, login link
  blue900: "#bfdbfe", // login link emphasis

  // Sky — connectivity and login identity.
  sky50: "#082f49", // offline info banner surface
  sky200: "#075985", // offline info banner border
  sky600: "#38bdf8", // active tab tint, offline banner icon
  sky700: "#7dd3fc", // offline banner body text

  // Red / rose — danger, plus flood-map status.
  red50: "#3a0a0a", // danger card fill, rejected chip, required-field hint
  red200: "#7f1d1d", // danger borders: offline, garage, profile, SOS alert
  red500: "#f87171", // required-field asterisks, danger chip outlines
  red600: "#f87171", // error text/icons, destructive buttons, map alert borders
  red700: "#fca5a5", // danger body copy, rejected chip text, passability warnings
  red800: "#fecaca", // route refusal title and body
  // Flood-status colours on the night/storm map (navigation-night-v1 is a
  // dark basemap): the light-mode shades read as muted/low-contrast on it,
  // which is the one place storm mode must not go quieter -- a flood warning
  // has to stay at least as visible after dark as it is in daylight.
  rose600: "#fb7185", // flood map SUBMERGED status (RouteMap)

  // Green — success, verified, safe and online.
  green50: "#052e1b", // success card fill, SOS status panel, verified chip
  green200: "#8acca2", // success card borders (route, SOS panel)
  green600: "#4ade80", // success icons, garage check, modal step rail
  green700: "#86efac", // success text, verified chip, online/offline status
  green800: "#bbf7d0", // SOS panel title here; light mode uses green800

  // Emerald / orange — passability, report success panel, guest banner.
  // These had no storm override at all: their full-width cards rendered as
  // bright light-mode panels dropped into an otherwise dark screen, and green
  // 800 stayed dark-on-dark against its own 50 card.
  emerald50: "#052e1b", // report privacy/success panel fill
  emerald100: "#065f46", // SOS status panel borders
  emerald200: "#047857", // report-form success panel border
  emerald700: "#6ee7b7", // report-form success panel body text
  emerald800: "#a7f3d0", // report-form success panel title
  orange50: "#2e1605", // report guest/info banner fill
  orange200: "#9a3412", // report guest/info banner border
  orange800: "#fdba74", // report guest/info banner text

  // Amber — warnings and pending review.
  amber100: "#3a2a06", // pending chip (report history), SOS modal, warning dialog
  amber600: "#fbbf24", // RouteMap LIGHT_FLOOD, warning icons (home, QuickPicks)
  amber800: "#fcd34d", // pending/warning text, dialog and SOS modal accents
  amberSurface: "#3a2a06", // route warning banner surface

  // Semantic surfaces.
  surface: "#111c2e", // reserved card tint: no current callers
  surfaceAlt: "#0a1220", // reserved alternate card tint: no current callers
  surfaceHigh: "#091830ff", // Dialog, SOSUpdateModal, QuickPicks sheet, VehicleGarage

  // Ink pairs — onInk/inkMuted stay light; inkBg deliberately has NO override.
  // Its contract ("reads as ink regardless of theme") keeps the profile identity
  // card, the route turn-instruction card and the avatar fallback dark in both
  // themes. An override used to sit here, turning all three into a bright
  // royal-blue card instead of the one dark card the screen comment describes.
  onInk: "#ffffff", // login CTAs, route turn/speed readouts, modal buttons
  inkMuted: "#cbd5e1", // route meta, profile card, avatar
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
  toggle: () => { },
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
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => { });
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
