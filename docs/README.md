# MetroFlow — Documentation Set

MetroFlow is an intelligent urban mobility and flood simulation system for Local
Government Unit (LGU) disaster response. This directory holds the formal project
documents, the API reference, and the Word templates the documents follow.

**Document baseline:** v2.0 (consolidated, 13 November 2026) · **Code baseline:** `main`, 13 November 2026

The pilot scope covers an Expo driver app, live hazard publication, fleet
dispatch, sensor ingestion, authentication, SOS, field reports and moderation,
event streams, offline operation, exports and user management — all implemented
in the API and the clients. A dry-state ("FASTEST") routing request hands off
to the Mapbox Directions API; `FLOOD_SAFE` routing is unaffected (BRULE-017).
The pilot's road network is scoped to Quezon City for presentation legibility,
which surfaced that NFR-001/002/019 are **not currently met** at this real-OSM
scale (LIM-028). A downloadable-offline-areas capability, satellite flood
observations and "Smart Routing" extras (EV/HOV/toll/multimodal) remain
out of scope for the pilot — the first two as proposed final-product work, the
third declined for lack of real road-attribute data (see BRD Appendix A,
BR-019 to BR-022). Each document labels its own status honestly rather than
assuming the target state; `FSD.md` §Implementation Status is the
per-requirement record.

## Documents

| Document                       | File                                               | ID         | Purpose                                                              | Primary audience        |
| ------------------------------ | -------------------------------------------------- | ---------- | -------------------------------------------------------------------- | ----------------------- |
| Project Charter                | [PROJECT_CHARTER.md](PROJECT_CHARTER.md)           | MF-PC-001  | Authorises the project, fixes objectives, scope and success criteria | Sponsor, adviser, panel |
| Business Requirements Document | [BRD.md](BRD.md)                                   | MF-BRD-001 | States the business problem, requirements and measurable outcomes    | Client, panel           |
| Business Case                  | [BUSINESS_CASE.md](BUSINESS_CASE.md)               | MF-BC-001  | Compares options, benefits, costs and risks; recommends an option    | Sponsor, panel          |
| Functional Specification       | [FSD.md](FSD.md)                                   | MF-FSD-001 | Defines actors, functional requirements, screens and tests           | Developers, QA, panel   |
| Technical Specification        | [TSD.md](TSD.md)                                   | MF-TSD-001 | Defines architecture, algorithms, data design, security and CI/CD    | Developers, panel       |
| Project Management Plan        | [PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md) | MF-PMP-001 | Defines schedule, quality, risk, communications and change control   | Team, adviser           |
| Approval Register              | [APPROVALS.md](APPROVALS.md)                       | MF-APR-001 | Lists every document and gate that needs approval                    | Adviser, panel, team    |
| Progress Report                | [../PROGRESS_REPORT.md](../PROGRESS_REPORT.md)      | —          | Records what is implemented on the current branch                    | Team, panel             |
| API Reference                  | [api.md](api.md)                                   | MF-API-001 | Endpoint contracts, parameters, responses and errors                 | Integrators, QA         |

## Design artifacts

The design baselines record the supplied interfaces, the tokens and shell, the
screen and component map, the traceability to the FSD, and the data or API gaps
that must be closed before implementation.

