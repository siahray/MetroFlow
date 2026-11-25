# MetroFlow Sensor Recommendations

*Last updated: 24 November 2026*

---

> **Status:** Sections 1–7 are implementation recommendations for the current pilot.
> **Section 8 is a future-ideas appendix only** — not approved, not committed scope, not in the
> BRD/FSD/TSD, and not an implementation plan. Item 8.4 in particular revisits CCTV, which the
> current scope explicitly excludes.

---

## 1. Recommendation summary

MetroFlow should not treat the current Open-Meteo rain feed and GloFAS river model as
authoritative real-time instruments. They are free, advisory-only inputs: one virtual
rain gauge covering the whole corridor and one coarse daily model at a single river
grid cell. They are suitable for a pilot, triage context, and defence demonstration,
but not for life-safety decisions or automatic road closures.

For a real LGU deployment, combine physical sensors with agency feeds and keep every
breach advisory until a dispatcher confirms it (BRULE-012, BRULE-016).

## 2. Recommended sensor stack

| Purpose | Sensor | Placement | Notes |
| --- | --- | --- | --- |
| Rainfall | Tipping-bucket or optical rain gauge, e.g. Davis Vantage Pro2, Hydreon RG-11, Vaisala WXT530 | Barangay halls, schools, evacuation centres, high points | Rain is an early warning, not proof of street flooding. Report in `mm/hr`. |
| River level | Radar/ultrasonic level sensor, e.g. Vaisala WMT700, Siemens SITRANS LR, MaxBotix MB7389 | Bridges and culverts on Marikina/Pasig tributaries | Best flood signal. Needs a calibrated stage–discharge relationship. Report level in `cm` to match project units. |
| River backup | Pressure transducer / level logger, e.g. Solinst Levelogger, In-Situ TROLL | Stilling wells where radar mounting is difficult | Needs anti-fouling maintenance and periodic verification. |
| Road depth | Radar/ultrasonic distance sensor over the road | Known low points: underpasses, intersections, drainage bottlenecks | Directly answers whether a vehicle can pass. Report depth in `cm`. |
| River discharge | GloFAS or a rated river-level station converted to discharge | Existing river points | Discharge is `m³/s`, not a depth. Keep labelled `MODELLED` unless computed from a calibrated local rating curve. |
| Agency telemetry | PAGASA / MMDA / DPWH feeds via data-sharing agreement | Existing official stations | More credible than free global models when available; availability must be negotiated. |
| Static risk | Project NOAH hazard maps | Planning and map layer only | Susceptibility, not live telemetry. Use for caution/route cost only while it is raining. |
| Field confirmation | Driver reports, SOS, dispatcher notes | Whole corridor | Not sensors, but essential for validating model and sensor advisories. |

## 3. Minimum credible pilot

- 3–5 rain gauges distributed across the corridor, not one virtual gauge.
- 2 river-level stations on the main flood-prone channels.
- 4–6 road-depth sensors at the worst underpasses and low points.
- One 4G/LTE gateway or RTU per site, with solar/battery backup, IP67 enclosure,
  local buffering, and “sensor silence” alerting.
- Open-Meteo and GloFAS remain supplementary advisory layers only.

## 4. How sensors integrate today

```text
physical sensor
  → gateway/RTU (ESP32, Raspberry Pi, industrial 4G router)
  → HTTPS POST /api/v1/sensors/readings
  → PostGIS edge advisories
  → GET /api/v1/flood-state
  → routing penalty / admin read-only Active sensors modal
```

### 4.1 Register a sensor once

Use an admin token from `POST /api/v1/auth/login`:

```http
POST /api/v1/sensors
Authorization: Bearer <admin-token>
Content-Type: application/json
```

```json
{
  "sensor_id": "QC-RAIN-01",
  "sensor_type": "RAIN_GAUGE",
  "name": "Barangay Hall rain gauge",
  "latitude": 14.65,
  "longitude": 121.05,
  "threshold_value": 20,
  "threshold_unit": "mm_hr",
  "impact_radius_m": 1500,
  "simulated": false
}
```

### 4.2 Post readings

```http
POST /api/v1/sensors/readings
Authorization: Bearer <admin-token>
```

```json
{
  "sensor_id": "QC-RAIN-01",
  "value": 23.4,
  "unit": "mm_hr",
  "recorded_at": "2026-11-24T05:10:00Z"
}
```

