# MetroFlow — Driver App Design Baseline

## Document Control

| Field          | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Project        | MetroFlow                                                             |
| Document       | Driver App Design Baseline                                            |
| Version        | 0.7                                                                   |
| Status         | For Review — design gate not passed                                   |
| Date           | 23 October 2026                                                       |
| Scope          | Driver and commuter app (`metroflow-mobile/`), native Expo client     |
| Source         | Client-supplied HTML/CSS, 8 driver screens received in 4 source files |
| Behaviour ref  | [FSD](../FSD.md)                                                      |
| Architecture   | [TSD](../TSD.md) — ADR-014, ADR-021 and proposed ADR-022              |
| Change record  | [CR-001](../CR-001.md); CR-002 and CR-003 proposed                    |
| Implementation | Prototype only; production implementation is not approved by this doc |

This baseline turns the supplied driver HTML/CSS into a design specification for
the native Expo driver app. It does not approve implementation, cost, schedule or
the outstanding CR-001 scope. This is an academic capstone project, not an
official LGU deployment; the LGU and responder context is a scenario, and no
endorsement, funding or data-sharing agreement is implied. The admin portal is
covered separately in [ADMIN_UI_BASELINE.md](ADMIN_UI_BASELINE.md).

The supplied HTML/CSS is the **visual source of truth**. The FSD remains the
**behavioural source of truth**. Where the two disagree, the FSD behaviour wins
and the UI is adapted. Where the FSD is silent, the supplied UI is used and the
gap is recorded below.

> Stack change: the driver client moved from a Vite PWA to Expo SDK 58 / React
> Native / Expo Router on 22 October 2026. The Vite prototype remains in git
> history at `1633c75`; the supplied HTML/CSS remains archived under
> `source/driver/`. This change is covered by CR-001 and ADR-014 and is pending
> academic approval.

> **Implementation status (27 October 2026).** This baseline is a design
> specification, not a status report. The API gap tables further down were
> written against the v1.2 baseline; authentication, SOS, hazard create/update/
> publish and fleet endpoints have since been implemented. [api.md](../api.md)
> §9 is the authoritative list of what exists, and [FSD.md](../FSD.md)
> §Implementation Status records how far each screen is wired.

## 1. Source Inventory

### Received screens

| #   | File                                                                                   | Screen                            | Coverage        |
| --- | -------------------------------------------------------------------------------------- | --------------------------------- | --------------- |
| 1   | [metroflow-driver-splash-login.html](source/driver/metroflow-driver-splash-login.html) | Splash welcome                    | Layout supplied |
| 2   | [metroflow-driver-splash-login.html](source/driver/metroflow-driver-splash-login.html) | Driver login, including SOS entry | Layout supplied |
| 3   | [metroflow-driver-map-routing.html](source/driver/metroflow-driver-map-routing.html)   | Set Destination                   | Layout supplied |
| 4   | [metroflow-driver-map-routing.html](source/driver/metroflow-driver-map-routing.html)   | Home & Map                        | Layout supplied |
| 5   | [metroflow-driver-map-routing.html](source/driver/metroflow-driver-map-routing.html)   | Route & Alerts                    | Layout supplied |
| 6   | [metroflow-driver-report-sos.html](source/driver/metroflow-driver-report-sos.html)     | Report Hazard                     | Layout supplied |
| 7   | [metroflow-driver-report-sos.html](source/driver/metroflow-driver-report-sos.html)     | SOS Rescue Dispatch               | Layout supplied |
| 8   | [metroflow-driver-profile.html](source/driver/metroflow-driver-profile.html)           | Citizen Profile                   | Layout supplied |

The splash and login screens share one archived source file. The set-destination,
home and route screens share a second source file. The report and SOS screens
share a third source file. The profile screen has a fourth source file. All four
files are preserved for provenance and are not production code.

The Offline Maps screen is not in the four supplied source files. It is a
final-product design extension added under proposed [CR-002](../CR-002.md). It
uses the established driver tokens and a local simulated state; it is not a
production download implementation. Proposed [CR-003](../CR-003.md) selects
Sentinel-1 as the final-product satellite source for advisory flood extent; the
prototype uses no satellite data, credential or derived layer.

### Common implementation

| Item          | Value                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework     | Expo SDK 58, React Native 0.88, React 19.3, Expo Router, TypeScript                                                                                |
| Source        | Static HTML with Tailwind CDN, Lucide CDN, Unsplash map images and pravatar avatars; archived only as the visual reference                          |
| Font          | Plus Jakarta Sans for splash/login; Inter for the map/routing, report/SOS and profile screens; both bundled locally                                 |
| Styling       | React Native `StyleSheet` with shared driver tokens in `src/theme/tokens.ts`                                                                        |
| Icons         | `lucide-react-native` and `react-native-svg`                                                                                                       |
| Viewport      | Source frames `390 × 844` for report/SOS/profile and `375 × 812` for earlier screens; reviewed at `375 × 812`                                      |
| Data          | Hard-coded demo copy; no API calls                                                                                                                 |
| Map           | Local schematic `MapCanvas` SVG; no satellite image, tile provider or live map                                                                      |
| Avatar        | Local "CR" initials placeholder; no pravatar request                                                                                               |
| Known defect  | `h-18` is not a valid Tailwind spacing class in the supplied source; it renders as a 72 px bar                                              |
| Known gaps    | Guest access, "Skip for now", saved corridors, drainage telemetry, report submission, SOS dispatch, profile editing, notification settings and status labels are not in the FSD |

Production adaptation:

- `metroflow-mobile/` is a separate Expo app. It is not part of
  `metroflow-admin/`.
- The supplied Tailwind values are mirrored as React Native design tokens. The
  admin portal continues to use Tailwind CSS 4; the native app uses `StyleSheet`
  so it does not require a Tailwind runtime or NativeWind build layer.
- `lucide-react-native` is installed. Do not add the Lucide CDN.
- Plus Jakarta Sans and Inter are bundled locally. Do not add the Google Fonts
  import.
- The supplied Unsplash satellite images and `i.pravatar.cc` avatars are not
  used. The prototype renders a local schematic map and initials avatar.
