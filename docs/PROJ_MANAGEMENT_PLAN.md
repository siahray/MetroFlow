# Project Management Plan — MetroFlow

| Field             | Value                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| Document ID       | MF-PMP-001                                                                   |
| Version           | 1.0 (Draft)                                                                  |
| Status            | For academic review                                                          |
| Date              | 21 October 2026                                                              |
| Prepared by       | «Project Team»                                                               |
| Reviewed by       | «Project Adviser»                                                            |
| Approved by       | «Project Sponsor»                                                            |
| Related documents | [PROJECT_CHARTER.md](PROJECT_CHARTER.md), [FSD.md](FSD.md), [TSD.md](TSD.md) |

## Revision history

| Version | Date        | Author         | Change                  |
| ------- | ----------- | -------------- | ----------------------- |
| 1.0     | 21 Oct 2026 | «Project Team» | Initial management plan |

## 1. Purpose and audience

This plan defines how the project is executed and controlled: lifecycle,
schedule, quality, resources, communication, risk and change. It is the working
document for the team and the evidence of process for the adviser and panel.

It does not restate requirements; those live in [BRD.md](BRD.md) and
[FSD.md](FSD.md).

## 2. Project lifecycle and methodology

### 2.1 Approach

An **incremental delivery with weekly iterations**, wrapped in the fixed
milestones required by the academic calendar. Each increment produces something
demonstrable:

| Increment | Demonstrable outcome                                |
| --------- | --------------------------------------------------- |
| I1        | Database schema, seed graph, network state endpoint |
| I2        | Rainfall simulation with persisted state            |
| I3        | Clearance-aware routing with GeoJSON output         |
| I4        | Portal shell, login screen and dashboard layout     |
| I5        | Triage queue, detail panel and operations log       |
| I6        | Dispatch actions, hardening, hosted migrations      |
| I7        | Documentation set, defence preparation              |

### 2.2 Ceremonies

| Ceremony            | Frequency                | Output                                 |
| ------------------- | ------------------------ | -------------------------------------- |
| Planning            | Weekly, start            | Iteration goal, task breakdown, owners |
| Stand-up            | Twice weekly, 15 minutes | Blockers, hand-offs                    |
| Review with adviser | Bi-weekly                | Feedback, scope decisions              |
| Retrospective       | Weekly, end              | One process change carried forward     |
| Demo                | At each milestone        | Working software, not slides           |

### 2.3 Definition of done

A work item is done when:

1. The change is merged to `main`.
2. Unit and contract tests pass for the affected area.
3. Lint and build pass for the web app when touched.
4. The relevant requirement in the FSD is updated to its true status.
5. No new High or Medium ZAP finding is introduced.

## 3. Assumptions, constraints and scope baseline

| Type       | ID     | Statement                                                           | Owner                       |
| ---------- | ------ | ------------------------------------------------------------------- | --------------------------- |
| Assumption | A-01   | PostGIS-capable PostgreSQL is available for development and hosting | «Backend Lead»              |
| Assumption | A-02   | The pilot corridor is representative enough to demonstrate routing  | «Project Team Lead»         |
| Assumption | A-03   | Free or institutional tiers suffice for the pilot                   | «Project Team Lead»         |
| Assumption | A-04   | Dispatchers have a modern desktop browser and connectivity          | «Client Representative»     |
| Assumption | A-05   | Rainfall intensity is supplied manually or from public data         | «Backend Lead»              |
| Assumption | A-06   | The client provides corridor and barangay naming                    | «Client Representative»     |
| Constraint | C-01   | Delivery must fit the academic term                                 | «Project Team Lead»         |
| Constraint | C-02   | Team effort is part-time                                            | «Project Team Lead»         |
| Constraint | C-03   | No paid Code Security, so CodeQL cannot run on the private repo     | «QA and Documentation Lead» |
| Constraint | C-04   | Only synthetic or public data may be used                           | «Client Representative»     |
| Constraint | C-05   | Credentials are secrets and never committed                         | «Backend Lead»              |
| Dependency | DEP-01 | Hosted database connection string supplied as a repository secret   | «Client Representative»     |
| Dependency | DEP-02 | Adviser and panel availability for reviews                          | «Project Adviser»           |
| Dependency | DEP-03 | Client confirms the pilot corridor                                  | «Client Representative»     |

