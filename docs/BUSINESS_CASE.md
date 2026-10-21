# Business Case — MetroFlow

| Field             | Value                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Document ID       | MF-BC-001                                                                                                      |
| Version           | 1.0 (Draft)                                                                                                    |
| Status            | For academic review                                                                                            |
| Date              | 21 October 2026                                                                                                |
| Prepared by       | «Project Team»                                                                                                 |
| Reviewed by       | «Project Adviser»                                                                                              |
| Approved by       | «Project Sponsor»                                                                                              |
| Related documents | [BRD.md](BRD.md), [PROJECT_CHARTER.md](PROJECT_CHARTER.md), [PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md) |

## Revision history

| Version | Date        | Author         | Change                |
| ------- | ----------- | -------------- | --------------------- |
| 1.0     | 21 Oct 2026 | «Project Team» | Initial business case |

## 1. Executive summary

During a rain event, the LGU operations centre decides where to send rescue
resources using information it cannot verify. Two failures follow: responders are
committed to roads that are already impassable, and decisions cannot be reviewed
afterwards.

Four options were assessed: continue as-is, formalise a manual geographic
information system (GIS) procedure, licence a commercial platform, or build a
focused pilot. The recommended option is **build the pilot** — not because
building is inherently cheaper, but because the two capabilities that create the
value (clearance-aware routing over the LGU's own road graph, and a triage record
the LGU owns) are the two that commercial platforms customise least and charge
most for.

The pilot is scoped to one corridor and deliberately excludes native apps, live
sensors and production identity. That keeps the commitment inside an academic
term while producing a demonstrable, auditable capability.

**Decision requested:** approve Option 4 and release the pilot scope defined in
[PROJECT_CHARTER.md](PROJECT_CHARTER.md) §4. All monetary figures are `[TBC]`
pending quotations; the cost model and formulae are provided so figures can be
inserted without reworking the document.

## 2. Problem and opportunity

| Element                | Summary                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem                | No shared, current picture of road passability; unstructured reports; no audit trail (BRD §3)                                               |
| Who is affected        | Dispatchers, rescue units, MDRRMC coordinators, citizens awaiting rescue                                                                    |
| Cost of the status quo | Aborted dispatches, duplicated effort, delayed response, no learning between events                                                         |
| Opportunity            | Convert verbal coordination into verified, recorded decisions using data the LGU already holds (road graph, elevation, barangay boundaries) |
| Window                 | The capability is useful before the next rainy season; the pilot can be delivered inside one academic term                                  |

## 3. Options analysis

### 3.1 Options considered

| ID  | Option                            | Description                                                                                        |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| O1  | **Do nothing**                    | Continue radio, phone and social-media coordination                                                |
| O2  | **Manual GIS procedure**          | Dispatchers maintain a shared map and spreadsheet by hand, updating road status from field reports |
| O3  | **Commercial platform**           | Licence an existing incident-management or fleet-tracking platform and configure it                |
| O4  | **Build the pilot (recommended)** | Build the simulation, routing and triage portal against the LGU's pilot corridor                   |
| O5  | **Hybrid**                        | Licence a commercial platform for incident management and build only the routing engine            |

### 3.2 Evaluation criteria

| Criterion                       | Weight | Why it matters                                                           |
| ------------------------------- | ------ | ------------------------------------------------------------------------ |
| Fit to operational need         | 30%    | The tool must match how dispatch actually works, not force a new process |
| Cost of ownership (3 years)     | 20%    | LGU budgets are annual and constrained                                   |
| Time to first operational value | 15%    | Value must arrive before the next flood season                           |
| Control and data ownership      | 15%    | Incident and personal data must remain under LGU control                 |
| Maintainability and skills      | 10%    | The LGU must be able to sustain it after handover                        |
| Scalability to more corridors   | 10%    | The pilot must be extensible without a rewrite                           |

### 3.3 Assessment

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

### 3.4 Why the alternatives were not recommended

- **O1 Do nothing** is the cheapest and the most expensive. It preserves the
  current failure mode: dispatch decisions that cannot be verified or reviewed.
- **O2 Manual GIS** improves the shared picture but depends on a dispatcher
  updating a map during the event — the busiest possible moment. It also cannot
  answer "can this vehicle pass?" without manual judgement.
- **O3 Commercial platform** provides incident workflow and fleet tracking, but
  flood-depth modelling and clearance-aware routing over a local road graph are
  either absent or professional-services work. Licensing and per-seat costs
  recur, and incident data leaves LGU control.
- **O5 Hybrid** is credible but requires two procurements and an integration
  contract, which is heavier than the pilot's scope justifies.

## 4. Recommended option

**Option 4 — build the pilot.** It is the only option that delivers both
capabilities that create the operational benefit, keeps data under LGU control,
and can be delivered within the academic term.

The recommendation is conditional on the boundaries in the charter being held:
no native apps, no live sensor integration, no production identity provider in
this release.

## 5. Benefits

### 5.1 Benefit register

