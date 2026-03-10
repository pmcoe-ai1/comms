# CRM Type Safety Retrofit — Progress Tracker

**Project:** Clone PM CoE → CRM, eliminate type safety deficiency
**Brief:** `packages/Architecture/PLAN.md`
**Started:** 2026-03-10

---

## How to Update This File

Every agent updates this file after completing a step:
1. Change the step's Status from `PENDING` to `DONE` (or `BLOCKED`)
2. Fill in the Result column with the measured outcome
3. Add the Date and Agent
4. If blocked, add a note explaining why in the Blockers section at the bottom

**Agents:** Full-Stack (FS), Solution Architect (SA)

---

## Phase A: Type Contracts

### Mode 1 — Feature Development

| Step | Description | Agent | Status | Result | Date |
|------|------------|-------|--------|--------|------|
| 0.1 | Clone PM CoE → CRM directory | FS | PENDING | | |
| 0.2 | Create GitHub remote (pmcoe-ai1/crm) | FS | PENDING | | |
| 0.3 | Verify clone — npm test passes | FS | PENDING | Baseline test count: ___ | |
| 0.4 | Update package names | FS | PENDING | | |
| A.1 | Create service-returns.ts + service-inputs.ts | FS | PENDING | Interfaces created: ___/~80 | |

### ⛔ Checkpoint — commit

### Mode 1 — Feature Development (continued)

| Step | Description | Agent | Status | Result | Date |
|------|------------|-------|--------|--------|------|
| A.2 | Add return types to service methods | FS | PENDING | Services annotated: ___/30, Methods: ___/196 | |
| A.2.1 | — LeadService (7 methods) | FS | PENDING | | |
| A.2.2 | — JourneyService (13 methods) | FS | PENDING | | |
| A.2.3 | — SurveyService (13 methods) | FS | PENDING | | |
| A.2.4 | — WidgetService (6 methods) | FS | PENDING | | |
| A.2.5 | — ScoringService (11 methods) | FS | PENDING | | |
| A.2.6 | — ExecutionService (9 methods) | FS | PENDING | | |
| A.2.7 | — ReplyService (9 methods) | FS | PENDING | | |
| A.2.8 | — TemplateService (7 methods) | FS | PENDING | | |
| A.2.9 | — AlertService (7 methods) | FS | PENDING | | |
| A.2.10 | — Remaining services | FS | PENDING | | |
| A.3 | Remove `as any` from ARIA tools | FS | PENDING | Casts remaining: ___/39 | |
| A.4 | Type MCP HTTP client | FS | PENDING | Methods typed: ___/5 | |
| A.5 | Remove `: any` from MCP tools | FS | PENDING | Casts remaining: ___/99 | |

### ⛔ Checkpoint — commit

### Mode 1 — Feature Development (continued)

| Step | Description | Agent | Status | Result | Date |
|------|------------|-------|--------|--------|------|
| A.6 | Add noImplicitAny lint rules + CI | FS | PENDING | | |

### ⛔ Mode transition → Mode 0

### Mode 0 — Static Audit

| Step | Description | Agent | Status | Result | Date |
|------|------------|-------|--------|--------|------|
| A.7 | Phase A verification audit | FS | PENDING | | |
| A.7.1 | — `as any` in ARIA tools = 0 | FS | PENDING | Count: ___ | |
| A.7.2 | — `: any` in MCP tools = 0 (precise check) | FS | PENDING | Count: ___ | |
| A.7.3 | — npm test passes (baseline match) | FS | PENDING | Tests: ___/___ | |
| A.7.4 | — tsc --noEmit = 0 errors | FS | PENDING | Errors: ___ | |
| A.7.5 | — noImplicitAny enforced | FS | PENDING | | |
| A.7.6 | — Drift detection works (manual) | FS | PENDING | | |

**Phase A Status:** NOT STARTED

---

## ⛔ HANDOFF: Architect authors canonical models

## Phase B: Canonical Models