- Expo Router owns screen navigation. The web target is a review surface, not
  the delivery target; there is no desktop phone-frame shell.
- Hard-coded copy becomes props or API data as the remaining screens and
  contracts are supplied.
- Background location, push notifications, camera, SQLite and MapLibre are not
  implemented in this prototype. They require development builds and device
  testing; Expo Go is not sufficient.

## 2. Scope and Boundaries

### In scope for this baseline

- Splash welcome screen.
- Driver login screen.
- Home & Map screen.
- Set Destination screen.
- Route & Alerts screen.
- Report Hazard screen, including local depth, passability and note controls.
- SOS Rescue Dispatch screen, including local situation selection.
- Citizen Profile screen, including local notification state.
- Offline Maps final-product design placeholder, including simulated download
  progress, readiness, storage and stale-data states. Functional downloads are
  not in the pilot scope.
- Guest and skip entry affordances as supplied.
- The SOS quick-link entry affordance shown on login.
- The bottom-navigation shell and labelled pending boundary for screens that
  have not been supplied.
- The Expo project foundation, routes, fonts, icons and design tokens needed to
  review those screens.

### Out of scope for this baseline

- Turn-by-turn navigation, GPS instruction advance and arrival.
- Active rerouting, route selection, route request execution and ETA
  calculation.
- Report submission, camera capture, upload and offline queue behaviour.
- Functional telemetry, live sensor-feed connection and offline-map downloads;
  the Offline Maps screen is a design placeholder only.
- Sentinel-1 ingest, flood-extent processing, observation review and the
  satellite-derived hazard layer; proposed in CR-003 and not present in the
  prototype.
- Hazard detail, full drainage map and notification screens.
- Profile editing, verified-ID handling, settings persistence and logout behaviour.
- The full SOS confirmation, acknowledgement, assignment and resolution screens.
- Native telephony, SOS dispatch and emergency-service hand-off.
- Background location, native push, SQLite offline cache and MapLibre.
- Public App Store or Play Store release. Pilot native distribution is an EAS
  build and TestFlight/internal testing decision; see `OD-D07`.
- API integration and production authentication.

### Out-of-scope elements removed

The following supplied affordances were removed from the prototype because they
promise features excluded by CR-001 §3.2 or have no FSD or API requirement. The
source HTML remains archived for provenance; do not reintroduce these controls
without a scope change and design-gate approval.

| Removed element                        | Screen                | Reason                                                                 | Replacement                                              |
| -------------------------------------- | --------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| `Call 911 Directly`                    | SOS Rescue Dispatch   | Production SMS and telephony for SOS are out of scope                  | Static emergency guidance tells the user to call 911     |
| `Call dispatch`                        | Set Destination       | Native telephony is out of scope                                       | None                                                     |
| `Earn +15 Civic Karma`                 | Report Hazard         | No FSD requirement, points ledger or API contract                      | None                                                     |

The earlier combined `Offline Maps & Telemetry` settings row was removed in v0.5
because it implied a downloaded raster tile cache. In v0.6 it is replaced by a
standalone `Offline Maps` final-product design placeholder. Functional offline
tile downloads remain outside the pilot scope and require CR-002 approval.

### Current prototype boundary

The prototype implements splash, login, home, set destination, route, report,
SOS, profile and the final-product Offline Maps design placeholder, plus a shared
bottom navigation shell. Log In, Continue as Guest and Skip for now open the home
screen. Home search opens Set Destination; the home Map tab opens the route
screen; the destination CTA opens Route & Alerts; the route Home tab returns to
Home. The bottom navigation opens Report, SOS and Profile from Home, Route and
SOS; Report has no bottom navigation in the supplied design, while SOS and
Profile keep it visible.

The map is a local schematic, not a live map. Destination, route, hazard,
drainage, weather, report, SOS and profile values are supplied demo copy or
local form state. No route request is made, no hazard stream is subscribed, no
report is uploaded, no rescue request is sent and no geolocation permission is
requested.

The Offline Maps screen at `/offline` is a final-product design placeholder. Its
download, readiness and delete states use local component state, and progress is
simulated. No map package, tile, graph, hazard snapshot or route corridor is
fetched, written or stored. The screen deliberately keeps map availability
separate from hazard freshness so a downloaded map cannot imply live safety
data. No Sentinel-1 credential, feed, processing job or derived satellite layer
is present.

Report depth, passability, quick notes and SOS situation type update local state
only. The notification switch on Profile also updates local state only. These
controls reset when the route is reloaded and do not persist.

Controls for unsupplied screens and actions open a clearly labelled pending
boundary. This includes notifications, profile editing, verified ID, settings,
Help & Support, logout, offline coverage selection, offline storage, offline map
help, photo capture, report submission, location change, SOS dispatch, hazard
detail, full drainage map, map controls and Start Navigation. No SOS request or
emergency call is sent.

The prototype runs through the Expo dev server. No EAS build, native binary,
store submission or device test has been performed.

## 3. Design Tokens

### Colour

| Token            | Value       | Use                                            |
| ---------------- | ----------- | ---------------------------------------------- |
| `navy-900`       | `#0B2447`   | Splash/login buttons, headings and logo        |
| `navy-800`       | `#19376D`   | Reserved for splash/login pressed surfaces     |
| `navy-deep`      | `#061D38`   | Report/SOS/profile headings, selected controls and primary buttons |
| `brand-50`       | `#F0F4FF`   | Splash/login pills and secondary surfaces      |
| `brand-100`      | `#E0EBFF`   | Splash/login borders and bar chart             |
| `brand-500`      | `#3B82F6`   | Live indicator and focus accents               |
| `brand-600`      | `#2563EB`   | Links, blue-600 icons and route accents        |
| `slate-900`      | `#0F172A`   | Map/routing headings and primary buttons       |
| `slate-800`      | `#1E293B`   | Map/routing strong text                        |
| `slate-300`      | `#CBD5E1`   | Map/routing dividers and markers               |
| `blue-50/100/200`| system      | Selected filters, chips and safe-route panels  |
| `blue-700`       | `#1D4ED8`   | Report/SOS/profile links and secondary buttons |
| `blue-800`       | `#1E40AF`   | Route suggestion headings and selected labels  |
| `red-500/700`    | system      | Hazard banners, warnings and SOS               |
| `emerald-500`    | `#10B981`   | Verified/clear indicators                      |
| `slate-*`        | system      | Page text, borders and muted surfaces          |