The API validates the sensor, unit and timestamp; stores the reading; marks every
road edge within `impact_radius_m`; writes a `SENSOR_BREACH` audit entry when
`value >= threshold_value`; and feeds `GET /api/v1/flood-state`. The default fresh
window is 30 minutes. A fresh breach gives flagged edges a 1.5× routing penalty,
but it never closes a road. A dispatcher must still confirm and publish a hazard.

## 5. Changes required before real hardware

1. **Extend units.** `backend/schemas.py` currently allows only `m` and `mm_hr` in
   `SensorReadingRequest.unit`, `SensorCreateRequest.threshold_unit` and
   `SensorUpdateRequest.threshold_unit`. Add `cm` for road/river depth and `m3_s`
   for discharge. Keep `mm_hr` for rain.
2. **Allow road-depth sensors.** `create_sensor` in `backend/main.py` currently
   accepts only `RIVER_GAUGE` and `RAIN_GAUGE`. Add `ROAD_DEPTH` (or a mapped
   equivalent) to the validation.
3. **Fix admin types and display.** Update `metroflow-admin/lib/sensors.ts` and
   `metroflow-admin/components/active-sensors-modal.tsx` so the modal shows the
   correct unit for `cm`, `m3_s`, `m` and `mm_hr`, plus `last_reading_at` and a
   stale badge. It currently treats every non-`m` unit as `mm/hr`.
4. **Use a scoped gateway credential.** `POST /api/v1/sensors/readings` requires
   an admin JWT, and `METROFLOW_SENSOR_TOKEN` in `.env.example` is not wired into
   the request path. Add a dedicated sensor-only token/role before deployment;
   do not store a dispatcher admin password on field hardware.
5. **Handle replay safely.** Use stable `sensor_id`s, UTC timestamps and gateway
   deduplication. The advisory upsert will not let an older reading overwrite a
   newer one, but duplicate reading rows are still stored.

## 6. Operational checklist

- NTP-synced clocks; future timestamps are rejected.
- Calibration and threshold review at least before every rainy season.
- Local buffering and retry during cellular outages.
- Suggested cadence: rain 1–5 min, river level 5–15 min, road depth 1 min during events.
- Alert when a sensor stops reporting; silence is not “safe”.
- Keep every sensor labelled `simulated`, `OBSERVED` or `MODELLED` as appropriate.
- Verify `GET /api/v1/flood-state` shows the expected source, kind, freshness and
  advisory state after a test breach.

## 8. Future ideas appendix — not official changes

Everything in this section is a **thought for a later change request**. These are recommendations
for the future only — **not official changes, just thoughts for future changes**. They do not
change the current implementation, scope, FSD/TSD/BRD, or approved baseline.

### 8.1 Flood-depth estimation from a submitted report photo

**Idea:** when a driver submits a report with a photo, estimate the water depth in **cm** from
known-size reference objects in the image, then show it as an *unconfirmed advisory* on the
admin side.

**Why it is not trivial:** a single photo has no absolute scale by itself. A plate, post, or curb
only helps if the system knows its real dimensions and accounts for perspective. The output must
therefore carry a confidence score and must never publish or close a road automatically.

**Proposed pipeline:**

1. **Capture context.** Store photo(s), GPS, timestamp, reporter id, camera/EXIF focal length
   when available, and an optional user-tapped reference object.
2. **Quality gate.** Reject or down-rank images that are blurred, at night, heavily reflective,
   or have no visible waterline. Ask the reporter for another angle instead of guessing.
3. **Detect waterline and references.** A vision model segments the water surface and proposes
   candidate references: road posts, railings, curbs, bollards, tyres, and licence plates.
4. **Mark the scale.** The model or the dispatcher marks the reference's top, bottom/ground
   contact, and the point where the water surface crosses it. Prefer surveyed or standard-height
   street furniture; a licence plate is a weak scale cue because its mounting height varies by
   vehicle.
5. **Correct for perspective.** Estimate the horizon/vanishing line and use camera intrinsics to
   convert pixel distances into local scale at the reference's depth.
6. **Estimate depth.** For a vertical reference of known height `H_ref`:

   ```text
   submerged_fraction = (waterline_px - ground_contact_px) / (top_px - ground_contact_px)
   estimated_depth_cm = H_ref_cm × submerged_fraction
   ```

   Combine multiple references with a confidence-weighted median; discard outliers.
7. **Cross-check.** Fuse with nearby rain/river sensors, the flood simulation, NOAH caution,
   and other reports in the same area/time window. A lone low-confidence photo stays a hint only.
8. **Return a structured result.** Suggested fields: `depth_estimate_cm`, `confidence`,
   `method=REPORT_CV`, `references_used`, `uncertainty_cm`, `evidence_crop_uri`, `as_of`.
