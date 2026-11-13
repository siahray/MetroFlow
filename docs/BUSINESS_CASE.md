# Project Business Case

## MetroFlow — Intelligent Urban Mobility and Flood Simulation System

**Version 2.0** — consolidated baseline including the driver app, live hazard
publication, fleet dispatch, sensor ingestion, provider keys, template-sourced
UI, the Mapbox dry-state routing handoff, and the pilot road network scoped to
Quezon City (which also found NFR-001/002/019 not currently met at this scale
— see `BRD.md`), with every cost figure in
§7–§11 now filled — OPEX against each vendor's current rate card, CAPEX/
training/maintenance/benefits against reasonable market-based placeholder
rates (labelled `illustrative` throughout); §12's milestone table also fills
the M9 panel-defence date with a planning projection (4 Dec 2026, from the 18
Aug 2026 start) rather than leaving it open. This is a **planning projection,
not a quotation or a funding commitment**: swap in real institutional and client
figures before treating any number here as an actual budget.

## 1. Executive Summary

| Item            | Detail                                                          |
| --------------- | --------------------------------------------------------------- |
| Project Sponsor | «Project Sponsor»                                               |
| Business Owner  | «Client Representative» — LGU Operations (CDMO)                 |
| Project Cost    | PHP 634,710 (illustrative: ₱588,500 CAPEX + ₱46,210 Year-1 OPEX, §7) |
| Recommendation  | **APPROVE** — Option 4, the scoped pilot, subject to conditions |

During a rain event, the LGU operations centre decides where to send rescue
resources using information it cannot verify. Two failures follow: responders are
committed to roads that are already impassable, and decisions cannot be reviewed
afterwards.

Four alternatives were assessed: continue as-is, formalise a manual GIS
procedure, licence a commercial platform, or build a focused pilot. The
recommended option is **build the pilot** — not because building is inherently
cheaper, but because the two capabilities that create the value
(clearance-aware routing over the LGU's own road graph, and a triage record the
LGU owns) are the two that commercial platforms customise least and charge most
for.

The pilot is scoped to one corridor and deliberately excludes public App Store
and Play Store releases, real CCTV, carrier-grade SOS and multi-LGU tenancy. It
includes the driver side of the loop: a native Expo app, live hazard
publication, fleet dispatch and labelled sensor ingestion. That increment is
costed as its own line item (§7) so its cost remains visible alongside the
rest of the build.

Monetary figures (13 Nov 2026) are an **illustrative projection** for planning
discussion, not a quotation or a funding commitment: OPEX lines are priced
against each vendor's own current rate card (§7.2); CAPEX, benefit rates and
the NPV model use reasonable market-based placeholder assumptions, each
labelled where it appears, so the figures can be replaced with real
client/institutional numbers without reworking the document's structure.

## 2. Business Need and Problem Statement

| Element                | Summary                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Problem                | No shared, current picture of road passability; unstructured reports; no audit trail; no warning reaches drivers (BRD, BR-001 to BR-018) |
| Who is affected        | Dispatchers, rescue units, MDRRMC coordinators, citizens awaiting rescue                                                                 |
| Cost of the status quo | Aborted dispatches, duplicated effort, delayed response, no learning between events                                                      |
| Opportunity            | Convert verbal coordination into verified, recorded decisions using data the LGU already holds                                           |
| Window                 | The capability is useful before the next rainy season; the pilot fits one academic term                                                  |

Current process: a citizen or field unit reports flooding by call, message or
radio; the dispatcher records it informally; verification depends on familiarity
with the area or a second call; a unit is assigned without a verified route; the
outcome is not captured in a form that supports review. Nothing verified reaches
the driver already on the road, so the same hazard is discovered again by each
vehicle in turn.

The full problem statement, personas and business requirements are in
[BRD.md](BRD.md).

## 3. Project Objectives

| ID     | Objective                                               | Success Measure                                         |
| ------ | ------------------------------------------------------- | ------------------------------------------------------- |
| BO-001 | Reduce time from report received to triage decision     | Median minutes below the M1 baseline `[TBC]`            |
| BO-002 | Prevent dispatch into impassable roads                  | Zero aborted dispatches per event                       |
| BO-003 | Reduce duplicated reports entering the queue            | Duplicate screening improves against baseline `[TBC]`   |
| BO-004 | Make every decision auditable                           | 100% of decisions carry actor, timestamp and action     |
| BO-005 | Keep the system available during a declared event       | Availability `[TBC]`                                    |
| BO-006 | Give responders a route that respects vehicle clearance | Every route response is passable or an explicit refusal |
| BO-007 | Keep drivers out of verified flood hazards              | Every active route reroutes or alerts before a hazard   |
| BO-008 | Shorten field observation to verified hazard            | Median report-to-decision time below baseline `[TBC]`   |