The scope baseline is [PROJECT_CHARTER.md](PROJECT_CHARTER.md) §4. Assumptions
are reviewed at each milestone; an invalidated assumption is raised as an issue
and, if it changes scope, as a change request.

## 4. Scope and change control

### 4.1 Change triggers

A change request is required when a request:

- adds or removes a deliverable, actor or integration;
- moves an item across the in-scope/out-of-scope boundary;
- changes a `Must` requirement;
- changes the schedule by more than one week or the budget by any amount;
- changes an architecture decision recorded in TSD §16.

### 4.2 Change process

```
Request → Log (CR-nn) → Impact assessment → Decision → Update documents → Implement
             │                 │                  │
             │                 │                  └─ Approve / Defer / Reject
             │                 └─ Scope, schedule, cost, risk, quality
             └─ Raised by anyone; recorded by the PM lead
```

| Step      | Owner                                                    | Artefact                                 |
| --------- | -------------------------------------------------------- | ---------------------------------------- |
| Raise     | Any stakeholder                                          | Change request form (appendix A.2)       |
| Assess    | «Project Team Lead» with affected lead                   | Impact note: scope, schedule, cost, risk |
| Decide    | «Project Sponsor»; adviser consulted for academic impact | Decision recorded in the CR              |
| Update    | «QA and Documentation Lead»                              | Affected documents and FSD status        |
| Implement | Assigned developer                                       | Pull request referencing the CR id       |

No change is implemented before a decision is recorded. Emergency fixes for a
broken `main` may proceed, with the CR raised the same day.

### 4.3 Scope control metrics

| Metric                                  | Target          |
| --------------------------------------- | --------------- |
| Change requests decided within one week | 100%            |
| Requirements marked `Must` after M2     | No net increase |
| Out-of-scope work merged without a CR   | 0               |

## 5. Schedule management

### 5.1 Milestones

Dates `[TBC]` pending the academic calendar; weeks are relative to project start.

| ID  | Milestone                           | Weeks | Exit criteria                                         |
| --- | ----------------------------------- | ----- | ----------------------------------------------------- |
| M1  | Charter and requirements approved   | 1–2   | Charter and BRD signed off; baseline data plan agreed |
| M2  | Architecture and data design frozen | 3–5   | TSD accepted; schema drafted; ADRs recorded           |
| M3  | API engine operational              | 6–9   | Network, simulation and routing pass contract tests   |
| M4  | Portal operational                  | 10–12 | Triage flow demonstrated end-to-end                   |
| M5  | Hardening complete                  | 13–14 | ZAP clean at High/Medium; no open critical defects    |
| M6  | Documentation and defence           | 15–16 | Document set accepted; demonstration delivered        |

### 5.2 Phase plan

| Phase          | Work packages                                                       | Key output       |
| -------------- | ------------------------------------------------------------------- | ---------------- |
| Initiation     | 1.1 charter, 1.2 stakeholder map, 1.3 baseline plan                 | Approved charter |
| Requirements   | 2.1 BRD, 2.2 personas, 2.3 acceptance criteria                      | Approved BRD     |
| Design         | 3.1 architecture, 3.2 data model, 3.3 algorithms, 3.4 security      | TSD draft        |
| Build — engine | 4.1 schema and migrations, 4.2 hydrology, 4.3 routing, 4.4 API      | Working API      |
| Build — portal | 5.1 shell, 5.2 queue, 5.3 detail, 5.4 actions                       | Working portal   |
| Assurance      | 6.1 unit tests, 6.2 contract tests, 6.3 CI gates, 6.4 security scan | Green pipeline   |
| Delivery       | 7.1 hosted migrations, 7.2 documentation, 7.3 demonstration         | Accepted system  |

### 5.3 Critical path

```
requirements → data model → simulation → routing → API contract
                                                   │
                        portal shell → queue → detail → actions
                                                   │
                                            CI gates → hardening → defence
```

The critical path runs through the data model, the routing engine and the
contract tests. The portal can be built in parallel but cannot be declared done
before the queue and detail panels share the same state.

### 5.4 Schedule control

| Control             | Cadence           | Action on variance                                 |
| ------------------- | ----------------- | -------------------------------------------------- |
| Iteration burn-down | Weekly            | Re-plan next iteration; escalate if variance > 20% |
| Milestone review    | At each milestone | Re-baseline only with a change request             |
| Dependency check    | Weekly            | Chase DEP-01 and DEP-03 owners                     |

