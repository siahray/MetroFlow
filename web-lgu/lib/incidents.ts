/**
 * Mock triage queue.
 *
 * The MetroFlow API exposes the road network, flood simulation and routing, but
 * no incident-report endpoints yet. Anything here is demo data shaped to match
 * the dispatch workflow, so swapping it for a real query later means replacing
 * this module rather than rewriting the screens.
 */

export type QueueSource = "photo" | "sensor" | "escalated";

export type Incident = {
  id: string;
  level: string;
  urgency: number;
  reporter: string;
  reportedAt: string;
  aiConfidence: string;
  narrative: string;
  location: string;
  barangay: string;
  source: QueueSource;
  tags: string[];
};

export type LogEntry = {
  time: string;
  text: string;
  kind: "muted" | "action" | "note";
};

export const QUEUE_FILTERS = [
  { id: "all", label: "All" },
  { id: "photo", label: "Photo" },
  { id: "sensor", label: "Sensor Mismatch" },
  { id: "escalated", label: "Escalated" },
] as const;

export type QueueFilter = (typeof QUEUE_FILTERS)[number]["id"];

/**
 * Masks a phone number for PII protection (e.g. +63 917 555 0192 -> +63 91** *** ****)
 * Per UI/UX Design Audit & Scope Resolution.
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return "";

  // Remove non-digits
  const digits = phone.replace(/\D/g, "");

  // Handle Philippine mobile numbers: starts with 63 and 12 digits
  if (digits.startsWith("63") && digits.length === 12) {
    return `+63 ${digits.substring(2, 4)}** *** ****`;
  }

  // Handle 11-digit numbers starting with 0
  if (digits.startsWith("0") && digits.length === 11) {
    return `+63 ${digits.substring(1, 3)}** *** ****`;
  }

  // Fallback: show first 3 characters, mask the rest
  if (digits.length >= 3) {
    return `${digits.substring(0, 3)}** *** ****`;
  }

  return "+63 9** *** ****";
}

/** Ordered by urgency score, which is how the queue is presented. */
export const INCIDENTS: Incident[] = [
  {
    id: "FR-0248",
    level: "Critical Flood Level 3",
    urgency: 9.4,
    reporter: "Dale Ramos (Citizen ID #8841-B)",
    reportedAt: "Apr 27, 2026 • 11:41 AM (11 min ago)",
    aiConfidence: "99.2% Authentic",
    narrative:
      '"Water rose very quickly after the creek spillway overflowed. It is now calf-to-knee deep (approx 75 cm) inside our ground floor. There are 6 of us trapped on the upper stair landing including two small children and my elderly aunt. Current is strong."',
    location: "Brgy. San Pedro - Riverside Zone",
    barangay: "Brgy. San Pedro",
    source: "photo",
    tags: ["Photo GPS Match", "6 Trapped"],
  },
  {
    id: "FR-0241",
    level: "Critical Flood Level 3",
    urgency: 8.6,
    reporter: "Brgy. San Pedro Rescue Team",
    reportedAt: "Apr 27, 2026 • 11:12 AM (40 min ago)",
    aiConfidence: "97.4% Verified",
    narrative:
      '"Spillway gate is at maximum release and the creek has jumped its bank near the elementary school. Rescue boat cannot hold position against the current. Requesting BFP support and additional zodiac units."',
    location: "San Pedro Creek Spillway",
    barangay: "Brgy. San Pedro",
    source: "escalated",
    tags: ["Escalated by BFP"],
  },
  {
    id: "FR-0247",
    level: "Moderate Hazard Level 2",
    urgency: 7.8,
    reporter: "CCTV Feed #09 • Malaya Overpass",
    reportedAt: "Apr 27, 2026 • 11:34 AM (18 min ago)",
    aiConfidence: "94.5% Confirmed",
    narrative:
      '"Automated video analytics detected stalled delivery truck submerged up to hood level (approx 85 cm). Roadway impassable to light vehicles. Traffic queueing rapidly towards EDSA southbound."',
    location: "Rizal Avenue, Malaya Overpass",
    barangay: "Malaya",
    source: "sensor",
    tags: ["Road Impassable"],
  },
  {
    id: "FR-0246",
    level: "Alert Level 1",
    urgency: 6.9,
    reporter: "River Sensor Station #04",
    reportedAt: "Apr 27, 2026 • 11:28 AM (24 min ago)",
    aiConfidence: "98.0% Validated",
    narrative:
      '"Rapid water rise detected in narrow alleyway drainage channel (+10 cm/hr). Low risk to human life currently, but water approaching commercial building thresholds."',
    location: "A. Mabini St. Alleyway",
    barangay: "A. Mabini",
    source: "sensor",
    tags: ["Rising Rapidly (+10 cm/hr)"],
  },
  {
    id: "FR-0245",
    level: "Moderate Hazard Level 2",
    urgency: 6.1,
    reporter: "Marites Cruz (Citizen ID #7712-C)",
    reportedAt: "Apr 27, 2026 • 11:19 AM (33 min ago)",
    aiConfidence: "96.7% Authentic",
    narrative:
      '"Floodwater is halfway up our gate (approx 60 cm) and still rising. My mother uses a wheelchair and cannot manage the steps to the second floor on her own. We are four adults and one senior."',
    location: "Sampaguita St. corner Mabini",
    barangay: "Brgy. San Pedro",
    source: "photo",
    tags: ["Photo GPS Match", "1 Senior"],
  },
  {
    id: "FR-0244",
    level: "Alert Level 1",
    urgency: 5.4,
    reporter: "Jomar Reyes (Citizen ID #6620-A)",
    reportedAt: "Apr 27, 2026 • 11:10 AM (42 min ago)",
    aiConfidence: "92.3% Authentic",
    narrative:
      '"Delivery van stalled in the underpass and is blocking the innermost lane. Water is 35 cm below the door line but rising. Drivers are pushing it towards the shoulder."',
    location: "Doña Aurora Ave.",
    barangay: "Malaya",
    source: "photo",
    tags: ["Vehicle Stalled"],
  },
  {
    id: "FR-0243",
    level: "Alert Level 1",
    urgency: 4.8,
    reporter: "Aileen Bautista (Citizen ID #5391-D)",
    reportedAt: "Apr 27, 2026 • 11:01 AM (51 min ago)",
    aiConfidence: "90.8% Authentic",
    narrative:
      '"Knee-deep water (approx 50 cm) along the service road, passable for high-clearance trucks only. Tricycles are turning back and causing a bottleneck near the barangay hall."',
    location: "Kalayaan Ave. Service Road",
    barangay: "Brgy. Cembo",
    source: "photo",
    tags: ["Photo GPS Match"],
  },
  {
    id: "FR-0242",
    level: "Alert Level 1",
    urgency: 4.2,
    reporter: "Nestor Villanueva (Citizen ID #4108-E)",
    reportedAt: "Apr 27, 2026 • 10:54 AM (58 min ago)",
    aiConfidence: "88.9% Authentic",
    narrative:
      '"Water is creeping over the southbound underpass kerb (approx 25 cm). Still passable for SUVs, but the drainage grate on the left side looks blocked with debris."',
    location: "C5 Southbound Underpass",
    barangay: "Brgy. Bagong Ilog",
    source: "photo",
    tags: ["Water Rising"],
  },
];

export const INCIDENT_BY_ID = new Map(INCIDENTS.map((incident) => [incident.id, incident]));

/** The log starts with the entries the triage bot already wrote. */
export const INITIAL_LOGS: Record<string, LogEntry[]> = {
  "FR-0248": [
    {
      time: "11:42 AM",
      text: "AI Auto-triage: Submersion flagged > 60 cm. Assigned Urgency 9.4.",
      kind: "muted",
    },
    {
      time: "11:44 AM",
      text: "Operator M. Santos confirmed photo GPS matches Riverside Zone cadastre.",
      kind: "muted",
    },
  ],
};

export function countBySource(incidents: Incident[], source: QueueSource) {
  return incidents.filter((incident) => incident.source === source).length;
}
