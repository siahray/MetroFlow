# MetroFlow — Documentation Set

MetroFlow is an intelligent urban mobility and flood simulation system for Local
Government Unit (LGU) disaster response. This directory holds the formal project
documents, the API reference, and the Word templates the documents follow.

**Document baseline:** v1.2 (CR-001, approved 27 October 2026) · **Code baseline:** `feat/scope-resolution-slice` · 27 October 2026

CR-001 extends the scope to the Expo driver app, live hazard publication, fleet
dispatch and sensor ingestion. The change request is **approved** and partly
implemented: authentication, SOS, hazards, fleet and dispatch persist through the
API, while reports, sensors and event streams remain planned. Each document
labels its own status honestly rather than assuming the target state.

## Documents

| Document                       | File                                               | ID         | Purpose                                                              | Primary audience        |
| ------------------------------ | -------------------------------------------------- | ---------- | -------------------------------------------------------------------- | ----------------------- |
| Project Charter                | [PROJECT_CHARTER.md](PROJECT_CHARTER.md)           | MF-PC-001  | Authorises the project, fixes objectives, scope and success criteria | Sponsor, adviser, panel |
| Business Requirements Document | [BRD.md](BRD.md)                                   | MF-BRD-001 | States the business problem, requirements and measurable outcomes    | Client, panel           |
| Business Case                  | [BUSINESS_CASE.md](BUSINESS_CASE.md)               | MF-BC-001  | Compares options, benefits, costs and risks; recommends an option    | Sponsor, panel          |
| Functional Specification       | [FSD.md](FSD.md)                                   | MF-FSD-001 | Defines actors, functional requirements, screens and tests           | Developers, QA, panel   |
| Technical Specification        | [TSD.md](TSD.md)                                   | MF-TSD-001 | Defines architecture, algorithms, data design, security and CI/CD    | Developers, panel       |
| Project Management Plan        | [PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md) | MF-PMP-001 | Defines schedule, quality, risk, communications and change control   | Team, adviser           |
| Approval Register              | [APPROVALS.md](APPROVALS.md)                       | MF-APR-001 | Lists every document, change request and gate that needs approval    | Adviser, panel, team    |
| Change Request CR-001          | [CR-001.md](CR-001.md)                             | MF-CR-001  | Records the scope change for the Expo driver app, hazards, fleet, sensors | Sponsor, team, panel  |
| Change Request CR-002          | [CR-002.md](CR-002.md)                             | MF-CR-002  | Final-product Offline Areas; pilot scope unchanged                   | Adviser, team, panel    |
| Change Request CR-003          | [CR-003.md](CR-003.md)                             | MF-CR-003  | Sentinel-1 advisory flood observations; pilot scope unchanged        | Adviser, team, panel    |
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
| `CR-001`                           | Change request                    | CR-001, PMP change control       |

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
| 1.1     | 21 Oct 2026 | «Project Team» | CR-001: driver app, live hazards, fleet dispatch and sensors            |
| 1.2     | 22 Oct 2026 | «Project Team» | Provider keys, Supabase Auth, Mapbox tiles and template-sourced UI      |
| 1.3     | 27 Oct 2026 | «Project Team» | CR-001 approved; ADR-021 tokens; implementation status aligned with the code |
| 1.4     | 27 Oct 2026 | «Project Team» | Route-level token enforcement and role checks; LIM-001 and LIM-022 closed |
| 1.5     | 27 Oct 2026 | «Project Team» | API hosted as a Vercel Python function; portal pointed at it; LIM-023 and LIM-024 recorded |

Each document carries its own revision history and approval block. A change to
scope, schedule or architecture must update every affected document in the same
change, per the configuration management rules in the PMP.

## Related material outside this directory

| Material                     | Location                                       |
| ---------------------------- | ---------------------------------------------- |
| Runnable system              | `backend/`, `metroflow-admin/`, `docker-compose.yml`   |
| Driver app (Expo, CR-001)    | `metroflow-mobile/`                               |
| UI template (client-supplied) | `docs/design/`                                  |
| Environment templates        | `backend/.env.example`, `metroflow-admin/.env.example`, `metroflow-mobile/.env.example` |
| OpenAPI document (generated) | `/openapi.json` on the API host, e.g. `https://metroflow-api-siahrays-projects.vercel.app/openapi.json` |
| CI/CD workflows              | `.github/workflows/`                           |
| Database migrations          | `backend/migrations/`                          |
| Agent/contributor notes      | `metroflow-admin/AGENTS.md`                            |