## 4. Options Analysis

### 4.1 Options considered

| ID  | Option                   | Description                                                                         |
| --- | ------------------------ | ----------------------------------------------------------------------------------- |
| O1  | **Do nothing**           | Continue radio, phone and social-media coordination                                 |
| O2  | **Manual GIS procedure** | Dispatchers maintain a shared map and spreadsheet by hand                           |
| O3  | **Commercial platform**  | Licence an existing incident-management or fleet-tracking platform                  |
| O4  | **Build the pilot**      | Build simulation, routing, LGU triage and driver warning against the LGU's corridor |
| O5  | **Hybrid**               | Licence a commercial platform and build only the routing engine                     |

### 4.2 Evaluation criteria

| Criterion                       | Weight | Why it matters                                           |
| ------------------------------- | ------ | -------------------------------------------------------- |
| Fit to operational need         | 30%    | The tool must match how dispatch actually works          |
| Cost of ownership (3 years)     | 20%    | LGU budgets are annual and constrained                   |
| Time to first operational value | 15%    | Value must arrive before the next flood season           |
| Control and data ownership      | 15%    | Incident and personal data must remain under LGU control |
| Maintainability and skills      | 10%    | The LGU must sustain it after handover                   |
| Scalability to more corridors   | 10%    | The pilot must extend without a rewrite                  |

### 4.3 Assessment

Scores are the team's assessment on a 1–5 scale and must be validated with the
client at M1.

| Criterion (weight)               | O1 Do nothing | O2 Manual GIS | O3 Commercial | O4 Build pilot | O5 Hybrid |
| -------------------------------- | ------------- | ------------- | ------------- | -------------- | --------- |
| Fit to operational need (30%)    | 1             | 3             | 3             | **5**          | 4         |
| Cost of ownership (20%)          | **5**         | 4             | 2             | 4              | 3         |
| Time to first value (15%)        | **5**         | 4             | 3             | 3              | 3         |
| Control and data ownership (15%) | 1             | 4             | 2             | **5**          | 3         |
| Maintainability and skills (10%) | 2             | 2             | 3             | **4**          | 2         |
| Scalability (10%)                | 1             | 2             | **4**         | 4              | 4         |
| **Weighted score**               | **2.50**      | **3.30**      | **2.75**      | **4.30**       | **3.30**  |

### 4.4 Why the alternatives were not recommended

- **O1 Do nothing** is the cheapest and the most expensive. It preserves a
  failure mode: decisions that cannot be verified or reviewed.
- **O2 Manual GIS** improves the shared picture but depends on a dispatcher
  updating a map during the busiest moment, and cannot answer "can this vehicle
  pass?" without manual judgement.
- **O3 Commercial platform** provides incident workflow and fleet tracking, but
  flood-depth modelling and clearance-aware routing over a local road graph are
  absent or professional-services work. Licensing recurs, and incident data
  leaves LGU control.
- **O5 Hybrid** is credible but requires two procurements and an integration
  contract, which is heavier than the pilot justifies.

## 5. Strategic Alignment

| Alignment                          | How the project contributes                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Disaster risk reduction (RA 10121) | Supports preparedness and response coordination with verifiable road status            |
| Data privacy (RA 10173)            | Minimises reporter data, restricts access and keeps incident records under LGU control |
| Local government digitalisation    | Reuses existing devices and a browser; no new hardware required for the pilot          |
| Academic programme                 | Applies simulation, graph search and software engineering practice to a real problem   |

## 6. Recommended Solution

**Option 4 — build the pilot.** It is the only option that delivers both
capabilities that create the operational benefit, keeps data under LGU control,
and fits the academic term.

The recommendation is conditional on:

1. The driver-app scope boundary held: native Expo app with EAS internal
   distribution rather than a public store release, labelled demo CCTV,
   simulated gauges where real data is unavailable, and no carrier-grade SOS.
2. Baseline data collection scheduled in M1 so benefits can be measured.
3. Authentication and RBAC (BR-009) delivered as a release gate, not
   deferred past acceptance: sign-in, roles and route-level enforcement before
   any real data is handled.