The supplied driver source files use different palettes. Splash/login use
`#0B2447` and `#19376D` with a custom brand scale. The map/routing file uses
`#0F172A` and `#1E293B` with Tailwind `blue-*`, `red-*`, `emerald-*` and
`slate-*`. The report/SOS/profile source configures a sky brand scale
(`#F0F9FF`, `#E0F2FE`, `#0EA5E9`, `#0284C7`) but mostly uses Tailwind `blue-*`,
and sets `navy-900` to `#061D38`. The prototype keeps the distinct sets as
separate tokens and does not silently merge them. Do not consolidate them
without a brand decision. See `OD-D05` and `OD-D10`.

### Type and shape

| Item     | Value                                                                 |
| -------- | --------------------------------------------------------------------- |
| Font     | Plus Jakarta Sans for splash/login; Inter for map/routing, report/SOS and profile screens |
| Display  | `30/36`, extrabold, tracking `-0.8` on splash                         |
| Heading  | `24/30` extrabold or `16/22` bold on login                            |
| Body     | `9/12` to `14/21`, medium, relaxed line height                       |
| Labels   | `9/12` to `11/14`, semibold or bold                                   |
| Pills    | Full radius, compact horizontal padding                               |
| Inputs   | Radius 12, `bg-slate-50`, focus border in blue                        |
| Cards    | Radius 16, 1 px border, soft shadow                                   |
| Buttons  | Radius 12, full width, bold label, minimum height 48 to 52            |

### Source inconsistencies to resolve

| Item                  | Supplied source                                                 | Prototype treatment                                      | Decision |
| --------------------- | --------------------------------------------------------------- | -------------------------------------------------------- | -------- |
| Typeface              | Plus Jakarta Sans on splash/login; Inter on map/routing, report/SOS/profile | Both families bundled and used per source                 | `OD-D10` |
| Navy                  | `#0B2447`/`#19376D`, `#0F172A`/`#1E293B` and `#061D38`          | Separate `navy-*`, `navy-deep` and `slate-900/800` tokens | `OD-D05` |
| Blue                  | Custom brand scale, Tailwind `blue-*` and a configured sky scale | `brand-*` retained; `blue-*` tokens added                | `OD-D10` |
| Truncated headings    | "Active Route Turn By Tu" and "Flood Ma..."                     | Restored to "Active Route Turn By Turn" and "Flood Map"   | `OD-D10` |
| Source frame          | `375 × 812` on earlier screens; `390 × 844` on report/SOS/profile | Reviewed at `375 × 812` for all screens                 | `OD-D10` |
| Bottom-nav SOS emphasis | Dark on SOS and Profile; muted on Home/Route                    | `sosEmphasis` on Profile; active styling on SOS           | `OD-D13` |
| Satellite map imagery | Unsplash photo                                                   | Local schematic `MapCanvas` SVG                           | `OD-D11` |
| Avatar                | `i.pravatar.cc` on all supplied screens                          | Local "CR" initials placeholder                           | `OD-D14` |
| Pedestrian icon       | `figure-stand` is replaced by `user` in the supplied script      | `User` from Lucide                                        | —        |

### Motion and iconography

- The live-network dot uses a two-second opacity pulse. The profile sensor status
  uses a 1.6-second expanding ring. Both respect the platform reduce-motion
  setting and hold static when it is enabled.
- Hover and focus transitions only; no decorative page transitions.
- Icons are Lucide components. Decorative icons sit next to text that names the
  action; icon-only controls carry an accessibility label.

## 4. Screen Map

| Screen           | Route             | Source    | FSD coverage                                                          | Status                         |
| ---------------- | ----------------- | --------- | --------------------------------------------------------------------- | ------------------------------ |
| Splash welcome   | `/`               | 1         | Entry to FSD-FR-054 to 074; no dedicated splash requirement           | Implemented                    |
| Driver login     | `/` (same route)  | 2         | FSD-FR-018 to 022; sign-in and registration against the API           | Implemented                    |
| Home & Map       | `/(tabs)/home`    | 4         | FSD-FR-054, 056, 059 and 063 as visual affordances                    | Implemented — map is live, hazards are still demo text |
| Set Destination  | `/route`          | 3         | FSD-FR-054, 055 as visual affordances                                 | Implemented — local list of recent destinations |
| Route & Alerts   | `/route`          | 5         | FSD-FR-055, 056, 059 to 064 as visual affordances                     | Implemented — static comparison, no API call |
| Report Hazard    | `/(tabs)/report`  | 6         | FSD-FR-065 to 067 as visual affordances                               | Partial — shell only, no upload |
| SOS Rescue Dispatch | `/(tabs)/sos`  | 7         | FSD-FR-073, 074 as visual affordances                                 | Partial — posts to `/api/v1/sos`; no native telephony |
| Citizen Profile  | `/(tabs)/profile` | 8         | No dedicated FSD requirement; clearance and session fields overlap FSD-FR-002 and FSD-FR-022 | Implemented — clearance in cm, sign-out |
| Offline Maps     | `/offline`        | none      | Final-product extension under CR-002                                   | Placeholder — simulated download |
| SOS confirmation | overlay           | 2 partial | FSD-FR-073, FSD-FR-074                                                | Entry only                     |

## 5. Screen Details

### 5.1 Splash Welcome

Elements:

- Header pill with pulsing dot and "Live Flood Network".
- "Civic Transit Safe" status with shield icon.
- Circular logo with waves icon and two decorative dots.
- "MetroFlow" wordmark and "Safer Roads. Stronger Communities." tagline.
- Abstract bar graphic with a dashed route line and centre node.
- Floating "Real-Time Flood Rerouting" pill.
- Primary "Log In" action.
- Secondary "Continue as Guest" action.
- Tertiary "Skip for now" action.

Interactions:

- Log In opens the driver login screen.
- Continue as Guest and Skip for now open the home screen.
- All controls have visible hover and focus states on web and native press
  feedback on device.

Traceability and gaps:

