# PROJECT MANAGEMENT PLAN

## MetroFlow — Intelligent Urban Mobility and Flood Simulation System

Version 1.0

## Document Information

| Item            | Details                                         |
| --------------- | ----------------------------------------------- |
| Document Title  | Project Management Plan (PMP)                   |
| Project Name    | MetroFlow                                       |
| Project Sponsor | «Project Sponsor»                               |
| Business Owner  | «Client Representative» — LGU Operations (CDMO) |
| Project Manager | «Project Team Lead»                             |
| Budget          | PHP [TBC]                                       |
| Go-Live         | [TBC]                                           |

## Revision History

| Version | Date        | Author                      | Description    | Status |
| ------- | ----------- | --------------------------- | -------------- | ------ |
| 0.1     | 21 Oct 2026 | «Project Team Lead»         | Initial Draft  | Draft  |
| 1.0     | 21 Oct 2026 | «QA and Documentation Lead» | Review release | Review |

## Approval Sign-Off

| Approver                | Role             | Signature | Date  |
| ----------------------- | ---------------- | --------- | ----- |
| «Project Sponsor»       | Project Sponsor  |           | [TBC] |
| «Client Representative» | Business Owner   |           | [TBC] |
| «Project Adviser»       | Academic Adviser |           | [TBC] |
| «Project Team Lead»     | Project Manager  |           | [TBC] |

## Table of Contents

1. Executive Summary
2. Project Overview
3. Scope Management
4. Project Schedule
5. Resource Management
6. Cost Management
7. RAID Log
8. RACI Matrix
9. Communication Management
10. Testing Management
11. Success Metrics
12. Appendices

## Executive Summary

MetroFlow gives the LGU operations centre a verified picture of road passability
during flooding and a traceable path from incident report to dispatch decision.
The pilot covers one corridor, a simulation and routing API, and a browser-based
dispatch portal.

This plan defines how the work is executed and controlled: schedule, resources,
cost, risk, quality, communication and change. The project is delivered
incrementally inside a fixed academic term, with a working demonstration at each
milestone rather than a single delivery at the end.

Current position: the API, schema and portal are built and tested; authentication
and incident intake are documented limitations scheduled after the pilot. Every
unconfirmed date or amount is marked `[TBC]`.

## Project Overview

| Item         | Description                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| Purpose      | Replace unverifiable verbal coordination with a shared network picture and a recorded triage decision |
| Users        | LGU dispatchers and MDRRMC coordinators; field responders in a future release                         |
| Deliverables | API engine, dispatch portal, versioned database, CI/CD pipeline, document set, demonstration          |
| Out of scope | Native apps, live sensor ingestion, production identity provider, real intake, multi-LGU tenancy      |
| Constraints  | Academic term, part-time effort, no paid Code Security, synthetic data only                           |

### Delivery approach

Weekly iterations, each producing something demonstrable:

| Increment | Demonstrable outcome                           |
| --------- | ---------------------------------------------- |
| I1        | Schema, seed graph, network state endpoint     |
| I2        | Rainfall simulation with persisted state       |
| I3        | Clearance-aware routing with GeoJSON output    |
| I4        | Portal shell, login screen, dashboard layout   |
| I5        | Queue, detail panel and operations log         |
| I6        | Dispatch actions, hardening, hosted migrations |
| I7        | Documentation set and defence preparation      |

**Definition of done:** merged to `main`; tests pass for the affected area; lint
and build pass when the web app is touched; the FSD status reflects reality; no
new High or Medium ZAP finding.

## Scope Management

### In scope

- Flood simulation across the pilot road graph.
- Clearance-aware route computation.
- LGU portal: login, queue, incident detail, operations log, dispatch actions.
- Versioned PostGIS schema with row-level security.
- Automated build, test, security and migration pipeline.

### Out of scope

- Native driver application.
- Live sensor, CCTV and weather ingestion.
- Production identity provider and single sign-on.
- Real citizen report intake.
- Multi-LGU tenancy and billing.
- Public information portal.

### Change control

A change request is required when a request adds or removes a deliverable,
crosses the scope boundary, changes a `Must` requirement, moves the schedule by
more than one week, changes the budget, or changes an architecture decision.

```text
Request → Log (CR-nnn) → Impact assessment → Decision → Update documents → Implement
```

No change is implemented before a decision is recorded. Emergency fixes for a
broken `main` may proceed, with the request raised the same day. The template is
in Appendix B.

## Project Schedule