4. A decision review at M8, before final defence, using the conservative
   scenario.
5. Every simulated sensor or demo video source labelled as such in the product.

## 7. Cost Estimate

### 7.1 CAPEX

Illustrative projection, not a quotation or a funding request (`CA-001`):
development effort is student time, costed at a market junior-developer rate
so total cost of ownership is honest, not because cash changes hands. Rate
basis: ₱40,000/month, the midpoint of the ₱35,000–50,000/month local-employer
range for an entry-level developer in Metro Manila ([itsourcecode.com](https://itsourcecode.com/blogs/how-much-does-a-software-engineer-earn-in-the-philippines/),
[secondtalent.com](https://www.secondtalent.com/developer-rate-card/philippines/),
checked 13 Nov 2026), applied across the actual 4-person team at the
allocations in the PMP's Resource Management table (one person holds more
than one of that table's 10 listed roles, as its own note says).
"Person-months" below is a unit of effort, not a headcount: 4 people working
for 1 month is 4 person-months, the same as 1 person working for 4 months —
it is not a count of 9 or 4 separate people.

| No. | Category                               | Basis                      | Amount (PHP) |
| --- | -------------------------------------- | -------------------------- | ------------ |
| 1   | Baseline development effort            | 9 person-months (4 people × ≈2.3 months, 18 Aug – 27 Oct 2026) × ₱40,000 | ₱360,000     |
| 2   | Native app, realtime, fleet increment  | 4 person-months (4 people × ≈1 month, 21 Oct – 7 Nov 2026) × ₱40,000 | ₱160,000     |
| 3   | Test devices and data                  | 2 budget Android test phones, field data/SIM allowance | ₱15,000      |
| 4   | Contingency                            | 10% of the above (₱535,000) | ₱53,500      |
|     | **Total CAPEX**                        |                            | **₱588,500** |

### 7.2 OPEX

Priced against each vendor's own published rate card, fetched 13 November
2026 (sources in §7.2.1), converted at ≈₱61.5/USD (mid-market, mid-Nov 2026 —
re-check before budgeting, FX moves). Lines 1, 2, 6 and 9 are priced at the
**Pro/paid tier**, not Free, because the pilot's own `NFR-003` (99% uptime
during a declared event) is incompatible with Supabase Free's pause after a
week of inactivity and Vercel Hobby's non-commercial-use terms — this revises
`CA-002`'s original "free tier suffices" assumption now that the system is a
running pilot, not a prototype. Usage is still well inside every paid tier's
included allowance at pilot scale, so the figures below are the **plan
minimum**, not a volume estimate; overage rates are given so the line can be
re-priced if usage grows.

| No. | Category                          | Basis                          | Year 1        | Year 2        | Year 3        |
| --- | --------------------------------- | ------------------------------ | -------------- | -------------- | -------------- |
| 1   | Hosted database (Supabase)        | Pro plan, $25/mo ([supabase.com/pricing](https://supabase.com/pricing)) | ₱18,450 | ₱18,450 | ₱18,450 |
| 2   | Application hosting               | Vercel Pro, $20/mo/seat, 2 projects, 1 seat ([vercel.com/pricing](https://vercel.com/pricing)) | ₱14,760 | ₱14,760 | ₱14,760 |
| 3   | Domain and TLS                    | `.ph` registrar, ≈₱2,500–3,500/yr; TLS auto-issued free by Vercel | ₱3,000    | ₱3,000    | ₱3,000    |
| 4   | Training and handover             | 2 days × ₱5,000/day facilitator rate, ≤10 users (`CA-004`) | ₱10,000   | —         | —         |
| 5   | Maintenance and support           | 17.5% of CAPEX lines 1+2 (₱520,000), midpoint of the 15–20% band | —         | ₱91,000   | ₱91,000   |
| 6   | EAS build and app distribution    | Free tier covers it at pilot cadence (15 Android + 15 iOS builds/mo, [expo.dev/pricing](https://expo.dev/pricing)); Starter $19/mo + credit if build volume grows | ₱0 | ₱0 | ₱0 |
| 7   | Evidence photo storage            | `bytea` in the `incident_reports` row (ADR-023), not a separate object-storage service — folded into line 1's 8 GB database / 100 GB file-storage allowance | included in line 1 | included in line 1 | included in line 1 |
| 8   | Redis / event infrastructure      | Not provisioned in the hosted deployment — the event stream polls Postgres instead (`docs/TSD.md` §5.3, ADR-015); Redis runs only in the local dev `docker-compose` stack | ₱0        | ₱0        | ₱0        |
| 9   | Map, weather and imagery services | Mapbox Directions (dry-state routing): 100,000 free requests/mo, then $2.00/1,000 ([mapbox.com/pricing](https://www.mapbox.com/pricing)). OpenWeather, OpenTopography and Copernicus stay free/offline (`CA-009`) | ₱0        | ₱0        | ₱0        |
|     | **Total OPEX**                    |                                | **₱46,210** | **₱127,210** | **₱127,210** |

Lines 1–3 and 6–9 are priced against each vendor's current rate card (§7.2.1).
Lines 4 and 5 are illustrative placeholder rates, not institutional
quotations — a ₱5,000/day facilitator rate and a 17.5% maintenance figure
(the midpoint of the stated 15–20% band), applied so the Total OPEX row is a
complete number rather than a partial one. Replace both with the academic
adviser/client's own rate before this projection is treated as a real budget.

#### 7.2.1 Sources

| Line | Vendor page checked 13 Nov 2026 |
| ---- | -------------------------------- |
| 1    | [supabase.com/pricing](https://supabase.com/pricing) — Pro $25/mo base, 8 GB DB, 250 GB egress, 100 GB file storage, $10/mo compute credit included; overage $0.125/GB DB, $0.09/GB egress |
| 2    | [vercel.com/pricing](https://vercel.com/pricing) — Pro $20/mo/seat, $20 usage credit, 1 TB Fast Data Transfer included; overage $0.128/Active-CPU-hour, $0.15/GB transfer beyond 1 TB |
| 6    | [expo.dev/pricing](https://expo.dev/pricing) — Free: 15 Android + 15 iOS builds/mo; Starter $19/mo + $45 build credit; overage $1–$4/build by platform and worker size |
| 9    | [mapbox.com/pricing](https://www.mapbox.com/pricing) — Directions API: 100,000 free requests/mo, then $2.00/1,000 (100,001–500,000 band) |

### 7.3 Cost assumptions

| ID     | Assumption                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| CA-001 | Development effort is student time and is not cash-funded, but is costed at an institutional rate so total cost of ownership is honest |
| CA-002 | ~~Free tiers of each service suffice for the pilot; paid tiers apply only at production scale~~ — superseded 13 Nov 2026: Supabase and Vercel are priced at their paid tier in §7.2 because `NFR-003` (99% uptime during a declared event) is incompatible with Supabase Free's pause-after-a-week and Vercel Hobby's non-commercial terms; usage still sits well inside the paid tier's included allowance |
| CA-003 | All libraries used are open source; no licence fees                                                                                    |
| CA-004 | Training is delivered to a small group (≤ 10 users) at the operations centre                                                           |
| CA-005 | Year-2 maintenance assumes dependency and security updates only, no major feature work                                                 |
| CA-006 | The driver client is a native Expo app. EAS internal builds (§7.2 line 6) are the preferred no-cost path for the pilot. If a public store release is ever pursued (out of pilot scope), published fees are Apple Developer Program $99/year (≈₱6,090) and Google Play one-time $25 (≈₱1,538); neither is budgeted here |
| CA-007 | Evidence storage grows with report volume; the pilot assumes a capped volume (4 MB/report, `report_photo_max_bytes`) and a 90-day retention period as an illustrative placeholder, pending the client's own records-retention policy |
| CA-008 | Simulated gauges and demo CCTV carry no data-supplier licence in the pilot                                                             |
| CA-009 | Mapbox Directions usage (dry-state routing) stays within its 100,000-request/month free tier at pilot scale; overage is $2.00 per 1,000 requests ([mapbox.com/pricing](https://www.mapbox.com/pricing), checked 13 Nov 2026). OpenWeather, OpenTopography and Copernicus remain free/offline, no change |

## 8. Benefits Assessment

| ID      | Benefit                                  | Type       | Measurement                                             | Owner           |
| ------- | ---------------------------------------- | ---------- | ------------------------------------------------------- | --------------- |
| BEN-001 | Faster triage decisions                  | Tangible   | Median minutes report → recorded decision               | Operations lead |
| BEN-002 | Fewer dispatches into impassable roads   | Tangible   | Aborted dispatches per event                            | Operations lead |
| BEN-003 | Less duplicated effort                   | Tangible   | Duplicate reports screened per event                    | Operations lead |
| BEN-004 | Accountable decision trail               | Tangible   | Percentage of decisions with actor, time and rationale  | MDRRMC          |
| BEN-005 | Shared situational picture               | Intangible | Dispatcher feedback; one source of truth in use         | Operations lead |
| BEN-006 | Institutional learning                   | Intangible | Post-event review possible from exported logs           | MDRRMC          |
| BEN-007 | Reusable technical capability            | Intangible | Routing and simulation reused by the driver app         | «Project Team»  |
| BEN-008 | Drivers avoid verified flooded roads     | Tangible   | Hazard encounters per 100 active routes                 | Operations lead |
| BEN-009 | Faster field observation to verification | Tangible   | Median report submission → publish minutes              | Operations lead |
| BEN-010 | Better use of available rescue units     | Tangible   | Units assigned within the target time / available units | Rescue command  |

**Benefit monetisation**

Illustrative placeholder rates, not client HR data: ₱120/hour for LGU
operations/dispatcher time (≈1.3× the ₱755/day / ₱94.4/hour NCR minimum wage
under Wage Order NCR-27, [DOLE/RTWPB-NCR, Jul 2026](https://www.dzrh.com.ph/post/peso60-ncr-minimum-wage-increase-takes-effect-daily-pay-now-at-peso755)),
₱150/hour for rescue-unit field time, and 10 declared flood events/year as a
planning assumption for Metro Manila's rainy season. Replace every value in
this table with the client's own HR and operations data before using it for
an actual funding decision.

| Benefit | Unit                                               | Unit value          | Source                         |
| ------- | -------------------------------------------------- | ------------------- | ------------------------------ |
| BEN-001 | Hours per event × events per year                  | ₱120/hr × 3 hrs/event × 10 events/yr ≈ ₱3,600/yr | Client HR data (illustrative) |
| BEN-002 | Aborted dispatches avoided × cost per dispatch     | ₱1,500/dispatch (fuel + crew time) × 2/event × 10 events/yr ≈ ₱30,000/yr | Fuel, vehicle wear, crew hours (illustrative) |
| BEN-003 | Hours saved per event                              | ₱120/hr × 1 hr/event × 10 events/yr ≈ ₱1,200/yr | Client HR data (illustrative) |
| BEN-004 | Avoided investigation effort per disputed decision | ₱800/decision (≈4 hrs at a ₱200/hr senior/MDRRMC rate) × 1/yr ≈ ₱800/yr | Client estimate (illustrative) |
| BEN-008 | Hazard encounters avoided × cost per incident      | ₱3,000/encounter (recovery/delay, excludes injury and property damage) × 3/event × 10 events/yr ≈ ₱90,000/yr | Insurance and fleet data (illustrative) |
| BEN-009 | Dispatcher minutes saved per verified report       | ₱2/min × 50 min/event × 10 events/yr ≈ ₱1,000/yr | Client HR data (illustrative) |
| BEN-010 | Rescue hours saved per event                       | ₱150/hr × 2 hrs/event × 10 events/yr ≈ ₱3,000/yr | Client HR data (illustrative) |
|         | **Illustrative total monetised benefit**           | **≈₱129,600/yr**    |                                 |

Avoided losses — injury, property damage, liability — are **excluded** from the
calculation. They are the strongest reason to build the system and the weakest
thing to put a number on; they are recorded as a non-monetised benefit.

## 9. Risk Assessment

| Risk                                       | Impact                                  | Mitigation                                                                            |
| ------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------- |
| Model outputs judged unrealistic           | Benefits unrealisable; credibility lost | Declare calibration as configuration; validate against documented events              |
| Route authorisation not delivered          | Cannot be used with real data           | Delivered 27 Oct 2026: tokens plus per-route role checks; rate limiting (TSD LIM-006) gates real data |
| No baseline data                           | Benefits unquantifiable                 | Use audit-trail and risk benefits; collect baseline during the pilot                  |
| Hosted costs exceed the free tier          | Operating cost rises                    | Keep hosting provider-agnostic; the container image is portable                       |
| Provider quota or outage                   | Live rainfall or imagery unavailable    | Manual rainfall, OSM tiles and cached derived data; monitor usage                     |
| Dispatchers reject the tool                | Adoption fails regardless of capability | Usability sessions from M3; keep the radio process running in parallel                |
| A commercial alternative is chosen later   | Sunk cost                               | Publish the API contract so the routing engine outlives the portal                    |
| Personal data incident during testing      | Legal and ethical exposure              | Synthetic data only; RLS verified; no personal data in logs                           |
| Drivers do not adopt the app               | Field evidence stays thin               | Usability tests; QR onboarding; synthetic reports as fallback                         |
| Location data re-identifies a driver       | Privacy breach and legal exposure       | 50 m rounding, salted hash, 24-hour retention, role-only access                       |
| Background location limits on iOS          | Telemetry gaps                          | Foreground-only telemetry; documented limitation                                      |
| Sensor or demo CCTV mistaken for live data | Wrong operational decision              | Label simulated and demo sources in the API and UI                                    |

Full scoring and owners are in [PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md).

## 10. Financial Analysis

The case is expressed as a three-year total cost of ownership with a benefit
comparison, because the pilot's benefits are operational rather than revenue
generating.

```text
NPV      = Σ (B_t − C_t) / (1 + r)^t − C_0        for t = 1..n
ROI      = (Σ B_t − Σ C_t) / Σ C_t × 100%
Payback  = first year in which cumulative (B_t − C_t) ≥ 0
```

All figures below are the illustrative placeholders from §7 and §8, not
client-supplied data — see those sections for the rate assumptions behind
each one.

| Symbol | Meaning                                             | Value   |
| ------ | --------------------------------------------------- | ------- |
| `B_t`  | Monetised benefits in year `t`                      | ≈₱129,600/yr (§8, illustrative) |
| `C_t`  | Costs in year `t`, including maintenance            | Year 1 ₱46,210; Years 2–3 ₱127,210 (§7.2) |
| `C_0`  | Initial investment (development, devices, training) | ₱588,500 (§7.1 Total CAPEX)      |
| `r`    | Discount rate                                       | 10% — a conventional Philippine public-sector social discount rate, illustrative |
| `n`    | Evaluation period                                   | 3 years |

At these figures, Base-case NPV is approximately **−₱508,900**. It stays
negative in strict monetary terms because `C_0` is dominated by non-cash
student labour costed for TCO honesty (`CA-001`), and the strongest benefit —
avoided injury, property damage and liability — is deliberately excluded from
monetisation (§8, directly above). The business case rests on that excluded
value and on `BEN-004`'s accountability benefit, not on a positive financial
NPV; this matches the caution already stated below for the conservative
scenario.

### 10.1 Scenarios

| Scenario     | Benefit realisation                                       | Cost variance | Result |
| ------------ | --------------------------------------------------------- | ------------- | ------ |
| Conservative | 50% of estimated time savings; no dispatch saving claimed | +20%          | NPV ≈−₱760,700 |
| Base         | Estimated time savings; conservative dispatch saving      | As budgeted   | NPV ≈−₱508,900 |
| Optimistic   | Full savings plus duplicate-screening saving              | −10%          | NPV ≈−₱424,300 |

The recommendation does not depend on the optimistic scenario. If the
conservative scenario does not recover costs, the case rests on risk reduction
and BEN-004, and that must be stated plainly to the sponsor. **It does not
recover costs in any of the three illustrative scenarios** — see the NPV
note above for why that is an expected result of this model, not a sign the
pilot is a poor investment.

## 11. Sensitivity Analysis

| Variable              | Change tested        | Effect on NPV |
| --------------------- | -------------------- | ------------- |
| Discount rate `r`     | ±2 percentage points | ≈±₱1,600 — negligible; the model has little long-dated cash flow to discount |
| Maintenance cost      | 15% → 25% of build   | NPV ranges ≈−₱488,400 (15%) to ≈−₱570,400 (25%), a ≈₱82,000 swing |
| Events per year       | −50%                 | NPV ≈−₱670,100, a ≈₱161,200 swing — most benefit lines scale directly with event count |
| Dispatcher time value | −30%                 | ≈−₱1,650 — small; dispatcher-time benefits (`BEN-001`, `003`, `009`) are a minor share of the modelled total next to `BEN-008` |
| Benefit realisation   | Conservative → base  | ≈+₱251,800 — the single largest swing factor in this model |

Computed from the illustrative worksheet above (§8, §10), not client-supplied
baselines — replace the rate and quantity assumptions in §8 and §10 with the
client's own data, and these effects recompute the same way.

## 12. Project Timeline

| ID  | Milestone                           | Target / Actual |
| --- | ----------------------------------- | ---------------- |
| M1  | Charter and requirements approved   | August 20, 2026 — Completed  |
| M2  | Architecture and data design frozen | August 26, 2026 — Completed  |
| M3  | API engine operational              | October 1, 2026 — Completed  |
| M4  | Dispatch portal operational         | October 22, 2026 — Completed |
| M5  | Hardening complete                  | October 25, 2026 — Completed |
| M6  | Baseline documentation accepted     | October 27, 2026 — Completed |
| M7  | Realtime, reports and fleet API     | November 4, 2026 — Completed |
| M8  | LGU map, moderation and dispatch    | November 4, 2026 — Completed |
| M9  | Driver app, sensors and defence     | November 3, 2026 for the engineering; panel defence **projected December 4, 2026** (planning projection, pending the panel's own scheduling) |

Approval is requested at M1. The baseline demonstration (`PROJ_MANAGEMENT_PLAN.md`'s
"Demonstration" row) fell on 28 October 2026, between M6 and the start of the
driver-app increment — it has no separate M-number of its own in this list. The
final demonstration/defence is part of M9. The baseline ran about 10
weeks (18 Aug – 27 Oct 2026); the driver-app increment and the live
flood-state/Mapbox/network-rescope work ran about 3.5 weeks of engineering
(21 Oct – 13 Nov 2026); the projected
defence date above adds a further ≈3 weeks for final documentation and
rehearsal, for a projected ≈15.5-week total engagement (18 Aug – 4 Dec 2026).
This is this document's own planning estimate, not a confirmed institutional
or panel date.

## 13. Governance, Assumptions and Dependencies

### 13.1 Governance

| Decision               | Authority               | Recorded in                        |
| ---------------------- | ----------------------- | ---------------------------------- |
| Scope changes          | «Project Sponsor»       | PMP change control log             |
| Academic acceptance    | «Project Adviser»       | Document approval blocks           |
| Architecture decisions | «Project Team Lead»     | TSD §6 Architecture Decisions      |
| Operational acceptance | «Client Representative» | Charter approval and demo sign-off |

### 13.2 Assumptions and dependencies

| ID    | Statement                                                            | Effect if false                         |
| ----- | -------------------------------------------------------------------- | --------------------------------------- |
| A-001 | A PostGIS-capable database is available                              | Core capability cannot be demonstrated  |
| A-003 | Free or institutional tiers suffice                                  | Additional recurring cost               |
| A-004 | Dispatchers have a modern browser and connectivity                   | Portal unusable during an event         |
| A-007 | Drivers have a smartphone with camera and geolocation                | Driver app cannot be piloted            |
| A-008 | Connectivity can drop during an event                                | Offline mode is essential, not optional |
| C-006 | The driver client is a native Expo app; public store release is a later gate | Distribution limited to EAS/TestFlight for the pilot |
| D-001 | Hosted database credentials are supplied as a repository secret      | Hosted migration not demonstrated       |
| D-003 | Client confirms the pilot corridor                                   | Seed data and demonstration rework      |
| D-004 | Supabase credentials and pilot accounts are supplied at deployment   | Authentication cannot start             |
| D-005 | A persistent evidence volume is available                            | Photos cannot be retained               |
| D-006 | Map and data providers stay within their free or institutional tiers | Degraded map or manual rainfall         |

## 14. Approval Recommendation

Approve **Option 4**, the pilot build, including the driver-app increment, on
the conditions in §6.

| Decision           | Detail                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| Decision requested | Approve Option 4 and the full pilot scope                             |
| Decision maker     | «Project Sponsor»                                                      |
| Decision           | [TBC]                                                                  |
| Date               | [TBC]                                                                  |
| Conditions         | Driver-app scope boundary, authentication/RBAC gate, labelled demo data, Expo native app |
| Budget approved    | PHP 634,710 proposed (§7, illustrative projection — Decision/Date below are genuinely pending, not assumed) |

| Role            | Name                    | Signature | Date  |
| --------------- | ----------------------- | --------- | ----- |
| Project Sponsor | «Project Sponsor»       |           | [TBC] |
| Business Owner  | «Client Representative» |           | [TBC] |
| Project Adviser | «Project Adviser»       |           | [TBC] |