| Artifact            | File                                                                                                       | Status     | Purpose                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------- |
| Admin UI Baseline   | [design/ADMIN_UI_BASELINE.md](design/ADMIN_UI_BASELINE.md)                                                 | For Review | Admin screens, components, states and traceability |
| Driver App Baseline | [design/DRIVER_APP_BASELINE.md](design/DRIVER_APP_BASELINE.md)                                             | For Review | Driver screens, states and traceability            |
| UI 1 — Editor       | [design/source/lgu-admin-flood-closure-editor.html](design/source/lgu-admin-flood-closure-editor.html)     | Reference  | Flood / Road Closure Editor                        |
| UI 2 — Verification | [design/source/lgu-admin-report-verification.html](design/source/lgu-admin-report-verification.html)       | Reference  | Report Verification Detail                         |
| UI 3 — Public Alert | [design/source/lgu-admin-published-hazard-alert.html](design/source/lgu-admin-published-hazard-alert.html) | Reference  | Published Hazard Alert / Civic Broadcasts          |
| UI 4 — Rescue       | [design/source/lgu-admin-rescue-tracking.html](design/source/lgu-admin-rescue-tracking.html)               | Reference  | Rescue Unit Tracking / Fleet Detail                |
| Driver UI — Login   | [design/source/driver/metroflow-driver-splash-login.html](design/source/driver/metroflow-driver-splash-login.html) | Reference | Splash and sign-in                                 |
| Driver UI — Map     | [design/source/driver/metroflow-driver-map-routing.html](design/source/driver/metroflow-driver-map-routing.html)   | Reference | Map and route                                      |
| Driver UI — Report  | [design/source/driver/metroflow-driver-report-sos.html](design/source/driver/metroflow-driver-report-sos.html)     | Reference | Report and SOS                                     |
| Driver UI — Profile | [design/source/driver/metroflow-driver-profile.html](design/source/driver/metroflow-driver-profile.html)           | Reference | Profile and offline areas                          |

## Document templates

The six Word templates supplied for this project are in [`docx/`](docx/). Each
Markdown document above follows the section order and tables of its template.
Generated Word versions are written to `docx/generated/` by
`scripts/build_docs.py`; the templates themselves are never overwritten.

| Template                            | Generated document                            |
| ----------------------------------- | --------------------------------------------- |
| `docx/Project_Charter.docx`         | `docx/generated/Project_Charter.docx`         |
| `docx/BRD.docx`                     | `docx/generated/BRD.docx`                     |
| `docx/Business_Case.docx`           | `docx/generated/Business_Case.docx`           |
| `docx/FSD.docx`                     | `docx/generated/FSD.docx`                     |
| `docx/TSD.docx`                     | `docx/generated/TSD.docx`                     |
| `docx/Project-Management-Plan.docx` | `docx/generated/Project-Management-Plan.docx` |

Regenerate with:

```bash
python3 -m venv .docx-venv
. .docx-venv/bin/activate
pip install python-docx
python scripts/build_docs.py
```

## How the documents relate

```text
PROJECT_CHARTER   authorises the work and names the success criteria
      │
      ├── BRD          what the business needs, in business language
      │     └── FSD    how the system behaves, requirement by requirement
      │           └── TSD   how the system is built
      │                 └── api.md   the callable contract
      │
      ├── BUSINESS_CASE   why this option, at what cost, with what return
      │
      └── PROJ_MANAGEMENT_PLAN   who does what, when, and how it is controlled
```

## Identifier conventions

Requirement identifiers are stable across every document.

| Prefix                             | Meaning                           | Defined in                       |
| ---------------------------------- | --------------------------------- | -------------------------------- |
| `BR-001`                           | Business requirement              | BRD, Appendix A                  |
| `FR-001`                           | Business-level functional summary | BRD, Functional Requirements     |
| `FSD-FR-001`                       | Functional specification          | FSD, Functional Requirements     |
| `NFR-001`                          | Non-functional requirement        | BRD, Non-Functional Requirements |
| `BRULE-001`                        | Business rule                     | BRD Appendix B, FSD              |
| `TC-001`                           | Functional test scenario          | FSD                              |
| `TTC-001`                          | Technical test case               | TSD                              |
| `VAL-001`                          | Validation rule                   | TSD                              |
| `E001`                             | API error code                    | TSD                              |
| `UC-001`                           | Use case                          | FSD                              |
| `OBJ-001`, `BO-001`                | Project and business objectives   | Charter, BRD                     |
| `SC-001`                           | Success criterion                 | Charter                          |
| `R-001`, `A-001`, `I-001`, `D-001` | RAID entry                        | PMP                              |
| `ADR-001`                          | Architecture decision             | TSD                              |
| `LIM-001`, `SEC-001`               | Known limitation, security risk   | TSD                              |