## 6. Cost management

| Item                  | Basis                            | Status |
| --------------------- | -------------------------------- | ------ |
| Development effort    | In-kind, tracked in person-hours | [TBC]  |
| Hosted database       | Supabase tier                    | [TBC]  |
| Application hosting   | Provider plan                    | [TBC]  |
| Domain and TLS        | Registrar                        | [TBC]  |
| Test devices and data | Institutional                    | [TBC]  |
| Contingency           | 10% of the above                 | [TBC]  |

Cost control rules:

1. No paid service is subscribed without sponsor approval.
2. Free tiers are the default; exceeding one requires a documented reason.
3. Effort is tracked weekly so the in-kind cost in the business case is real, not
   estimated at the end.

## 7. Quality management

### 7.1 Quality objectives

| Objective                     | Measure                                      | Target   |
| ----------------------------- | -------------------------------------------- | -------- |
| Requirements are met          | `Must` requirements implemented and verified | 100%     |
| Behaviour is protected        | Automatic tests on `main`                    | Green    |
| Schema is consistent          | `alembic check`                              | No drift |
| Security baseline holds       | ZAP High/Medium findings                     | 0        |
| Portal builds                 | Lint and build                               | Green    |
| Documentation matches reality | FSD status equals implementation             | 100%     |

### 7.2 Quality gates

| Gate                 | When                   | Owner                       | Evidence          |
| -------------------- | ---------------------- | --------------------------- | ----------------- |
| Requirements review  | M1                     | «Project Adviser»           | Signed BRD        |
| Design review        | M2                     | «Project Adviser»           | TSD accepted      |
| Code review          | Every pull request     | Peer reviewer               | Approved PR       |
| Automated tests      | Every push             | CI                          | Workflow run      |
| Security scan        | Weekly and pre-release | «QA and Documentation Lead» | ZAP report        |
| Usability check      | M4 and M5              | «Frontend Lead»             | Observation notes |
| Documentation review | M6                     | «Project Adviser»           | Document set      |

### 7.3 Review checklist

- [ ] Requirement id referenced in the pull request.
- [ ] Tests added or updated for changed behaviour.
- [ ] No secret, credential or personal data in the diff.
- [ ] FSD status updated if behaviour changed.
- [ ] Migration added if the schema changed, with a working downgrade.
- [ ] Accessibility considered for UI changes (label, focus, keyboard).

## 8. Resource and team management

### 8.1 Roles

| Role                      | Assigned to                 | Accountability                         |
| ------------------------- | --------------------------- | -------------------------------------- |
| Project Sponsor           | «Project Sponsor»           | Authority, funding, acceptance         |
| Project Adviser           | «Project Adviser»           | Academic quality, scope gate           |
| Client Representative     | «Client Representative»     | Operational input, data access         |
| Project Team Lead         | «Project Team Lead»         | Delivery, architecture, change control |
| Backend Lead              | «Backend Lead»              | Simulation, routing, schema, API       |
| Frontend Lead             | «Frontend Lead»             | Portal usability and behaviour         |
| QA and Documentation Lead | «QA and Documentation Lead» | Tests, CI gates, document set          |

Roles may be combined. Every role must have a named person before M2.

### 8.2 RACI

R = responsible, A = accountable, C = consulted, I = informed.

| Activity          | Sponsor | Adviser | Client | Team Lead | Backend | Frontend | QA/Docs |
| ----------------- | ------- | ------- | ------ | --------- | ------- | -------- | ------- |
| Charter           | A       | C       | C      | R         | I       | I        | I       |
| BRD               | A       | C       | C      | R         | C       | C        | C       |
| Business case     | A       | C       | C      | R         | I       | I        | C       |
| FSD               | I       | C       | C      | A         | R       | R        | R       |
| TSD               | I       | C       | I      | A         | R       | C        | C       |
| Simulation engine | I       | I       | I      | A         | R       | I        | C       |
| Routing engine    | I       | I       | I      | A         | R       | I        | C       |
| Portal            | I       | I       | C      | A         | C       | R        | C       |
| Test strategy     | I       | I       | I      | A         | C       | C        | R       |
| CI/CD gates       | I       | I       | I      | A         | C       | C        | R       |
| Security scan     | I       | I       | I      | A         | C       | I        | R       |
| Hosted migration  | I       | I       | C      | A         | R       | I        | C       |
| Documentation set | A       | C       | I      | R         | C       | C        | R       |
| Demonstration     | A       | C       | C      | R         | R       | R        | C       |