- The screen is an entry point, not a separate FSD requirement.
- "Civic Transit Safe", "Live Flood Network" and the splash CTA mix are supplied
  visual copy. Their status semantics and any live data source are unresolved.
- Guest and skip access are not described in the FSD. See `OD-D02`.

### 5.2 Driver Login

Elements:

- Back button to the splash screen.
- "Civic Route Alert Active" status pill with droplet icon.
- Compact logo, "MetroFlow", "Driver Login" and supporting copy.
- Email or phone field with mail icon.
- Password field with lock icon and reveal/hide control.
- Forgot-password link.
- Primary "Log In" action.
- "OR" divider.
- Secondary "Continue as Guest" action.
- Informational card about optional information and vehicle ground-clearance
  warnings.
- Sticky SOS card: "Urgent Emergency?", "Access rescue mode without signing in"
  and "SOS Quick Link".

Interactions:

- Back returns to the splash screen.
- Email/phone and password are checked before login; empty fields show an
  explicit notice instead of submitting.
- Password reveal toggles between hidden and visible text.
- Forgot password shows a prototype notice explaining that reset is not
  connected.
- Log In and Continue as Guest open the home screen.
- SOS Quick Link opens a labelled prototype modal; it does not send an SOS.

Traceability and gaps:

- FSD-FR-018 specifies email and password, both required. The supplied field
  also accepts a phone number. The identifier policy is unresolved. See
  `OD-D01`.
- FSD-FR-019 (password reveal) and FSD-FR-020 (forgot-password affordance) are
  represented.
- The FSD does not define guest access, skip access or a pre-authentication SOS
  quick link. These are supplied UI behaviour and need a scope decision. See
  `OD-D02` and `OD-D03`.
- The supporting copy promises saved safe corridors and vehicle clearance
  profiles. Vehicle clearance exists in the routing requirements, but saved
  driver profiles and corridors are not in the FSD. See `OD-D04`.
- FSD-FR-073 requires an SOS with a current location and optional contact note.
  BRULE-010 requires a location fix no older than 60 seconds. No SOS contract or
  location flow is implemented in this prototype.
- The SOS dialog is a visual placeholder. It has no focus trap, native permission
  flow or emergency-line fallback. Those are required before production.

### 5.3 Home & Map

Elements:

- Header with MetroFlow mark, "Home", notification button and initials avatar.
- User bar with "Carlos Reyes", "Active Driver • Fleet" and a "Sensor Online"
  pill.
- Red "HAZARD SURGE ALERT • Zone 4B" banner.
- 280-high map card with a local schematic map, hazard rectangle, live-routing
  pill, weather pill, map controls and "Estuary Surge +0.12m Safe" badge.
- "Elevated Path Planner" search card with microphone affordance.
- Horizontal quick picks for Work Terminal, Home Bay and Civic Center.
- Urban drainage status row: Open Pumping `14/16`, Blocked Pave `3 Segs`,
  Tide Level `+1.1m`, sensor note and "Full Drainage Map" link.
- Five-item bottom navigation: Home, Map, Report, Rescue and Profile.

Interactions:

- Search opens Set Destination.
- The hazard banner and Map tab open Route & Alerts.
- Notifications and Full Drainage Map open the pending boundary.
- Map layers, recentering and zoom open the pending boundary.
- Report opens Report Hazard, Rescue opens SOS Rescue Dispatch and Profile opens
  Citizen Profile.
- The screen itself is scrollable; the bottom navigation is fixed.

Traceability and gaps:

- FSD-FR-054 and FSD-FR-056 are represented visually. No destination search or
  route request is performed.
- The hazard banner and drainage statistics are static. FSD-FR-059, FSD-FR-060
  and FSD-FR-063 are not implemented.
- Weather, estuary, pump, tide, "Sensor Online" and "Live SafeFlow Routing"
  values have no FSD or API definition. See `OD-D12`.
- The map has no provider, tiles, geolocation, hazard layer or offline graph.
  See `OD-D11`.
- Guest and skip sessions show the supplied "Carlos Reyes" demo identity. See
  `OD-D14`.
- Report, Rescue and Profile are now supplied screens. Report submission, SOS
  dispatch and profile persistence remain pending. See `OD-D13`, `OD-D17` to
  `OD-D22`.
- The search microphone and some map controls are visual affordances only.

### 5.4 Set Destination

Elements:

- Header with back button, MetroFlow mark, "Active Route Turn By Turn", call
  icon and initials avatar.
- "Metro Monitored Basins: 14 Active Flow Gauges" banner with Real-time label.
- Starting Point card and Financial District Tower destination card.
- Filter chips: selected "Avoid Deep Water (>15cm)", unselected "Higher
  Elevation" and a settings chip.
- Four quick-pick cards: Work HQ, Home, Metro Gym and Grand Mall Plaza.
- Passability Overview panel with a local schematic map, gradient overlay,
  "Rizal Avenue Passable" copy and "2 MIN AGO" badge.
- Recent Safe Searches rows for St. Jude Medical Center, Northport Freight
  Terminal and East River School Evac Zone.
- Fixed bottom bar with "2 dry alternative corridors ready", "ETA ~ 26-32 min"
  and "Find Flood-Safe Route".

Interactions:

- Back returns to Home.
- "Find Flood-Safe Route" opens Route & Alerts.
- The call icon, clear-destination icon, routing settings, Custom Pins, Clear
  History and destination editing open the pending boundary.
- The start and destination fields, filter chips, quick picks and recent
  searches are static demo content in this prototype.

Traceability and gaps:

- FSD-FR-054 covers destination entry. The supplied screen shows a selected
  destination, not a search field, search results or a map pin. The search
  interaction is not implemented.
- FSD-FR-055 covers the route request. The CTA opens the route screen but does
  not request a route.
- Filter selection, quick picks, custom pins, recent-search reuse and clear
  history have no FSD behaviour. See `OD-D15`.
- "Live Satellite Mesh", passability text and the "2 MIN AGO" timestamp are
  supplied demo copy. The prototype uses a local schematic map.
- The supplied header title is truncated to "Active Route Turn By Tu"; the
  prototype uses "Active Route Turn By Turn". See `OD-D10`.