### Architect Deliverable

| Step | Description | Agent | Status | Result | Date |
|------|------------|-------|--------|--------|------|
| B.3 | Author lead-management canonical model | SA | PENDING | Entities: ___, Fields: ___, Scenarios: ___ | |
| B.3.1 | Author journey-engine canonical model | SA | PENDING | Entities: ___, Fields: ___, Scenarios: ___ | |
| B.3.2 | Author survey-feedback canonical model | SA | PENDING | Entities: ___, Fields: ___, Scenarios: ___ | |
| B.3.3 | Author monetization canonical model | SA | PENDING | Entities: ___, Fields: ___, Scenarios: ___ | |
| B.3.4 | Author scoring-alerts canonical model | SA | PENDING | Entities: ___, Fields: ___, Scenarios: ___ | |
| B.3.5 | Author platform canonical model | SA | PENDING | Entities: ___, Fields: ___, Scenarios: ___ | |

### Mode 1 — Feature Development

| Step | Description | Agent | Status | Result | Date |
|------|------------|-------|--------|--------|------|
| B.1 | Install FABRIC tooling (git submodule) | FS | PENDING | Submodule commit: ___ | |
| B.2 | Create fabric.config.json | FS | PENDING | | |
| B.4 | Run full pipeline (validate → template-generator → fill → gate → codegen) | FS | PENDING | Domains passing: ___/6 | |
| B.4.5 | Artifact integration & schema reconciliation | FS | PENDING | Discrepancies: ___ | |

### ⛔ Checkpoint — commit

### Mode 1 — Feature Development (continued)

| Step | Description | Agent | Status | Result | Date |
|------|------------|-------|--------|--------|------|
| B.5 | Replace hand-written types with generated | FS | PENDING | Domains migrated: ___/6 | |

### ⛔ Checkpoint — commit

### Mode 1 — Feature Development (continued)

| Step | Description | Agent | Status | Result | Date |
|------|------------|-------|--------|--------|------|
| B.6 | Add FABRIC to CI (validate + gate + codegen + tsc) | FS | PENDING | | |

### ⛔ Mode transition → Mode 0

### Mode 0 — Static Audit

| Step | Description | Agent | Status | Result | Date |
|------|------------|-------|--------|--------|------|
| B.7 | Phase B verification audit | FS | PENDING | | |
| B.7.1 | — All canonical models validate (0 gaps) | FS | PENDING | Gap flags: ___ | |
| B.7.2 | — All gate passes succeed (Pass 1-4, all domains) | FS | PENDING | Passes: ___/24 | |
| B.7.3 | — No hand-written interfaces remain | FS | PENDING | Count: ___ | |
| B.7.4 | — npm test passes (Phase A match) | FS | PENDING | Tests: ___/___ | |
| B.7.5 | — tsc --noEmit = 0 errors | FS | PENDING | Errors: ___ | |
| B.7.6 | — Drift detection via canonical model | FS | PENDING | | |
| B.7.7 | — Phase A checks still pass | FS | PENDING | | |

**Phase B Status:** NOT STARTED

---

## Metrics

| Metric | Baseline | After Phase A | After Phase B |
|--------|----------|---------------|---------------|
| `as any` in ARIA tools | 39 | | |
| `: any` in MCP tools | 99 | | |
| Service methods with return types | 0/196 | | |
| Shared type imports in tool files | 0 | | |
| Test count | | | |
| tsc errors | | | |
| Canonical models validated | 0 | 0 | |
| Generated type domains | 0 | 0 | |
| Gate passes (filled templates) | 0 | 0 | |

---

## Blockers

| Date | Step | Agent | Description | Resolution |
|------|------|-------|-------------|------------|
| | | | | |

---

## Commits

| Date | Step(s) | Agent | Commit Hash | Message |
|------|---------|-------|-------------|---------|
| | | | | |

---

*Last updated: 2026-03-10 by SA (reclassified modes, added B.4.5 and gate pass tracking)*