### 8.3 Capacity

| Constraint                            | Effect                                                |
| ------------------------------------- | ----------------------------------------------------- |
| Part-time effort alongside coursework | Plan for 60–70% of nominal hours                      |
| Single person per lead role           | No redundancy; pair on critical paths                 |
| No dedicated designer                 | Portal uses a fixed visual language established at I4 |

## 9. Communications management

### 9.1 Stakeholder communication

| Audience     | Information                       | Frequency     | Channel                | Owner         |
| ------------ | --------------------------------- | ------------- | ---------------------- | ------------- |
| Team         | Plan, blockers, decisions         | Twice weekly  | Stand-up               | Team Lead     |
| Adviser      | Progress, risks, decisions needed | Bi-weekly     | Review meeting         | Team Lead     |
| Sponsor      | Milestone status, change requests | At milestones | Written status report  | Team Lead     |
| Client users | Demonstration, usability feedback | M4 and M5     | Session                | Frontend Lead |
| Panel        | Document set, demonstration       | M6            | Submission and defence | Team Lead     |

### 9.2 Artefacts

| Artefact       | Cadence               | Stored in                              |
| -------------- | --------------------- | -------------------------------------- |
| Iteration plan | Weekly                | Repository issue tracker               |
| Status report  | At milestones         | `docs/` or shared drive                |
| Risk register  | Updated weekly        | PMP §10                                |
| Decision log   | As decisions are made | TSD §16 (architecture), CR log (scope) |
| Meeting notes  | Per review            | Shared drive                           |

### 9.3 Escalation

1. Blocker raised at stand-up; owner attempts resolution within one day.
2. Unresolved: escalated to «Project Team Lead».
3. Cross-team or scope impact: escalated to «Project Adviser» and, if scope
   changes, to «Project Sponsor» as a change request.
4. Academic or ethical concern: «Project Adviser» immediately.

## 10. Risk management

### 10.1 Method

Probability and impact are scored High (3), Medium (2), Low (1); the score is
their product. Risks scoring 6 or above are reviewed weekly. Each risk has a
trigger so it is recognised rather than discovered.

### 10.2 Register

| ID   | Risk                                                | P   | I   | Score | Response                                                                                       | Trigger                                  | Owner         |
| ---- | --------------------------------------------------- | --- | --- | ----- | ---------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------- |
| R-01 | Scope creep into native apps, sensors and auth      | 3   | 3   | 9     | Hold the charter boundary; every addition needs a CR                                           | New feature requested mid-iteration      | Team Lead     |
| R-02 | Hydrological model judged unrealistic               | 3   | 3   | 9     | Declare calibration constants; validate against documented events; present as decision support | Adviser or client challenges outputs     | Backend Lead  |
| R-03 | Loss of a team member                               | 2   | 3   | 6     | Pair on critical paths; decisions recorded in the TSD                                          | Missed stand-ups; unavailable for a week | Team Lead     |
| R-04 | Hosted database never configured                    | 3   | 2   | 6     | Local stack is the primary demo; CD is gated and visible                                       | Secret still absent at M5                | Backend Lead  |
| R-05 | Security findings surface late                      | 2   | 3   | 6     | Weekly ZAP gate from the first increment                                                       | New Medium finding                       | QA/Docs       |
| R-06 | Institutional format differs from this document set | 2   | 2   | 4     | Confirm the rubric at M1                                                                       | Adviser requests restructuring           | Team Lead     |
| R-07 | Authentication not delivered                        | 3   | 3   | 9     | State the limitation; schedule as first post-pilot increment                                   | Pilot asked to handle real data          | Team Lead     |
| R-08 | No baseline data from the client                    | 3   | 2   | 6     | Use audit-trail and risk benefits; collect during pilot                                        | Baseline still absent at M1 review       | Client Rep    |
| R-09 | Pilot corridor changes late                         | 2   | 3   | 6     | Freeze the corridor at M2; changes need a CR                                                   | New barangay list arrives                | Client Rep    |
| R-10 | Hosted costs exceed free tier                       | 2   | 2   | 4     | Keep hosting provider-agnostic; container is portable                                          | Usage warning from provider              | Backend Lead  |
| R-11 | GitHub or Supabase outage during a milestone        | 1   | 3   | 3     | Work locally; defer hosted verification                                                        | Provider status page                     | Team Lead     |
| R-12 | Dispatchers reject the tool                         | 2   | 3   | 6     | Usability sessions from M4; keep radio process running                                         | Negative feedback in session             | Frontend Lead |
| R-13 | A commercial platform is chosen later               | 1   | 2   | 2     | Publish the API contract; routing engine outlives the portal                                   | Procurement announcement                 | Team Lead     |
| R-14 | Personal data incident during testing               | 1   | 3   | 3     | Synthetic data only; RLS verified; no PII in logs                                              | Any real report used in a demo           | QA/Docs       |

