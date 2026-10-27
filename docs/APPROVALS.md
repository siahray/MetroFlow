# MetroFlow — Approval Register

## Document Control

| Field          | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Project        | MetroFlow                                                             |
| Document       | Approval Register                                                     |
| Version        | 1.0                                                                   |
| Status         | For Review — CR-001, CR-002 and CR-003 approved 27 October 2026        |
| Date           | 23 October 2026                                                       |
| Context        | Academic capstone project — not an official LGU project               |
| Cost boundary  | No project fee; free tiers, open data and institutional resources only |
| Formal approver | «Project Adviser» and the academic panel                             |

This register lists every document, change request and gate that needs approval
before the prototype can move into implementation or be presented as an accepted
academic deliverable.

## 1. Academic and Cost Context

MetroFlow is a **school project**. It is not commissioned, funded, endorsed,
hosted or operated by any Local Government Unit (LGU), MDRRMC or government
office. References to an LGU, dispatchers, rescue units and a pilot corridor
describe the intended use case and evaluation scenario. They do not describe an
official deployment, a real client or an existing government programme.

- The system is delivered **free of charge** as an academic requirement.
- No project fee, licence fee or LGU budget is requested.
- Free tiers, open-source libraries, public data and institutional resources are
  the only approved cost basis.
- A paid service, paid imagery tier or paid app-store account is **out of scope**
  unless the academic adviser approves it in a separate change.
- Any LGU representative who gives feedback is a **scenario reviewer**, not an
  official approver. Their feedback is advisory and does not imply endorsement.
- Synthetic or public data is used. Real personal data, live CCTV, production
  SOS delivery and real LGU operational data are not part of this project.

The existing cost tables in the charter, business case and PMP are retained as
academic planning material. They are **not** a request for LGU funding and must
not be presented as an approved budget.

## 2. Approval Items

Status legend: **For Review** means the document exists but is unsigned;
**Proposed** means a change request awaits a decision; **Blocked** means the gate
cannot close until its dependencies are approved.

| ID   | Item | Version | What is being approved | Approver | Status | Blocks implementation? |
| ---- | ---- | ------- | ---------------------- | -------- | ------ | ---------------------- |
| A-01 | [Project Charter](PROJECT_CHARTER.md) | 1.4 | Academic authorisation, scope, objectives and success criteria | «Project Adviser» / panel | For Review | Yes |
| A-02 | [Business Requirements Document](BRD.md) | 1.4 | Problem statement, business requirements and stakeholders | «Project Adviser» / panel | For Review | Yes |
| A-03 | [Business Case](BUSINESS_CASE.md) | 1.4 | Option choice, benefits and the no-fee cost boundary | «Project Adviser» / panel | For Review | Yes |
| A-04 | [Functional Specification](FSD.md) | 1.3 | Functional behaviour, actors, requirements and tests | «Project Adviser» / panel | For Review | Yes |
| A-05 | [Technical Specification](TSD.md) | 1.4 | Architecture, data model, security and technical decisions | «Project Adviser» / panel | For Review | Yes |
| A-06 | [Project Management Plan](PROJ_MANAGEMENT_PLAN.md) | 1.6 | Schedule, quality, risk, communication and change control | «Project Adviser» / panel | For Review | Yes |
| A-07 | [API Reference](api.md) | 1.4 | Implemented and planned API contracts and error model | «Project Adviser» / panel; technical review by «Project Team Lead» | Draft | Yes |
| A-08 | [Admin UI Design Baseline](design/ADMIN_UI_BASELINE.md) | 0.4 | Admin design gate, components, states and traceability | «Project Adviser» / panel | For Review | Yes |
| A-09 | [Driver App Design Baseline](design/DRIVER_APP_BASELINE.md) | 0.7 | Driver design gate, screens, states and traceability | «Project Adviser» / panel | For Review | Yes |
| A-10 | [CR-001](CR-001.md) | 1.0 | Native Expo driver app, live hazards, fleet dispatch and sensors | «Project Adviser» / panel | Approved 27 Oct 2026 | No |
| A-11 | [CR-002](CR-002.md) | 1.0 | Final-product Offline Areas; pilot scope unchanged | «Project Adviser» / panel | Approved 27 Oct 2026 | No — final-product scope only |
| A-12 | [CR-003](CR-003.md) | 1.0 | Sentinel-1 advisory flood observations; pilot scope unchanged | «Project Adviser» / panel | Approved 27 Oct 2026 | No — final-product scope only |
| A-13 | Implementation start gate | — | A-01 to A-12 approved or formally deferred; open decisions closed | «Project Adviser» / panel | Partly cleared — A-10 to A-12 approved; A-01 to A-09 still For Review | Yes |
| A-14 | Data and privacy approach | — | Synthetic/public data, no real personal data, no live CCTV | «Project Adviser» / panel | For Review | Yes before any real data |
| A-15 | Native distribution path (`OD-D07`) | — | EAS/TestFlight/internal build path, bundle identifiers and accounts; public store release remains separate | «Project Adviser» / panel | Open | Yes before a native binary is distributed |
| A-16 | Demo and acceptance review | — | Working demonstration, test evidence and known limitations | «Project Adviser» / panel | Not started | Yes for final acceptance |
| A-17 | Final document set and defense | — | All documents accepted and limitations disclosed | «Project Adviser» / panel | Not started | Yes for final acceptance |
| A-18 | External free-tier service use | — | Supabase, Mapbox/OSM, Copernicus/Sentinel, EAS and GitHub free tiers | «Project Adviser» / `«Project Team Lead»` | For Review | Yes before provisioning accounts |