## Placeholder conventions

These documents are complete in structure. Values that only the project team or
institution can supply are marked:

- `«Project Team»`, `«Adviser»`, `«Client Representative»` — names to replace.
- `[TBC]` — to be confirmed. Used for dates, budget figures, baselines and
  targets that would otherwise be invented.
- `[TBD]` — to be decided; a design or scope choice still open.

A find-and-replace pass over `«` and `[TBC]` completes the set before submission.
Nothing marked `[TBC]` is used as an input to a calculated result; where a formula
depends on one, the formula is shown so the figure can be inserted directly.

## Document control

| Version | Date        | Author         | Change                                                                  |
| ------- | ----------- | -------------- | ----------------------------------------------------------------------- |
| 0.1     | 21 Oct 2026 | «Project Team» | Initial draft of the six project documents and the API reference        |
| 1.0     | 21 Oct 2026 | «Project Team» | Restructured to the supplied Word templates; template identifier scheme |
| 1.1     | 21 Oct 2026 | «Project Team» | Driver app, live hazards, fleet dispatch and sensors added to scope      |
| 1.2     | 22 Oct 2026 | «Project Team» | Provider keys, Supabase Auth, Mapbox tiles and template-sourced UI      |
| 1.3     | 27 Oct 2026 | «Project Team» | Driver-app scope approved; ADR-021 tokens; implementation status aligned with the code |
| 1.4     | 27 Oct 2026 | «Project Team» | Route-level token enforcement and role checks; LIM-001 and LIM-022 closed |
| 1.5     | 27 Oct 2026 | «Project Team» | API hosted as a Vercel Python function; portal pointed at it; LIM-023 and LIM-024 recorded |
| 1.6     | 28 Oct 2026 | «Project Team» | Application rate limits on login, registration, SOS and simulation (LIM-006 closed for limits; LIM-025 records the plan's missing WAF); FSD status and actors aligned |
| 1.7     | 28 Oct 2026 | «Project Team» | API connected to the repository (root `backend/`, production `main`); LIM-024 closed |
| 1.8     | 13 Nov 2026 | «Project Team» | EV/HOV/toll "Smart Routing" recorded as declined (no real road-attribute data); dry-state routing hands off to Mapbox Directions (FSD-FR-131, BRULE-017); driver navigation polish (FSD-FR-124 to 129: voice guidance, route preview/Start, speed-aware camera, heading marker, Quick Picks/recent search, alternative routes); live-weather simulation toggle (FSD-FR-130) |
| 1.9     | 13 Nov 2026 | «Project Team» | Pilot road network scoped to Quezon City (LIM-014 superseded again); NFR-001/002/019 re-measured against the live hosted network and recorded as **not currently met** (LIM-028); project schedule dates corrected against git history across Charter/PMP/Business Case |
| 2.0     | 13 Nov 2026 | «Project Team» | Consolidated baseline: folded every prior scope addition into the documents as original scope; retired the standalone change-request records |

Each document carries its own revision history and approval block. A change to
scope, schedule or architecture must update every affected document in the same
change, per the configuration management rules in the PMP.

## Related material outside this directory

| Material                     | Location                                       |
| ---------------------------- | ---------------------------------------------- |
| Runnable system              | `backend/`, `metroflow-admin/`, `docker-compose.yml`   |
| Driver app (Expo)            | `metroflow-mobile/`                               |
| UI template (client-supplied) | `docs/design/`                                  |
| Environment templates        | `backend/.env.example`, `metroflow-admin/.env.example`, `metroflow-mobile/.env.example` |
| OpenAPI document (generated) | `/openapi.json` on the API host, e.g. `https://metroflow-api-siahrays-projects.vercel.app/openapi.json` |
| CI/CD workflows              | `.github/workflows/`                           |
| Database migrations          | `backend/migrations/`                          |
| Agent/contributor notes      | `metroflow-admin/AGENTS.md`                            |