| ID     | Benefit                                | Type       | How it is measured                                                   | Owner           |
| ------ | -------------------------------------- | ---------- | -------------------------------------------------------------------- | --------------- |
| BEN-01 | Faster triage decisions                | Tangible   | Median minutes from report to recorded decision                      | Operations lead |
| BEN-02 | Fewer dispatches into impassable roads | Tangible   | Dispatch attempts aborted for road conditions per event              | Operations lead |
| BEN-03 | Less duplicated effort                 | Tangible   | Duplicate reports screened per event                                 | Operations lead |
| BEN-04 | Accountable decision trail             | Tangible   | Percentage of decisions with actor, time and rationale (target 100%) | MDRRMC          |
| BEN-05 | Shared situational picture             | Intangible | Dispatcher feedback; single source of truth in use                   | Operations lead |
| BEN-06 | Institutional learning                 | Intangible | Post-event review possible from exported logs                        | MDRRMC          |
| BEN-07 | Reusable technical capability          | Intangible | Routing and simulation usable by future driver app                   | «Project Team»  |

### 5.2 Benefit realisation

| Phase                             | What is realised       | How it is evidenced                             |
| --------------------------------- | ---------------------- | ----------------------------------------------- |
| Pilot (term)                      | BEN-04, BEN-05, BEN-07 | Demonstration, logs, repository                 |
| First rainy season after handover | BEN-01, BEN-02, BEN-03 | Before/after comparison against the M1 baseline |
| Subsequent seasons                | BEN-06                 | Post-event reports                              |

Benefits 01–03 cannot be claimed without a baseline. If the client cannot supply
one (R-08), the case rests on BEN-04, BEN-05 and risk reduction, and that must be
stated in the final report rather than implied.

## 6. Costs

### 6.1 Cost structure

All figures `[TBC]`. The structure is what matters at this stage; the amounts
depend on quotations and institutional rules.

| ID      | Category                | Type      | Basis                      | Year 1    | Year 2    | Year 3    |
| ------- | ----------------------- | --------- | -------------------------- | --------- | --------- | --------- |
| COST-01 | Development effort      | In-kind   | «N» person-months × «rate» | [TBC]     | —         | —         |
| COST-02 | Hosted database         | Recurring | Supabase plan              | [TBC]     | [TBC]     | [TBC]     |
| COST-03 | Application hosting     | Recurring | «Hosting provider» plan    | [TBC]     | [TBC]     | [TBC]     |
| COST-04 | Domain and TLS          | Recurring | Registrar                  | [TBC]     | [TBC]     | [TBC]     |
| COST-05 | Test devices and data   | One-off   | «Institution»              | [TBC]     | —         | —         |
| COST-06 | Training and handover   | One-off   | «N» days × «rate»          | [TBC]     | —         | —         |
| COST-07 | Maintenance and support | Recurring | 15–20% of COST-01 per year | —         | [TBC]     | [TBC]     |
| COST-08 | Contingency             | Reserve   | 10% of the above           | [TBC]     | [TBC]     | [TBC]     |
|         | **Total per year**      |           |                            | **[TBC]** | **[TBC]** | **[TBC]** |

### 6.2 Cost assumptions

| ID    | Assumption                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| CA-01 | Development effort is student time and is not cash-funded, but is costed at an institutional rate so the total cost of ownership is honest |
| CA-02 | The free tier of each service is sufficient for the pilot; paid tiers apply only at production scale                                       |
| CA-03 | No licence fees are incurred for the libraries used (all open source)                                                                      |
| CA-04 | Training is delivered to a small group (≤ 10 users) at the operations centre                                                               |
| CA-05 | Maintenance in year 2 assumes no major feature work, only dependency and security updates                                                  |

## 7. Financial analysis

### 7.1 Method

The case is expressed as a three-year total cost of ownership with a benefit
comparison, because the pilot's benefits are operational rather than revenue
generating. The formulae below are the ones used once figures are supplied.

**Net present value**

```
NPV = Σ (B_t − C_t) / (1 + r)^t − C_0        for t = 1..n
```

**Return on investment**

```
ROI = (Σ B_t − Σ C_t) / Σ C_t × 100%
```

**Payback period**

```
Payback = the first year in which cumulative (B_t − C_t) ≥ 0
```

Where:

- `B_t` — monetised benefits in year `t`
- `C_t` — costs in year `t` (including maintenance)
- `C_0` — initial investment (development, devices, training)
- `r` — discount rate, `[TBC]` (institutional rate)

### 7.2 Benefit monetisation

| Benefit                           | Unit                                                   | Unit value                 | Source                         |
| --------------------------------- | ------------------------------------------------------ | -------------------------- | ------------------------------ |
| BEN-01 Dispatcher time saved      | Hours per event × events per year                      | «loaded hourly rate» [TBC] | Client HR data                 |
| BEN-02 Avoided aborted dispatches | Aborted dispatches avoided × cost per aborted dispatch | [TBC]                      | Fuel, vehicle wear, crew hours |
| BEN-03 Duplicate screening        | Hours saved per event                                  | «loaded hourly rate» [TBC] | Client HR data                 |
| BEN-04 Audit trail                | Avoided investigation effort per disputed decision     | [TBC]                      | Client estimate                |

