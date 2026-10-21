# MetroFlow — Documentation Set

MetroFlow is an intelligent urban mobility and flood simulation system for
Local Government Unit (LGU) disaster response. This directory holds the formal
project documents required for academic review, plus the API reference used by
implementers.

**Baseline:** `main` @ `9605e38` · 21 October 2026

## Documents

| Document                          | File                                               | ID         | Purpose                                                              | Primary audience        |
| --------------------------------- | -------------------------------------------------- | ---------- | -------------------------------------------------------------------- | ----------------------- |
| Project Charter                   | [PROJECT_CHARTER.md](PROJECT_CHARTER.md)           | MF-PC-001  | Authorises the project, fixes objectives, scope and success criteria | Sponsor, adviser, panel |
| Business Requirements Document    | [BRD.md](BRD.md)                                   | MF-BRD-001 | States the business problem, requirements and measurable outcomes    | Client, panel           |
| Business Case                     | [BUSINESS_CASE.md](BUSINESS_CASE.md)               | MF-BC-001  | Compares options, benefits, costs and risks; recommends an option    | Sponsor, panel          |
| Functional Specification Document | [FSD.md](FSD.md)                                   | MF-FSD-001 | Defines actors, functional requirements, use cases and screens       | Developers, QA, panel   |
| Technical Specification Document  | [TSD.md](TSD.md)                                   | MF-TSD-001 | Defines architecture, algorithms, data design, security and CI/CD    | Developers, panel       |
| Project Management Plan           | [PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md) | MF-PMP-001 | Defines schedule, quality, risk, communications and change control   | Team, adviser           |
| API Reference                     | [api.md](api.md)                                   | MF-API-001 | Endpoint contracts, parameters, responses and errors                 | Integrators, QA         |

## How the documents relate

```
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

Requirement identifiers are shared across documents:

| Prefix   | Meaning                    | Defined in      |
| -------- | -------------------------- | --------------- |
| `BR-nn`  | Business requirement       | BRD §6          |
| `FR-nn`  | Functional requirement     | FSD §5          |
| `NFR-nn` | Non-functional requirement | FSD §10         |
| `UC-nn`  | Use case                   | FSD §6          |
| `R-nn`   | Risk                       | PMP §10         |
| `A-nn`   | Assumption                 | BRD §10, PMP §3 |
| `ADR-nn` | Architecture decision      | TSD §16         |

## Placeholder conventions

These documents are complete in structure. Values that only the project team or
institution can supply are marked:

- `«Project Team»`, `«Adviser»`, `«Client LGU»` — names to be replaced.
- `[TBC]` — to be confirmed. Appears in dates, budget figures, baselines and
  targets that would otherwise be invented.
- `[TBD]` — to be decided; a design or scope choice still open.

A find-and-replace pass over `«` and `[TBC]` completes the document set before
submission. Nothing marked `[TBC]` is used as an input to a calculated result;
where a formula depends on one, the formula is shown so the figure can be
inserted directly.

## Document control

| Version | Date        | Author         | Change                                                           |
| ------- | ----------- | -------------- | ---------------------------------------------------------------- |
| 1.0     | 21 Oct 2026 | «Project Team» | Initial draft of the six project documents and the API reference |

Each document carries its own revision history and approval block. A change to
scope, schedule or architecture must update every affected document in the same
change, per the configuration management rules in PMP §14.

## Related material outside this directory

| Material                     | Location                                     |
| ---------------------------- | -------------------------------------------- |
| Runnable system              | `backend/`, `web-lgu/`, `docker-compose.yml` |
| OpenAPI document (generated) | `http://localhost:8000/openapi.json`         |
| CI/CD workflows              | `.github/workflows/`                         |
| Database migrations          | `backend/migrations/`                        |
| Agent/contributor notes      | `web-lgu/AGENTS.md`                          |