### 5.5 Route & Alerts

Elements:

- Upper 45% schematic map with route polyline, start/end markers, "Water Level:
  +42cm" tag and compass/layers controls.
- Floating MetroFlow "Flood Map" header with notification and initials avatar.
- From/To card: current location to Work, `12.4 km • 32 min`, with a swap
  control.
- Scrollable bottom sheet with drag handle.
- Red "Flooded area ahead / Active" alert card.
- Route Suggestions heading with live hydrologic sync label.
- Selected "Alternative (Bypass Safe)" card: `27 min`, `10.8 km`, "Clear of
  runoff" and "Safer route avoids flooded area".
- "Current Route (Direct)" card: `32 min`, `12.4 km`, `+5 min delay` and a
  rising-water caution.
- Verification note from the City Flood Defense team.
- "Start Navigation" button and automatic-rerouting footnote.
- Bottom navigation with Map active.

Interactions:

- Home returns to Home.
- The alert card, swap control, map controls and Start Navigation open the
  pending boundary.
- Report opens Report Hazard, Rescue opens SOS Rescue Dispatch and Profile opens
  Citizen Profile.
- The route options are displayed but cannot be selected; no reroute is
  triggered.

Traceability and gaps:

- FSD-FR-055 and FSD-FR-056 are represented visually. The route, distance, ETA
  and stops are supplied demo copy.
- FSD-FR-057 and FSD-FR-058 (turn-by-turn and GPS advance) are not supplied.
- FSD-FR-059 to FSD-FR-064 are represented by static alert and alternative-route
  cards only. There is no hazard stream, intersection detection, automatic
  reroute, manual refresh or proximity calculation.
- Hazard detail, active navigation and the full drainage map are not supplied.
  See `OD-D16`.
- The supplied header title is truncated to "Flood Ma..."; the prototype uses
  "Flood Map". See `OD-D10`.

### 5.6 Report Hazard

Elements:

- Header with MetroFlow mark, "Report Hazard", notification button and initials
  avatar.
- Back action and "Live Dispatch Sync" pill.
- "Community Flood Watch" banner explaining that reports alert rescue units and
  redirect commuters.
- "1. Take a photo (optional)" section with a dashed photo panel, camera icon,
  "Snap waterline against curb or vehicles", "JPG, PNG up to 10MB" and "Add
  Photo" action.
- "2. Location & Depth" section with detected location "Rizal Avenue, Sta. C",
  "Near Doroteo Jose LRT Station" and a Change action.
- Estimated depth options: Ankle deep `0.5 ft (15 cm)`, Knee deep `1.5 ft (45
  cm)` selected by default, and Waist deep / Submerged `>3.0 ft (>90 cm) •
  Severe`.
- Passability options: Passable for all; Passable: high vehicle selected by
  default; Not passable.
- "3. Additional details (optional)" notes field with quick notes for Fast
  current, Open manhole and Stalled vehicles.
- "Submit Report" action and safety disclaimer with 911 and Rescue SOS emphasis.

Interactions:

- Back returns to the previous screen, or Home when there is no history.
- Notifications, Add Photo, Change and Submit Report open the pending boundary.
- Depth selection and passability selection update local state only.
- Typing appends local notes; a quick note appends its text to the notes field.
- The supplied report screen has no bottom navigation, so the prototype does
  not show one.
- No camera permission, photo upload, geolocation, EXIF extraction, report
  validation or dispatch sync is performed.

Traceability and gaps:

- FSD-FR-065 requires a flood report with a required depth of `Ankle-Deep`,
  `Knee-Deep` or `Impassable`. The supplied UI uses "Ankle deep", "Knee deep"
  and "Waist deep / Submerged"; the third mapping is not confirmed. See
  `OD-D17`.
- FSD-FR-066 and FSD-FR-067 cover camera/file attachment and GPS/EXIF/timestamp
  metadata. The prototype supplies the visual entry points only. The detected
  address is static demo copy.
- The "Live Dispatch Sync", "Community Flood Watch", allowed file types, 10 MB
  limit and report-disclaimer copy are supplied visual copy, not confirmed FSD
  behaviour. See `OD-D20`. The Civic Karma label was removed because no reward,
  ledger or contract exists.
- The post-submit confirmation, upload queue and offline pending state are not
  supplied. See `OD-D18`.
- Depth, passability and notes are local-only prototype state and reset on
  reload. They are not persisted or submitted.

### 5.7 SOS Rescue Dispatch

Elements:

- Header with MetroFlow mark, "Sos Rescue Dispatch", notification button and
  initials avatar.
- Round back and information actions with a red "Priority SOS Line" pill.
- Layered target graphic with "Active Geo-Lock" badge.
- "Need Assistance?" heading and supplied deployment copy.
- Identified Location card: "Rizal Ave near LRT Station", "±3m accuracy" and
  "Metro District Sector 4 • Northbound".
- Water Hazard Level card: `1.5 ft`, Critical, "Rising fast (+0.2ft/10m)" and
  "Sensor Station #RZA-09 telemetry".
- Situation Type options: Vehicle Stuck, Pedestrian selected by default and
  Medical Need.
- "SOS Request Rescue" primary action and Cancel.
- "Metro Emergency Dispatch • 24/7 Monitored Response. For immediate danger, call
  911 from your phone." disclaimer.
- Bottom navigation with Rescue active.

Interactions:

- Back, Cancel, information and notifications open the previous screen or the
  pending boundary as appropriate.
- Situation Type updates local state only.
- SOS Request Rescue opens the pending boundary. No rescue request is sent. The
  screen does not place calls; production telephony is out of scope.
- Bottom navigation opens Home, Map, Report or Profile.
- The location, accuracy, hazard level, rise rate and sensor station are static
  demo copy.

Traceability and gaps:

- FSD-FR-073 requires a one-tap SOS containing the current location and an
  optional contact note. The screen supplies a static location, situation type
  and no contact-note field. No SOS is created.
- BRULE-010 requires a location fix no older than 60 seconds. No location
  permission or freshness check exists.
- FSD-FR-074 requires SOS acknowledgement, assignment and resolution status.
  Those screens and states are not supplied.