### 10.3 Risk review

At each weekly planning session:

1. Re-score open risks.
2. Record any new risk with a trigger.
3. Confirm the response owner and next action.
4. Close risks whose trigger can no longer occur.

## 11. Issue management

| Severity | Definition                                     | Response time               |
| -------- | ---------------------------------------------- | --------------------------- |
| S1       | `main` broken, data loss, or security exposure | Same day                    |
| S2       | A `Must` requirement not working               | Within two working days     |
| S3       | Cosmetic or non-blocking defect                | Next iteration              |
| S4       | Enhancement request                            | Triaged as a change request |

Issues are logged with reproduction steps, expected and actual behaviour, and the
requirement id. An S1 issue may bypass the normal change process; the record is
raised the same day.

## 12. Procurement and tooling

| Item                  | Choice                      | Cost                                    | Decision |
| --------------------- | --------------------------- | --------------------------------------- | -------- |
| Source control and CI | GitHub (private repository) | Free tier / institutional               | In use   |
| Hosted database       | Supabase                    | Free tier, upgrade [TBC]                | In use   |
| Application hosting   | Not selected                | [TBC]                                   | Deferred |
| Container registry    | GHCR                        | Included                                | In use   |
| Security scanning     | OWASP ZAP                   | Open source                             | In use   |
| Static analysis       | CodeQL                      | Requires Code Security on private repos | Blocked  |
| Package updates       | Dependabot                  | Included                                | In use   |
| Documentation         | Markdown in the repository  | Free                                    | In use   |

No purchase is made without sponsor approval (charter §7).

## 13. Stakeholder engagement

| Stakeholder       | Interest                     | Influence | Engagement                                   |
| ----------------- | ---------------------------- | --------- | -------------------------------------------- |
| Dispatchers       | Tool must not slow them down | High      | Shadowing, usability sessions, feedback loop |
| MDRRMC commander  | Verifiable corridor status   | High      | Milestone demos, review of KPI targets       |
| LGU IT            | Maintainability and access   | Medium    | Handover session, runbook                    |
| Citizens          | Faster response, privacy     | Low       | Communicated through the LGU                 |
| Adviser and panel | Rigour                       | High      | Bi-weekly review, document set               |

Engagement risks are covered by R-08 and R-12. The mitigation is early, visible
contact rather than a demonstration at the end.

## 14. Configuration and documentation management

### 14.1 Version control

| Item            | Rule                                                      |
| --------------- | --------------------------------------------------------- |
| Branching       | Short-lived feature branches; `main` is always releasable |
| Commit messages | Imperative summary; body explains why, not what           |
| Pull requests   | Require review, green CI, and a requirement reference     |
| Tags            | `backend-v*` for container releases                       |
| Secrets         | Never committed; `.env` ignored; repository secrets only  |

### 14.2 Pre-commit enforcement

A Husky hook runs:

- Ruff for Python (`scripts/pre-commit-ruff.sh`).
- ESLint and Prettier through `lint-staged` for the web app.

The hook is fast enough to run on every commit; anything heavier belongs in CI.

### 14.3 Documentation control

| Rule          | Detail                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Single source | Each document has one owner and lives in `docs/`                                        |
| Versioning    | Document version increments on approval; revision history updated                       |
| Traceability  | Requirement ids are stable; changes add rows, they do not renumber                      |
| Consistency   | A scope or architecture change updates every affected document in the same pull request |
| Unknowns      | `[TBC]` and `«placeholder»` are explicit, never silently invented                       |

### 14.4 Environment configuration

Configuration is externalised (`METROFLOW_*`, `DATABASE_URL`,
`SUPABASE_DB_URL`), so the same artefact runs in every environment. The full
table is in TSD §15.

