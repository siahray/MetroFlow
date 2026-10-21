# Project Business Case

## MetroFlow — Intelligent Urban Mobility and Flood Simulation System

## 1. Executive Summary

| Item            | Detail                                                          |
| --------------- | --------------------------------------------------------------- |
| Project Sponsor | «Project Sponsor»                                               |
| Business Owner  | «Client Representative» — LGU Operations (CDMO)                 |
| Project Cost    | PHP [TBC]                                                       |
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

The pilot is scoped to one corridor and deliberately excludes native apps, live
sensors and production identity. That keeps the commitment inside an academic
term while producing a demonstrable, auditable capability.

All monetary figures are `[TBC]` pending quotations. The cost model and formulae
are complete so figures can be inserted without reworking the document.

## 2. Business Need and Problem Statement

| Element                | Summary                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Problem                | No shared, current picture of road passability; unstructured reports; no audit trail (BRD, BR-001 to BR-012) |
| Who is affected        | Dispatchers, rescue units, MDRRMC coordinators, citizens awaiting rescue                                     |
| Cost of the status quo | Aborted dispatches, duplicated effort, delayed response, no learning between events                          |
| Opportunity            | Convert verbal coordination into verified, recorded decisions using data the LGU already holds               |
| Window                 | The capability is useful before the next rainy season; the pilot fits one academic term                      |

Current process: a citizen or field unit reports flooding by call, message or
radio; the dispatcher records it informally; verification depends on familiarity
with the area or a second call; a unit is assigned without a verified route; the
outcome is not captured in a form that supports review.

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

## 4. Options Analysis

### 4.1 Options considered

| ID  | Option                   | Description                                                           |
| --- | ------------------------ | --------------------------------------------------------------------- |
| O1  | **Do nothing**           | Continue radio, phone and social-media coordination                   |
| O2  | **Manual GIS procedure** | Dispatchers maintain a shared map and spreadsheet by hand             |
| O3  | **Commercial platform**  | Licence an existing incident-management or fleet-tracking platform    |
| O4  | **Build the pilot**      | Build simulation, routing and triage against the LGU's pilot corridor |
| O5  | **Hybrid**               | Licence a commercial platform and build only the routing engine       |

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

1. The scope boundary in the charter being held: no native apps, no live sensor
   integration, no production identity provider in this release.
2. Baseline data collection scheduled in M1 so benefits can be measured.
3. Authentication (BR-009) named as the first post-pilot increment, not quietly
   dropped.
4. A decision review at M5, before documentation and defence, using the
   conservative scenario.

## 7. Cost Estimate

### 7.1 CAPEX

| No. | Category              | Basis                      | Amount (PHP) |
| --- | --------------------- | -------------------------- | ------------ |
| 1   | Development effort    | «N» person-months × «rate» | [TBC]        |
| 2   | Test devices and data | «Institution»              | [TBC]        |
| 3   | Contingency           | 10% of the above           | [TBC]        |
|     | **Total CAPEX**       |                            | **[TBC]**    |

### 7.2 OPEX

| No. | Category                   | Basis                          | Year 1    | Year 2    | Year 3    |
| --- | -------------------------- | ------------------------------ | --------- | --------- | --------- |
| 1   | Hosted database (Supabase) | Plan                           | [TBC]     | [TBC]     | [TBC]     |
| 2   | Application hosting        | Plan                           | [TBC]     | [TBC]     | [TBC]     |
| 3   | Domain and TLS             | Registrar                      | [TBC]     | [TBC]     | [TBC]     |
| 4   | Training and handover      | «N» days × «rate»              | [TBC]     | —         | —         |
| 5   | Maintenance and support    | 15–20% of development per year | —         | [TBC]     | [TBC]     |
|     | **Total OPEX**             |                                | **[TBC]** | **[TBC]** | **[TBC]** |

### 7.3 Cost assumptions

| ID     | Assumption                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| CA-001 | Development effort is student time and is not cash-funded, but is costed at an institutional rate so total cost of ownership is honest |
| CA-002 | Free tiers of each service suffice for the pilot; paid tiers apply only at production scale                                            |
| CA-003 | All libraries used are open source; no licence fees                                                                                    |
| CA-004 | Training is delivered to a small group (≤ 10 users) at the operations centre                                                           |
| CA-005 | Year-2 maintenance assumes dependency and security updates only, no major feature work                                                 |

## 8. Benefits Assessment

| ID      | Benefit                                | Type       | Measurement                                            | Owner           |
| ------- | -------------------------------------- | ---------- | ------------------------------------------------------ | --------------- |
| BEN-001 | Faster triage decisions                | Tangible   | Median minutes report → recorded decision              | Operations lead |
| BEN-002 | Fewer dispatches into impassable roads | Tangible   | Aborted dispatches per event                           | Operations lead |
| BEN-003 | Less duplicated effort                 | Tangible   | Duplicate reports screened per event                   | Operations lead |
| BEN-004 | Accountable decision trail             | Tangible   | Percentage of decisions with actor, time and rationale | MDRRMC          |
| BEN-005 | Shared situational picture             | Intangible | Dispatcher feedback; one source of truth in use        | Operations lead |
| BEN-006 | Institutional learning                 | Intangible | Post-event review possible from exported logs          | MDRRMC          |
| BEN-007 | Reusable technical capability          | Intangible | Routing and simulation usable by a future driver app   | «Project Team»  |

**Benefit monetisation**