- The priority-line, geo-lock, accuracy, sensor, 24/7 monitoring and "Critical"
  labels have no confirmed data source. See `OD-D20`.
- Production telephony and emergency-service hand-off are out of scope under
  CR-001 §3.2. The `Call 911 Directly` action was removed; the disclaimer keeps a
  static instruction to call 911 from the user's phone. See `OD-D19`.
- The supplied pedestrian icon is `figure-stand`, which the source script
  replaces with `user`; the prototype uses Lucide `User`.

### 5.8 Citizen Profile

Elements:

- Header with MetroFlow mark, "Citizen Profile" underlined title, notification
  button and initials avatar.
- Soft blue gradient behind the profile block.
- 88 px avatar with verified shield badge.
- "Carlos Reyes" and "Driver / Fleet Member" role pill.
- Stats: Clearance `280 mm`, Alert Sync `Active` and Dispatches `14`.
- Contact Information rows for Emergency Phone `+63 912 345 6789`, Civic
  Dispatch Email `carlos.reyes@email.com` and Registered Vehicle Plate `ABC
  1234` with `SUV 280mm` badge.
- "Edit Information" action and "Verified ID" link.
- Metro Hydro-Sensor Feed card with "Connected • Real-time telemetry" and a
  pulsing blue status dot.
- App Settings: Notifications switch on by default and Help & Support.
- Privacy note about sharing vehicle dimensions with MetroFlow Emergency Ops.
- Log Out action and "MetroFlow Navigation v3.8.4" version footer.
- Bottom navigation with Profile active and SOS emphasized in dark navy, matching
  the profile source.

Interactions:

- Notification button, contact rows, Verified ID, Edit Information, Help &
  Support and Log Out open the pending boundary.
- The Notifications switch updates local state only. It does not request or
  change native push permission.
- Bottom navigation opens Home, Map, Report or SOS.
- The pulsing status dot respects the platform reduce-motion setting. The rest
  of the screen is static.

Traceability and gaps:

- The FSD has no profile or settings screen requirement. The supplied identity
  and contact values are demo copy, not authenticated session data. See
  `OD-D21`.
- The profile uses `280 mm` clearance while the routing requirements use a
  clearance value in centimetres. The display unit and conversion policy are
  unresolved.
- `Dispatches 14`, `Alert Sync Active` and `Connected • Real-time telemetry` are
  supplied values with no contract or local implementation. The `420 MB` offline
  tile-cache row was removed because offline basemap tiles are outside the pilot
  scope. See `OD-D20`.
- Verified ID, profile editing, settings persistence and logout are not
  implemented. See `OD-D21` and `OD-D22`.
- The app version string is supplied demo copy; it is not sourced from the
  Expo configuration.
- The standalone `Offline Maps` row opens the final-product design placeholder
  in §5.9. The earlier combined `Offline Maps & Telemetry` row remains removed.

### 5.9 Offline Maps

This screen is a final-product extension, not part of the four supplied source
files. It is recorded under approved [CR-002](../CR-002.md), with the
final-product satellite flood snapshot approved under
[CR-003](../CR-003.md). It is a design placeholder for review and does not
change the pilot scope.

Elements:

- Header with back action, MetroFlow mark, "Offline Maps" title, informational
  action and initials avatar.
- Dark navy offline-readiness card for the demo region `Metro Manila Grid`, with
  a status pill for Not downloaded, Downloading or Ready.
- Package summary: map tiles, road graph, hazard snapshot (including any latest
  verified Sentinel-1 flood extent) and active route corridor.
- Simulated progress bar and percentage with state-specific helper text.
- Primary action `Download area`, `Downloading...` or `Update area`; the ready
  state adds `Delete offline area`; the idle state offers `Manage storage`.
- Coverage section with a local schematic map preview, dashed region frame and
  "Choose on map" pending action.
- Stale-data warning: map availability and hazard freshness are separate, so a
  downloaded map can be ready while hazards and routes are stale.
- "What gets downloaded" rows for map tiles, road graph, hazard snapshot
  (including any verified satellite flood extent) and route corridor.
- Download preferences: Wi-Fi only and auto-update, both on by default and local
  to this screen.
- Placeholder note stating that progress is simulated and no tiles are
  transferred or stored.

Interactions:

- Download starts a local 2.2-second progress simulation. It does not request
  network permission, create files, open SQLite or contact a map provider.
- Update restarts the local simulation. Delete returns the screen to the
  not-downloaded state.
- Wi-Fi only and auto-update toggle local state only.
- `Choose on map` and `Manage storage` open the pending boundary with a
  final-product explanation. The informational action opens offline-map help.
- Back returns to Citizen Profile.

Traceability and gaps:

- The FSD has no offline-map requirement. CR-002 proposes `FSD-FR-094` to
  `FSD-FR-100`; those identifiers are not effective until the change is
  approved.
- `Metro Manila Grid` is demo copy. Region boundaries, map provider, tile licence,
  package size, storage limit, update cadence, auto-update consent and stale-data
  policy remain unresolved. See `OD-D23`.
- In the production target, the hazard snapshot carries verified hazards plus
  the latest verified Sentinel-1 flood extent, with acquisition time, confidence,
  source and expiry. Raw scenes and the Sentinel credential are never packaged.
  CR-003 is approved; none of this is implemented.
- The hazard snapshot is deliberately a point-in-time copy. Using it must never
  present the route as live-safe; the warning is part of the design contract.
  Sentinel-1 extent is not depth and does not establish road passability.
- The map preview is the local `MapCanvas`, not MapLibre. There is no offline
  package format, checksum, signed manifest, download queue or eviction policy.
- Download progress, "Last updated just now" and the package description are
  simulated or supplied demo copy, not operational data.

## 6. API and Data Deltas

No API calls, SQLite, SecureStore, geolocation, camera, push notifications or
background tasks are used in this prototype. All map, route, hazard, drainage,
weather and ETA values are supplied demo copy or local schematic graphics.

Before production integration:

| Area                | Delta                                                                                              | Status |
| ------------------- | -------------------------------------------------------------------------------------------------- | ------ |
| Identity            | Supabase Auth session, identifier policy and role checks per FSD-FR-021 to 023 and CR-001           | Open   |
| Guest access        | Session or anonymous-device policy, limits, home identity and sign-out behaviour                    | Open   |
| Report submission   | Depth/passability/notes payload, validation, idempotency and confirmation screen                     | Open   |
| Report evidence     | Native camera/file picker, MIME and size limits, multipart upload and storage                        | Open   |
| Report metadata     | GPS permission, coordinate rounding, EXIF extraction, capture time and device time                  | Open   |
| SOS                 | Create request with fresh location and optional note; acknowledgement, assignment and resolution    | Open   |
| SOS telephony       | Native `tel:` hand-off, confirmation, fallback and emergency-service disclosure                      | Out of scope — removed |
| Vehicle profile     | Decide whether saved clearance profiles are in scope; if yes, add a requirement and contract        | Open   |
| Status labels       | Define data sources for "Live Flood Network", "Civic Route Alert Active", "Sensor Online" and "Live SafeFlow Routing" | Open   |
| Destination search  | Seeded road-node search, autocomplete, map pin and selected-destination contract                    | Open   |
| Routing             | Route request, distance, ETA, start/end snapping and alternative-route contract                     | Open   |
| Hazard stream       | Verified hazard subscription, route intersection, reroute and alert-detail contract                 | Open   |
| Drainage telemetry  | Pump capacity, blocked segments, tide level, estuary surge and update timestamps                    | Open   |
| Weather             | Temperature and condition source                                                                | Open   |
| Map                 | MapLibre React Native, tile source, satellite style and offline cached graph; offline region packages proposed under CR-002 | Later  |
| Map overlays        | Hazard polygons, route polyline, water-level tags and map labels                                    | Later  |
| Quick picks         | Work, Home, gym and mall destinations, custom pins and persistence                                  | Open   |
| Recent searches     | Safe-search history, reuse, clear-history behaviour and privacy                                     | Open   |
| Profile data        | Session profile, clearance unit conversion, verified contact rows, plate and role                   | Open   |
| Profile settings    | Notification preference, help/support, logout and persistence                                       | Open   |
| Sensor feed         | Telemetry subscription, connection state and last-reading timestamp                                 | Open   |
| App version         | Source of displayed version and build metadata                                                     | Open   |
| Bottom navigation   | Report, Rescue and Profile routes implemented; notification and full-drainage-map destinations remain pending | Partial |
| Offline             | SQLite cache, queue and sync per FSD-FR-068 to 071                                                  | Later  |
| Offline map package | Region manifest, package size, version, checksum, tile/graph/hazard snapshot, expiry and download URL | Open — CR-002 |
| Offline map storage | File layout, size cap, eviction, integrity check, resume and update policy                          | Open — CR-002 |
| Native distribution | EAS project, bundle identifiers, signing, TestFlight/internal testing and store accounts             | Open   |
| Background location | `expo-location` + `expo-task-manager`, permission copy and store justification                        | Open   |
| Push                | `expo-notifications`, device registration and permission flow                                      | Later  |

## 7. Implementation

The screens live in Expo Router routes. A tab group owns the four primary
destinations; authentication and the route picker sit outside it.

| Path                        | Purpose                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `src/app/_layout.tsx`       | Root stack and `AuthProvider`                                   |
| `src/app/index.tsx`         | Splash, sign-in and driver registration (`/`)                   |
| `src/app/(tabs)/_layout.tsx`| Tab bar: Map, Report, SOS, Profile                              |
| `src/app/(tabs)/home.tsx`   | Home & Map with `react-native-maps` and the hazard summary      |
| `src/app/(tabs)/report.tsx` | Report Hazard — visual shell, no upload yet                     |
| `src/app/(tabs)/sos.tsx`    | SOS Rescue Dispatch — posts to `/api/v1/sos`                    |
| `src/app/(tabs)/profile.tsx`| Citizen Profile, clearance in cm, sign-out                      |
| `src/app/route.tsx`         | Destination entry and the flood-safe / direct route comparison  |
| `src/app/offline.tsx`       | Offline Maps — labelled final-product placeholder (CR-002)      |
| `src/api.ts`                | API client: login, register, verification, SOS                  |
| `src/auth.tsx`              | Auth context shared by the tabs                                 |
| `app.json`                  | Expo configuration, icons and the router root                   |
| `assets/`                   | App icon, adaptive icon and splash assets                       |

Validation:

```bash
cd metroflow-mobile
bun install
bunx tsc --noEmit
bun run web
```

Set `EXPO_PUBLIC_API_BASE_URL` in `.env` so the app can reach the API. The Map,
Report, SOS and Profile tabs and the route picker render without a backend; SOS
submission and sign-in need one.

This is not a substitute for an iOS/Android device test. `expo start` runs the
app against Expo Go or a development build; it does not create signed native
binaries. The map uses `react-native-maps` with the platform provider, and the
avatar is local initials rather than a remote image.

## 8. Open Decisions