9. **Human confirmation.** Dispatcher reviews the crop and estimate before approving a hazard.
   It never auto-closes a road (BRULE-012/016).
10. **Privacy.** Detect and blur licence-plate text before storage; keep only the dimensions or
    reference class, not the plate number.

**Validation before any adoption:** controlled flooded-target shots at known depths, multiple
angles/daylight/night, measured mean absolute error and false-breach rate, and a CR-defined
accuracy threshold before the field is shown to dispatchers as anything stronger than advisory.

### 8.2 Electron admin workstation for offline EOC use

**Idea:** package the admin portal as an Electron desktop app for an LGU emergency operations
centre with unreliable connectivity. It would keep a local authenticated cache of the incident
queue, map graph, hazards, vehicles, and recent audits; queue actions locally with `client_id`;
and sync when the network returns. Needs local encryption, explicit conflict rules, audited
device identity, and no duplicate hazard publication. The current Next.js web portal stays the
primary client unless a CR replaces it.

### 8.3 Offline SOS

**Idea:** extend the existing offline report-queue pattern to SOS. The app would store an SOS with
`client_id`, GPS, timestamp, and optional note; show a clear “pending — not yet delivered” state;
and retry on reconnect. It must not claim delivery until the API acknowledges it, must not present
it as a replacement for emergency telephony/SMS, and should encrypt/expire local pending records.
This is distinct from the current out-of-scope native telephony/SMS work.

### 8.4 Admin CCTV views

**Idea:** later, the admin portal could show read-only camera tiles beside an incident for
dispatcher verification. Start with manual viewing only: role-gated access, audited opens,
retention limits, privacy signage, and clear live-vs-recorded labels. No automated detection,
face/plate identification, or automatic closure. Current scope explicitly excludes real CCTV;
this would require its own CR, privacy review, and source agreements.

### 8.5 Sensor health and calibration console

**Idea:** a separate “sensor health” view showing last-seen time, battery, signal, firmware and
calibration due dates, with alerts when a device goes silent or drifts from nearby references.
Today the registry shows `last_reading_at` but the active-sensors modal does not surface freshness,
and silence is never reported as flood or as “safe”. This console would make device reliability
visible without changing the advisory rules. It needs new gateway/telemetry fields and alerting
before anything can be displayed, and it stays advisory-only.

### 8.6 Short-horizon flood nowcasting as an advisory input

**Idea:** use the existing display-only rain/discharge forecast endpoints together with sensor
trends, simulation output and recent reports to estimate depths for the next 1–3 hours, with a
confidence band. That is different from today’s `GET /api/v1/forecast`, which is explicitly kept
out of routing. Any future nowcast must carry `as_of`, confidence and uncertainty, stay a caution
until a dispatcher confirms a hazard, and be validated against known flood events before it is
shown to drivers as more than a hint.

### 8.7 Responder safety recall / depth lock

**Idea:** while a mission is active, compare reported water depth on the unit’s remaining route
against its `clearance_cm` and warn the driver plus the dispatcher when the safety margin is lost,
offering reroute or recall. Current routing already refuses too-deep edges at planning time, but
does not continuously watch an in-progress mission. It needs reliable live depth, unit telemetry
and a human decision — never an automatic order to drive into or out of a flooded road.

### 8.8 Drill mode and after-action review

**Idea:** run a timed flood exercise against a sandbox copy of the network, then replay the
timeline from `event_log`/audit data and score detection, verification and dispatch times. The
existing simulation endpoint generates water depths, but there is no separate exercise mode or
review report. Drill data must never publish real hazards, close roads or page real responders.

### 8.9 Partner advisory feed and public status page

**Idea:** share confirmed hazard advisories with DRRMO/MMDA/DPWH partners through a secured feed
or webhook, and offer a read-only public status map with PII masked. This would need data-sharing
agreements, authentication/rate limits, a privacy review and clear “confirmed vs advisory” labels.
It is not a live telemetry integration and does not change the current sources.

### 8.10 Multi-LGU tenancy

**Idea:** later deployments could host several LGUs in one instance, each with its own road graph,
sensor registry, thresholds, users and branding. Today the deployment is one corridor with one
network. This needs tenant isolation at the database and API layers from the start — retrofitting
it after real incidents exist is risky — and is a separate architecture decision, not a next sprint.

---

## 9. Related documents

- [Technology stack](TECHSTACK.md)
- [API reference](docs/api.md), §9.7 Sensors, telemetry and streams
- [Final TSD](docs/final%20document/TSD.md), limitations LIM-026 to LIM-029