| Phase                | Start           | End             | Status      |
| -------------------- | --------------- | --------------- | ----------- |
| Requirements         | Week 1 · [TBC]  | Week 2 · [TBC]  | Completed   |
| Design               | Week 3 · [TBC]  | Week 5 · [TBC]  | Completed   |
| Development — API    | Week 6 · [TBC]  | Week 9 · [TBC]  | Completed   |
| Development — Portal | Week 10 · [TBC] | Week 12 · [TBC] | Completed   |
| Hardening and SIT    | Week 13 · [TBC] | Week 14 · [TBC] | Completed   |
| Documentation        | Week 15 · [TBC] | Week 16 · [TBC] | In Progress |
| Demonstration        | Week 16 · [TBC] | Week 16 · [TBC] | Planned     |

Milestones:

| ID  | Milestone                           | Exit criterion                                      |
| --- | ----------------------------------- | --------------------------------------------------- |
| M1  | Charter and requirements approved   | Charter and BRD signed off                          |
| M2  | Architecture and data design frozen | TSD accepted; schema drafted                        |
| M3  | API engine operational              | Network, simulation and routing pass contract tests |
| M4  | Dispatch portal operational         | Triage flow demonstrated end-to-end                 |
| M5  | Hardening complete                  | ZAP clean at High/Medium; no open critical defects  |
| M6  | Documentation and defence           | Document set accepted; demonstration delivered      |

**Critical path:** requirements → data model → simulation → routing → contract
tests → hardening → defence. The portal runs in parallel but is not done until
the queue and detail panels share one state.

## Resource Management

| Role                       | Resource                    | Allocation |
| -------------------------- | --------------------------- | ---------- |
| Project Manager            | «Project Team Lead»         | 50%        |
| Business Analyst           | «Client Representative»     | 20%        |
| Architect                  | «Project Team Lead»         | 30%        |
| Backend Developers         | «Backend Lead»              | 100%       |
| Frontend Developers        | «Frontend Lead»             | 100%       |
| QA and Documentation       | «QA and Documentation Lead» | 60%        |
| Adviser                    | «Project Adviser»           | 5%         |
| Dispatcher representatives | «Lead Dispatcher»           | 5%         |

Allocations are part-time estimates against a nominal working week. One person
may hold more than one role; every role must have a named person before M2.

## Cost Management

| Category                     | Amount (PHP) |
| ---------------------------- | ------------ |
| Development effort (in-kind) | [TBC]        |
| Hosted database              | [TBC]        |
| Application hosting          | [TBC]        |
| Domain and TLS               | [TBC]        |
| Test devices and data        | [TBC]        |
| Training and handover        | [TBC]        |
| Contingency (10%)            | [TBC]        |
| **Total**                    | **[TBC]**    |

Rules:

1. No paid service is subscribed without sponsor approval.
2. Free tiers are the default; exceeding one requires a documented reason.
3. Effort is tracked weekly so the in-kind cost in the business case is real.

## RAID (Risks, Assumptions, Issues and Dependencies) Log

| ID    | Type       | Description                                                       | Owner            | Impact | Status     |
| ----- | ---------- | ----------------------------------------------------------------- | ---------------- | ------ | ---------- |
| R-001 | Risk       | Scope creep into native apps and live sensors                     | PM               | High   | Open       |
| R-002 | Risk       | Hydrological model judged unrealistic                             | Backend Lead     | High   | Open       |
| R-003 | Risk       | Loss of a team member                                             | PM               | Medium | Open       |
| R-004 | Risk       | Hosted database never configured                                  | Backend Lead     | Medium | Open       |
| R-005 | Risk       | Security findings surface late                                    | QA               | Medium | Open       |
| R-006 | Risk       | Institutional format differs from the document set                | PM               | Low    | Open       |
| R-007 | Risk       | Authentication not delivered                                      | PM               | High   | Open       |
| R-008 | Risk       | No baseline data from the client                                  | Business Analyst | Medium | Open       |
| R-009 | Risk       | Pilot corridor changes late                                       | Business Analyst | Medium | Open       |
| R-010 | Risk       | Hosted costs exceed the free tier                                 | Backend Lead     | Low    | Open       |
| R-011 | Risk       | GitHub or Supabase outage during a milestone                      | PM               | Low    | Open       |
| R-012 | Risk       | Dispatchers reject the tool                                       | Frontend Lead    | Medium | Open       |
| R-013 | Risk       | A commercial platform is chosen later                             | PM               | Low    | Open       |
| R-014 | Risk       | Personal data incident during testing                             | QA               | Medium | Open       |
| A-001 | Assumption | PostGIS-capable PostgreSQL is available                           | Backend Lead     | High   | Open       |
| A-002 | Assumption | Pilot corridor is representative enough to demonstrate routing    | PM               | Medium | Open       |
| A-003 | Assumption | Free or institutional tiers suffice for the pilot                 | PM               | Medium | Open       |
| A-004 | Assumption | Dispatchers have a modern browser and connectivity                | Business Analyst | High   | Open       |
| A-005 | Assumption | Rainfall intensity is supplied manually or from public data       | Backend Lead     | Medium | Open       |
| A-006 | Assumption | Client provides corridor and barangay naming                      | Business Analyst | Low    | Open       |
| I-001 | Issue      | No authentication on the API or portal                            | PM               | High   | Accepted   |
| I-002 | Issue      | Incident data in the portal is mock data                          | Frontend Lead    | Medium | Accepted   |
| I-003 | Issue      | CodeQL cannot run on the private repository                       | QA               | Medium | Workaround |
| D-001 | Dependency | Hosted database connection string supplied as a repository secret | Business Analyst | High   | Open       |
| D-002 | Dependency | Adviser and panel availability for reviews                        | PM               | Medium | Open       |
| D-003 | Dependency | Client confirms the pilot corridor                                | Business Analyst | High   | Open       |