| ID     | Decision                                                                                       | Owner        | Status             |
| ------ | ---------------------------------------------------------------------------------------------- | ------------ | ------------------ |
| OD-D01 | Is the login identifier email only, or email or phone?                                          | Client / FSD | Open               |
| OD-D02 | Are guest and skip access in scope, and what can those sessions do?                             | Client       | Open               |
| OD-D03 | Is pre-authentication SOS in scope, and what is the location/rate limit?                        | Client       | Open               |
| OD-D04 | Are saved safe corridors and clearance profiles in scope?                                       | Client       | Open               |
| OD-D05 | Adopt the driver navy/brand palette or align it with the admin palette?                         | Client       | Open               |
| OD-D06 | What are the destinations for Report, Rescue, Profile, notifications, drainage map and hazard detail? | Design       | Answered for Report/Rescue/Profile; others open |
| OD-D07 | What are the native distribution, EAS, bundle-identifier, icon and store-account requirements?  | Engineering  | Open               |
| OD-D08 | What data drives the status labels?                                                             | Client       | Open               |
| OD-D09 | Which native capabilities are pilot must-haves: background location, push, offline SQLite or cached road graph? | Client / Engineering | Open |
| OD-D10 | Use Inter or Plus Jakarta Sans across the driver app, and how should the two palettes be reconciled? | Client / Design | Open     |
| OD-D11 | Which map provider and tile style are required, and is the satellite aesthetic mandatory? Offline tile packs are proposed under CR-002. | Client / Engineering | Open |
| OD-D12 | Which drainage, pump, tide, weather and estuary values are demo copy, and which contracts feed them? | Client / FSD | Open     |
| OD-D13 | Is the five-item bottom navigation in scope for the pilot, and what do Report, Rescue and Profile open? | Client / Design | Routes answered; pilot scope open |
| OD-D14 | Should guest sessions show the supplied "Carlos Reyes" identity or an anonymous state?            | Client / Design | Open           |
| OD-D15 | Are filter chips, quick picks, recent searches, custom pins and route options interactive?        | Client / Design | Open           |
| OD-D16 | Should turn-by-turn, active navigation, hazard detail and full drainage map be supplied next?     | Client       | Open               |
| OD-D17 | Confirm the report depth vocabulary, required-field validation and whether local depth/passability/notes state persists or submits. | Client / FSD | Open |
| OD-D18 | What confirmation, offline queue, acknowledgement, assignment and resolution states follow report submission and SOS dispatch? | Client / Design | Open |
| OD-D19 | Native telephone hand-off for SOS | Client / Engineering | Answered — out of scope under CR-001 §3.2; action removed, static 911 instruction retained |
| OD-D20 | Which "Live Dispatch Sync", "Active Geo-Lock", sensor telemetry, dispatch count and monitoring claims are real? | Client / FSD | Open |
| OD-D21 | Which profile fields are authoritative and verified, how is `280 mm` clearance converted, and what does Log Out do? | Client / FSD | Open |
| OD-D22 | Is the notification switch a real push-permission control, and what do Help & Support actions do? | Client / Engineering | Open |
| OD-D23 | For final-product offline maps: which region boundaries and provider licence apply, and what are the package contents, size cap, storage limit, auto-update consent, signed manifest and stale-data policy? | Client / Engineering | Open — CR-002 |
| OD-D24 | For final-product Sentinel-1 observations: which Copernicus access route and credential type, product level, processing service/algorithm, validation method, confidence and publish threshold, revisit/latency target, licence/attribution and offline retention apply? | Client / Engineering | Open — CR-003 |

## 9. Design Gate Checklist

- [x] Supplied splash/login source archived
- [x] Supplied map/routing source archived
- [x] Supplied report/SOS source archived
- [x] Supplied profile source archived
- [x] Splash, login, home, set destination, route, report, SOS and profile screens identified
- [x] Eight supplied screens translated into the Expo prototype
- [x] Offline Maps final-product design placeholder added
- [x] Expo Router, fonts, icons, schematic map and design tokens established
- [x] Web smoke test at `375 × 812` completed without console errors
- [ ] All driver screens received
- [ ] Screen map complete against FSD-FR-054 to FSD-FR-074
- [ ] OD-D01 to OD-D24 resolved
- [ ] Native build and device test completed
- [ ] API and data deltas accepted
- [ ] Accessibility review completed
- [ ] `375 × 812` visual review signed off
- [ ] Design gate approved
- [ ] CR-001 approved
- [ ] CR-002 approved
- [ ] CR-003 approved

Production work remains blocked until the unchecked items are closed.

## 10. Traceability Summary

| FSD / rule | Screen or affordance                            | Status               |
| ---------- | ----------------------------------------------- | -------------------- |
| FSD-FR-018 | Login email and password fields                 | Prototype            |
| FSD-FR-019 | Password reveal and hide                        | Prototype            |
| FSD-FR-020 | Forgot-password affordance                      | Prototype notice     |
| FSD-FR-021 | Supabase Auth and invalid-credential handling   | Not implemented      |
| FSD-FR-022 | Session maintenance and sign-out                | Not implemented      |
| FSD-FR-023 | Role restrictions                               | Not implemented      |
| FSD-FR-054 | Destination entry                               | Prototype — static destination; no search |
| FSD-FR-055 | Route request                                   | Prototype — CTA only; no request      |
| FSD-FR-056 | Active route and route summary                  | Prototype — visual summary only       |
| FSD-FR-057 | Turn-by-turn instructions                       | Not supplied                          |
| FSD-FR-058 | GPS instruction advance and arrival             | Not supplied                          |
| FSD-FR-059 | Verified hazard event stream                    | Static alert UI only                  |
| FSD-FR-060 | Hazard intersection detection                   | Not implemented                       |
| FSD-FR-061 | Automatic reroute                               | Not implemented                       |
| FSD-FR-062 | Manual refresh and alternatives                 | Static alternatives only              |
| FSD-FR-063 | Proximity alert                                 | Static hazard banner only             |
| FSD-FR-064 | Hazard alert detail                             | Entry only — detail pending           |
| FSD-FR-065 | Flood report depth selector                     | Prototype — local selector; no submit |
| FSD-FR-066 | Camera or file attachment                       | Prototype — Add Photo opens pending   |
| FSD-FR-067 | GPS, EXIF and timestamps                        | Not implemented — static location     |
| FSD-FR-068 | Offline pending report state                    | Not implemented                       |
| FSD-FR-069 | Offline queue synchronisation                   | Not implemented                       |
| FSD-FR-070 | Local cache of graph, hazards and route         | Not implemented                       |
| FSD-FR-071 | Cached graph navigation                         | Not implemented                       |
| FSD-FR-072 | Throttled telemetry                             | Not implemented                       |
| FSD-FR-073 | One-tap SOS with location                       | Prototype — SOS screen and static location; no request |
| FSD-FR-074 | SOS acknowledgement, assignment and resolution  | Not supplied                          |
| No dedicated FSD requirement | Citizen Profile and settings     | Prototype — demo data; local settings only |
| CR-002 (FSD-FR-094 to 100 proposed) | Offline Maps download, readiness, storage and stale-data states | Design placeholder — simulated; no storage or network |
| CR-003 (FSD-FR-101 to 107 proposed) | Sentinel-1 observation review, verified satellite hazard, freshness and offline snapshot | Not implemented — advisory satellite source proposed |
| CR-001 §3.2; no FSD requirement | Native telephony and Civic Karma | Removed from prototype |
