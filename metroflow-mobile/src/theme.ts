/** Brand palette. Primary is slate-900, success emerald (AGENTS.md); use these, not raw hex. */
export const colors = {
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