Risk scoring and detailed responses are in Appendix A.

## RACI Matrix

R = responsible, A = accountable, C = consulted, I = informed.

| Activity              | Sponsor | PM  | BA  | DEV | QA  |
| --------------------- | ------- | --- | --- | --- | --- |
| Requirements          | A       | C   | R   | I   | I   |
| Architecture          | I       | A   | C   | R   | C   |
| Backend development   | I       | A   | I   | R   | C   |
| Portal development    | I       | A   | C   | R   | C   |
| Test strategy         | I       | A   | I   | C   | R   |
| Security scan         | I       | A   | I   | C   | R   |
| Hosted migration      | I       | A   | C   | R   | C   |
| Documentation         | A       | R   | C   | C   | R   |
| UAT and demonstration | A       | R   | C   | C   | C   |
| Change approval       | A       | R   | C   | I   | I   |

## Communication Management

| Audience              | Frequency     | Method                                |
| --------------------- | ------------- | ------------------------------------- |
| Project team          | Twice weekly  | Stand-up                              |
| Project adviser       | Bi-weekly     | Review meeting                        |
| Project sponsor       | At milestones | Written status report                 |
| Dispatcher users      | M4 and M5     | Demo and usability session            |
| Steering stakeholders | Monthly       | Progress briefing                     |
| Panel                 | M6            | Document submission and demonstration |

**Escalation:** blocker at stand-up → owner resolves within one day → «Project
Team Lead» → «Project Adviser» / «Project Sponsor» for scope. Academic or ethical
concerns go to the adviser immediately.

## Testing Management

| Phase              | Owner    | Exit Criteria                                                     |
| ------------------ | -------- | ----------------------------------------------------------------- |
| Unit tests         | DEV      | All pass; hydrology and routing edge cases covered                |
| Contract tests     | QA + DEV | Every endpoint returns the documented shape and status codes      |
| Static checks      | QA       | ESLint, TypeScript and production build pass                      |
| Database migration | DEV      | `alembic upgrade head` on a clean database; `alembic check` clean |
| Security scan      | QA       | No High or Medium ZAP findings                                    |
| System integration | QA       | End-to-end triage flow works against the running stack            |
| UAT                | Business | Dispatcher completes the scripted scenarios; sign-off recorded    |
| Regression         | QA       | No S1 or S2 defects open before demonstration                     |

| Test type              | Tool                                       |
| ---------------------- | ------------------------------------------ |
| Unit                   | pytest (`-m "not integration"`)            |
| Contract / integration | pytest (`-m integration`) against PostGIS  |
| Web lint and types     | ESLint, `next build`                       |
| Security               | OWASP ZAP API scan, CodeQL (when licensed) |
| Migration              | Alembic                                    |
| Exploratory            | Scripted browser session                   |

## Success Metrics

| KPI                                           | Target                        |
| --------------------------------------------- | ----------------------------- |
| `Must` requirements accepted                  | 100% by M5                    |
| Report-to-triage time                         | Below the M1 baseline `[TBC]` |
| Decisions with actor, timestamp and action    | 100%                          |
| Dispatch attempts aborted for road conditions | 0 per event                   |
| High/Medium security findings                 | 0                             |
| CI pass rate                                  | ≥ 95%                         |
| Requirement coverage                          | 100% of `Must` by M5          |
| System Usability Scale                        | ≥ 75 `[TBC]`                  |

## Appendices

### Appendix A — Risk scoring and responses

Probability and impact are scored High (3), Medium (2), Low (1); score is their
product. Risks scoring 6 or above are reviewed weekly.