| Benefit | Unit                                               | Unit value          | Source                         |
| ------- | -------------------------------------------------- | ------------------- | ------------------------------ |
| BEN-001 | Hours per event × events per year                  | «hourly rate» [TBC] | Client HR data                 |
| BEN-002 | Aborted dispatches avoided × cost per dispatch     | [TBC]               | Fuel, vehicle wear, crew hours |
| BEN-003 | Hours saved per event                              | «hourly rate» [TBC] | Client HR data                 |
| BEN-004 | Avoided investigation effort per disputed decision | [TBC]               | Client estimate                |

Avoided losses — injury, property damage, liability — are **excluded** from the
calculation. They are the strongest reason to build the system and the weakest
thing to put a number on; they are recorded as a non-monetised benefit.

## 9. Risk Assessment

| Risk                                     | Impact                                  | Mitigation                                                               |
| ---------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| Model outputs judged unrealistic         | Benefits unrealisable; credibility lost | Declare calibration as configuration; validate against documented events |
| Authentication not delivered             | Cannot be used with real data           | Scope BR-009 as the first post-pilot increment; state the limitation     |
| No baseline data                         | Benefits unquantifiable                 | Use audit-trail and risk benefits; collect baseline during the pilot     |
| Hosted costs exceed the free tier        | Operating cost rises                    | Keep hosting provider-agnostic; the container image is portable          |
| Dispatchers reject the tool              | Adoption fails regardless of capability | Usability sessions from M3; keep the radio process running in parallel   |
| A commercial alternative is chosen later | Sunk cost                               | Publish the API contract so the routing engine outlives the portal       |
| Personal data incident during testing    | Legal and ethical exposure              | Synthetic data only; RLS verified; no personal data in logs              |

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

| Symbol | Meaning                                             | Value   |
| ------ | --------------------------------------------------- | ------- |
| `B_t`  | Monetised benefits in year `t`                      | [TBC]   |
| `C_t`  | Costs in year `t`, including maintenance            | [TBC]   |
| `C_0`  | Initial investment (development, devices, training) | [TBC]   |
| `r`    | Discount rate                                       | [TBC]   |
| `n`    | Evaluation period                                   | 3 years |

### 10.1 Scenarios

| Scenario     | Benefit realisation                                       | Cost variance | Result |
| ------------ | --------------------------------------------------------- | ------------- | ------ |
| Conservative | 50% of estimated time savings; no dispatch saving claimed | +20%          | [TBC]  |
| Base         | Estimated time savings; conservative dispatch saving      | As budgeted   | [TBC]  |
| Optimistic   | Full savings plus duplicate-screening saving              | −10%          | [TBC]  |

The recommendation does not depend on the optimistic scenario. If the
conservative scenario does not recover costs, the case rests on risk reduction
and BEN-004, and that must be stated plainly to the sponsor.

## 11. Sensitivity Analysis

| Variable              | Change tested        | Effect on NPV |
| --------------------- | -------------------- | ------------- |
| Discount rate `r`     | ±2 percentage points | [TBC]         |
| Maintenance cost      | 15% → 25% of build   | [TBC]         |
| Events per year       | −50%                 | [TBC]         |
| Dispatcher time value | −30%                 | [TBC]         |
| Benefit realisation   | Conservative → base  | [TBC]         |

Sensitivity results are recorded once the client supplies the baselines. The
model above is the worksheet; no figure in this section is assumed.

## 12. Project Timeline

| ID  | Milestone                           | Target          |
| --- | ----------------------------------- | --------------- |
| M1  | Charter and requirements approved   | Week 2 · [TBC]  |
| M2  | Architecture and data design frozen | Week 5 · [TBC]  |
| M3  | API engine operational              | Week 9 · [TBC]  |
| M4  | Dispatch portal operational         | Week 12 · [TBC] |
| M5  | Hardening complete                  | Week 14 · [TBC] |
| M6  | Documentation and defence           | Week 16 · [TBC] |

Approval is requested at M1; go-live for the pilot demonstration is M6. The
schedule assumes one academic term and part-time effort.

## 13. Governance, Assumptions and Dependencies

### 13.1 Governance

| Decision               | Authority               | Recorded in                        |
| ---------------------- | ----------------------- | ---------------------------------- |
| Scope changes          | «Project Sponsor»       | Change request log                 |
| Academic acceptance    | «Project Adviser»       | Document approval blocks           |
| Architecture decisions | «Project Team Lead»     | TSD §6 Architecture Decisions      |
| Operational acceptance | «Client Representative» | Charter approval and demo sign-off |

### 13.2 Assumptions and dependencies

| ID    | Statement                                                       | Effect if false                        |
| ----- | --------------------------------------------------------------- | -------------------------------------- |
| A-001 | A PostGIS-capable database is available                         | Core capability cannot be demonstrated |
| A-003 | Free or institutional tiers suffice                             | Additional recurring cost              |
| A-004 | Dispatchers have a modern browser and connectivity              | Portal unusable during an event        |
| D-001 | Hosted database credentials are supplied as a repository secret | Hosted migration not demonstrated      |
| D-003 | Client confirms the pilot corridor                              | Seed data and demonstration rework     |

## 14. Approval Recommendation

Approve **Option 4**, the pilot build, on the conditions in §6.

| Decision           | Detail                               |
| ------------------ | ------------------------------------ |
| Decision requested | Approve Option 4 and the pilot scope |
| Decision maker     | «Project Sponsor»                    |
| Decision           | [TBC]                                |
| Date               | [TBC]                                |
| Conditions         | [TBC]                                |
| Budget approved    | PHP [TBC]                            |

| Role            | Name                    | Signature | Date  |
| --------------- | ----------------------- | --------- | ----- |
| Project Sponsor | «Project Sponsor»       |           | [TBC] |
| Business Owner  | «Client Representative» |           | [TBC] |
| Project Adviser | «Project Adviser»       |           | [TBC] |