### 2.1 Open decisions that block the gate

These are not separate documents, but the implementation gate cannot close until
they are resolved or explicitly deferred in writing.

| Decision | Subject | Owner | Status |
| -------- | ------- | ----- | ------ |
| `OD-D01` to `OD-D22` | Driver and admin design decisions recorded in the two design baselines | Scenario reviewer / Design / Engineering | Open; several may be deferred |
| `OD-D07` | Native distribution, EAS, bundle identifiers and store accounts | Engineering | Open |
| `OD-D23` | Offline provider, licence, package contents, storage limits and stale-data policy | Scenario reviewer / Engineering | CR-002 approved; design decisions still open |
| `OD-D24` | Sentinel-1 access route, credential type, processing, confidence, latency and offline retention | Scenario reviewer / Engineering | CR-003 approved; design decisions still open |

### 2.2 Decision record

| Date       | Item | Decision | Note |
| ---------- | ---- | -------- | ---- |
| 27 Oct 2026 | A-10 (CR-001) | Approved | Scope accepted; implementation continues, with route-level token enforcement tracked as TSD LIM-022 |
| 27 Oct 2026 | A-11 (CR-002) | Approved | Final-product Offline Areas accepted; the pilot offline screen stays a labelled placeholder |
| 27 Oct 2026 | A-12 (CR-003) | Approved | Sentinel-1 selected as the final-product satellite source; no feed exists yet |

Approving the three change requests settles scope. It does not move A-01 to A-09,
which remain For Review, and it does not close the open design decisions in
§2.1. A-13 therefore stays open on those items rather than on the change
requests.

## 3. Approval Sequence

1. **Academic context and charter.** Confirm the school-project boundary and the
   no-fee basis.
2. **Requirements.** Approve the BRD and FSD; resolve or defer the design
   decisions that change the requirements.
3. **Technical baseline.** Approve the TSD and API reference.
4. **Delivery controls.** Approve the Business Case and PMP.
5. **Design gate.** Approve the admin and driver baselines.
6. **Change requests.** Decide CR-001, CR-002 and CR-003 individually. Deferring
   a change is allowed, but the affected feature cannot then enter implementation.
7. **Implementation gate.** Close A-13 after the required approvals and open
   decisions.
8. **Acceptance.** Demonstrate, review and approve the final document set.

## 4. What Approval Does Not Authorise

Approval of these documents does not authorise:

- an official LGU pilot, deployment, data-sharing agreement or endorsement;
- real personal data, live CCTV, real emergency dispatch or production SOS;
- a paid service, paid imagery tier or paid app-store account;
- a public App Store or Play Store release;
- a claim that simulated, planned or placeholder features are implemented.

The system remains a labelled academic prototype until a separate deployment
decision is made.

## 5. Sign-Off

| Role | Name | Scope | Decision | Date |
| ---- | ---- | ----- | -------- | ---- |
| Academic Adviser | «Project Adviser» | Academic quality and scope | Pending | `[TBC]` |
| Academic Panel | «Panel» | Final acceptance and defense | Pending | `[TBC]` |
| Project Team Lead | «Project Team Lead» | Technical readiness and evidence | Pending | `[TBC]` |
| Scenario LGU Reviewer (non-binding) | «Client Representative» | Use-case feedback only; no official endorsement | Pending | `[TBC]` |