| ID    | Risk                           | P   | I   | Score | Response                                                     | Trigger                             |
| ----- | ------------------------------ | --- | --- | ----- | ------------------------------------------------------------ | ----------------------------------- |
| R-001 | Scope creep                    | 3   | 3   | 9     | Hold the charter boundary; every addition needs a CR         | New feature requested mid-iteration |
| R-002 | Model judged unrealistic       | 3   | 3   | 9     | Declare calibration; validate against documented events      | Adviser or client challenges output |
| R-003 | Loss of a team member          | 2   | 3   | 6     | Pair on critical paths; record decisions                     | Missed stand-ups for a week         |
| R-004 | Hosted database not configured | 3   | 2   | 6     | Local stack is the primary demo; CD is gated and visible     | Secret absent at M5                 |
| R-005 | Late security findings         | 2   | 3   | 6     | Weekly ZAP gate from the first increment                     | New Medium finding                  |
| R-006 | Format mismatch                | 2   | 2   | 4     | Confirm the rubric at M1                                     | Adviser requests restructuring      |
| R-007 | Authentication not delivered   | 3   | 3   | 9     | State the limitation; schedule BR-009 post-pilot             | Pilot asked to handle real data     |
| R-008 | No baseline data               | 3   | 2   | 6     | Use audit-trail and risk benefits; collect during pilot      | Baseline absent at M1 review        |
| R-009 | Corridor changes late          | 2   | 3   | 6     | Freeze the corridor at M2                                    | New barangay list arrives           |
| R-010 | Hosted costs exceed free tier  | 2   | 2   | 4     | Keep hosting provider-agnostic                               | Usage warning from provider         |
| R-011 | Provider outage                | 1   | 3   | 3     | Work locally; defer hosted verification                      | Provider status page                |
| R-012 | Dispatchers reject the tool    | 2   | 3   | 6     | Usability sessions from M4; keep the radio process running   | Negative feedback in session        |
| R-013 | Commercial alternative chosen  | 1   | 2   | 2     | Publish the API contract; routing engine outlives the portal | Procurement announcement            |
| R-014 | Personal data incident         | 1   | 3   | 3     | Synthetic data only; RLS verified; no personal data in logs  | Any real report used in a demo      |

### Appendix B — Change request template

```text
CR id:             CR-nnn
Raised by:         <name>              Date: <date>
Description:       <what is being asked>
Reason:            <why>
Impact — scope:    <requirements affected>
Impact — schedule: <weeks>
Impact — cost:     <amount or none>
Impact — risk:     <new or changed risks>
Decision:          <approved / deferred / rejected>   By: <name>   Date: <date>
Documents updated: <list>
```

### Appendix C — Milestone status report template

```text
Milestone:            M<n> — <name>
Period:               <start> to <end>
Exit criteria met:    <yes/no, with evidence>
Schedule variance:    <days>
Open risks:           <ids and scores>
Open issues:          <ids and severity>
Decisions required:   <list>
Confidence in next:   <high/medium/low + reason>
```

### Appendix D — Configuration and documentation management

| Item              | Rule                                                              |
| ----------------- | ----------------------------------------------------------------- |
| Branching         | Short-lived feature branches; `main` always releasable            |
| Commit messages   | Imperative summary; body explains why                             |
| Pull requests     | Review, green CI and a requirement reference                      |
| Tags              | `backend-v*` for container releases                               |
| Secrets           | Never committed; repository secrets only                          |
| Pre-commit        | Husky: Ruff for Python, ESLint and Prettier for the web app       |
| Document versions | Increment on approval; revision history updated                   |
| Traceability      | Requirement ids are stable; changes add rows, never renumber      |
| Unknowns          | `[TBC]` and `«placeholder»` are explicit, never silently invented |

### Appendix E — Decision log

| ID      | Decision                    | Date  | Decided by          | Recorded in |
| ------- | --------------------------- | ----- | ------------------- | ----------- |
| ADR-001 | Alembic owns the schema     | [TBC] | «Project Team Lead» | TSD §6      |
| ADR-002 | Supabase as hosted Postgres | [TBC] | «Project Team Lead» | TSD §6      |
| ADR-007 | RLS deny-by-default         | [TBC] | «Backend Lead»      | TSD §6      |
| ADR-011 | Portal ships with mock data | [TBC] | «Project Team Lead» | TSD §6      |

### Appendix F — Closure and handover

- [ ] All `Must` functional requirements accepted (FSD).
- [ ] CI green on `main`; ZAP clean at High/Medium.
- [ ] Hosted database at head, or the limitation documented.
- [ ] Document set approved.
- [ ] Repository access granted per institutional rule.
- [ ] Handover session delivered to «Client Representative».
- [ ] Known limitations communicated in writing (TSD §7).

Post-implementation review, one month after handover or after the first rain
event: were the benefits realised, did the system hold up, what was missing, and
should the next increment be authentication or incident intake?