Avoided losses — injury, property damage, liability — are **excluded** from the
calculation. They are the strongest reason to build the system and the weakest
thing to put a number on. They are recorded as non-monetised benefit.

### 7.3 Scenarios

Three scenarios are evaluated once the inputs are known:

| Scenario     | Benefit realisation                                       | Cost variance | Result |
| ------------ | --------------------------------------------------------- | ------------- | ------ |
| Conservative | 50% of estimated time savings; no dispatch saving claimed | +20%          | [TBC]  |
| Base         | Estimated time savings; conservative dispatch saving      | As budgeted   | [TBC]  |
| Optimistic   | Full savings plus duplicate-screening saving              | −10%          | [TBC]  |

The recommendation does not depend on the optimistic scenario. If the
conservative scenario does not recover costs, the case must rest on risk
reduction and BEN-04, and that should be stated plainly to the sponsor.

### 7.4 Sensitivity

| Variable              | Change tested        | Effect on NPV |
| --------------------- | -------------------- | ------------- |
| Discount rate `r`     | ±2 percentage points | [TBC]         |
| Maintenance cost      | 15% → 25% of build   | [TBC]         |
| Events per year       | −50%                 | [TBC]         |
| Dispatcher time value | −30%                 | [TBC]         |

## 8. Affordability and funding

| Question              | Position                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Is funding required?  | Cash requirement is limited to hosted services, domain and test devices; development is in-kind                          |
| Who pays?             | «Project Sponsor» / «Institution»                                                                                        |
| Budget cycle          | [TBC]                                                                                                                    |
| Approval route        | Sponsor approval, then institutional procurement for any paid service                                                    |
| If funding is refused | The pilot still runs on free tiers; the hosted deployment path is demonstrated through CI rather than a live environment |

## 9. Risks to the business case

| ID   | Risk                                | Effect on the case                                       | Response                                                                                              |
| ---- | ----------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| R-02 | Model outputs judged unrealistic    | Benefits unrealisable; credibility lost                  | Declare calibration as configurable; validate against documented events; position as decision support |
| R-07 | Authentication not delivered        | Cannot be used with real data, so no operational benefit | Scope BR-09 as the first post-pilot increment; state limitation explicitly                            |
| R-08 | No baseline data                    | Benefits unquantifiable                                  | Use audit-trail and risk benefits; collect baseline during pilot                                      |
| R-10 | Hosted costs exceed free tier       | Operating cost rises                                     | Keep hosting provider-agnostic; container image is portable                                           |
| R-12 | Dispatchers reject the tool         | Adoption fails regardless of capability                  | Usability sessions from M3; keep the radio process running in parallel                                |
| R-13 | Commercial alternative chosen later | Sunk cost                                                | Publish the API contract so the routing engine can outlive the portal                                 |

## 10. Assumptions and dependencies

Restated from the charter, because the financial case depends on them:

| ID     | Assumption or dependency        | Effect if false                        |
| ------ | ------------------------------- | -------------------------------------- |
| A-01   | PostGIS instance available      | Cannot demonstrate the core capability |
| A-03   | Free tiers sufficient           | Additional recurring cost              |
| DEP-01 | Hosted database secret supplied | Hosted migration not demonstrated      |
| CA-01  | Effort costed, not funded       | Total cost of ownership understated    |

## 11. Recommendation

Approve **Option 4**, the pilot build, with:

1. The scope boundary in the charter held for the duration of the term.
2. Baseline data collection scheduled in M1 so benefits can be measured.
3. Authentication (BR-09) named as the first post-pilot increment, not quietly
   dropped.
4. A decision review at M5, before documentation and defence, using the
   conservative scenario.

## 12. Decision record

| Field              | Value                                |
| ------------------ | ------------------------------------ |
| Decision requested | Approve Option 4 and the pilot scope |
| Decision maker     | «Project Sponsor»                    |
| Decision           | [TBC]                                |
| Date               | [TBC]                                |
| Conditions         | [TBC]                                |

## 13. Appendix — calculation worksheet

Fill the inputs, then compute. Nothing else in this document needs to change.

| Input              | Symbol | Value |
| ------------------ | ------ | ----- |
| Discount rate      | `r`    | [TBC] |
| Years evaluated    | `n`    | 3     |
| Initial investment | `C_0`  | [TBC] |
| Year 1 cost        | `C_1`  | [TBC] |
| Year 2 cost        | `C_2`  | [TBC] |
| Year 3 cost        | `C_3`  | [TBC] |
| Year 1 benefit     | `B_1`  | [TBC] |
| Year 2 benefit     | `B_2`  | [TBC] |
| Year 3 benefit     | `B_3`  | [TBC] |

| Output        | Formula                            | Value |
| ------------- | ---------------------------------- | ----- |
| Total cost    | `C_0 + C_1 + C_2 + C_3`            | [TBC] |
| Total benefit | `B_1 + B_2 + B_3`                  | [TBC] |
| NPV           | `Σ (B_t − C_t)/(1+r)^t − C_0`      | [TBC] |
| ROI           | `(ΣB − ΣC)/ΣC × 100`               | [TBC] |
| Payback       | first year with cumulative net ≥ 0 | [TBC] |