## 15. Monitoring and control

### 15.1 Project metrics

| Metric                 | Definition                              | Target     | Cadence   |
| ---------------------- | --------------------------------------- | ---------- | --------- |
| Iteration completion   | Planned items completed / planned       | ≥ 80%      | Weekly    |
| CI pass rate           | Green runs / total runs                 | ≥ 95%      | Weekly    |
| Requirement coverage   | `Must` requirements implemented / total | 100% by M5 | Milestone |
| Open defects           | S1 + S2 open at review                  | 0          | Weekly    |
| Security findings      | High + Medium ZAP findings              | 0          | Weekly    |
| Documentation currency | FSD statuses matching implementation    | 100% at M6 | Milestone |

### 15.2 Status reporting

A milestone report contains: achievements against exit criteria, schedule
variance, open risks, open issues, decisions needed, and the next milestone's
confidence level.

### 15.3 Control thresholds

| Variance                       | Action                                       |
| ------------------------------ | -------------------------------------------- |
| Schedule slip ≤ 3 days         | Absorb within the iteration                  |
| Schedule slip > 1 week         | Change request; re-baseline with sponsor     |
| Any `Must` requirement at risk | Escalate to adviser immediately              |
| Security finding at High       | Stop feature work; fix before the next merge |

## 16. Closure and handover

### 16.1 Closure checklist

- [ ] All `Must` functional requirements accepted (FSD §14).
- [ ] CI green on `main`; ZAP clean at High/Medium.
- [ ] Hosted database at head, or the limitation documented.
- [ ] Document set approved.
- [ ] Source repository transferred or access granted per institutional rule.
- [ ] Handover session delivered to «Client Representative».
- [ ] Known limitations communicated in writing (TSD §17).

### 16.2 Handover package

| Item          | Contents                                                               |
| ------------- | ---------------------------------------------------------------------- |
| Source code   | Repository with history and CI configuration                           |
| Documentation | Document set plus API reference                                        |
| Runbook       | Start the stack, apply migrations, rotate secrets, roll back a release |
| Credentials   | Transferred through the institution's secret process, never by chat    |
| Training      | One session covering triage, evidence review and dispatch              |

### 16.3 Post-implementation review

Conducted one month after handover, or after the first rain event, whichever is
sooner:

| Question                                               | Evidence                              |
| ------------------------------------------------------ | ------------------------------------- |
| Were the benefits realised?                            | Baseline vs actual (BEN-01 to BEN-03) |
| Did the system hold up operationally?                  | Incident reports, availability        |
| What was missing?                                      | User feedback, defect log             |
| Should the next increment be authentication or intake? | Usage and risk evidence               |

## 17. Appendices

### A.1 Milestone status report template

```
Milestone:            M<n> — <name>
Period:               <start> to <end>
Exit criteria met:    <yes/no, with evidence>
Schedule variance:    <days>
Open risks:           <ids and scores>
Open issues:          <ids and severity>
Decisions required:   <list>
Confidence in next:   <high/medium/low + reason>
```

### A.2 Change request template

```
CR id:            CR-<nn>
Raised by:        <name>            Date: <date>
Description:      <what is being asked>
Reason:           <why>
Impact — scope:   <requirements affected>
Impact — schedule:<weeks>
Impact — cost:    <amount or none>
Impact — risk:    <new or changed risks>
Decision:         <approved / deferred / rejected>   By: <name>   Date: <date>
Documents updated:<list>
```

### A.3 Risk entry template

```
ID:          R-<nn>
Risk:        <cause → event → effect>
Probability: <H/M/L>   Impact: <H/M/L>   Score: <1-9>
Response:    <avoid / mitigate / transfer / accept>
Trigger:     <observable signal>
Owner:       <role>
Review date: <date>
```

### A.4 Decision log

| ID     | Decision                    | Date  | Decided by          | Recorded in |
| ------ | --------------------------- | ----- | ------------------- | ----------- |
| ADR-01 | Alembic owns the schema     | [TBC] | «Project Team Lead» | TSD §16     |
| ADR-02 | Supabase as hosted Postgres | [TBC] | «Project Team Lead» | TSD §16     |
| ADR-07 | RLS deny-by-default         | [TBC] | «Backend Lead»      | TSD §16     |
| ADR-11 | Portal ships with mock data | [TBC] | «Project Team Lead» | TSD §16     |
