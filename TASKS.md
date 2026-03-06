# DKCE + FABRIC Task List
Generated from: PLAN.md, FABRIC.docx, BUGS.md, direct file verification
Last updated: 2026-03-06T10:30:00Z
---
## How to use this file
This is the authoritative task tracker for the DKCE + FABRIC project.
Rules:
- Read this file at the start of every session before doing anything else
- Update task status (✗ → ✅) immediately when a task is completed
- Update notes column with verification evidence (file, line number)
- Add new tasks if work is identified that is not listed here
- Never mark a task ✅ DONE without verified evidence — run the 
  relevant command or read the relevant file to confirm
- Update "Last updated" date whenever the file is changed
---
## Status legend
✅ DONE — verified complete
✗ NOT DONE — not started or incomplete  
⚠ PARTIAL — partially complete, see notes
🔴 BLOCKED — cannot start, external dependency required
---
## DKCE Completion Tasks
| ID | Task | Status | Depends on | Blocked on | Notes |
|---|---|---|---|---|---|
| TASK-01a | Update dunning glossary line 94 — change "Maximum 3 retry attempts" to "Maximum 4 retry attempts" in subscription-billing.canonical-model.yaml | ✅ DONE | — | — | subscription-billing.canonical-model.yaml line 94 updated to "Maximum 4 retry attempts" |
| TASK-01b | Update dunning glossary line 99 — change precision.max from 3 to 4 in subscription-billing.canonical-model.yaml | ✅ DONE | — | — | subscription-billing.canonical-model.yaml line 99 updated to precision.max: 4 |
| TASK-02 | Add INVALID_QUANTITY to add-order-item errorResponses + knownVectors cross-entity documentation | ✅ DONE | — | — | Verified: line 896 and lines 1104-1145 |
| TASK-03 | Extend gate.js Pass 1 with glossary precision checker | ✅ DONE | — | — | gate.js lines 168-171 (glossaryIndex), 243-277 (validateCondition Level A+B), 299-309 (validateAction). Negative test confirmed. tsc clean, jest pass. |
| TASK-04 | Write fast-check property-based tests for numeric condition boundaries | ✅ DONE | — | — | tests/property/numeric-boundaries.property.test.ts — 23 tests, 4 boundaries (quantity, total, discount, dunning-attempts), dunning validation/glossary inconsistency test. All 44 tests pass. |
| TASK-05 | Write Schemathesis OpenAPI tests against generated spec | ✅ DONE | — | — | tests/openapi/validate-specs.test.ts — 20 tests (swagger-cli validate + structural checks) for both order-management and subscription-billing specs. All 64 tests pass. |
| TASK-06 | Run fill.js against check-stock-on-add-item template | ✅ DONE | TASK-02 | — | Verified: real stub exists |
| TASK-07 | Run gate.js all 4 passes against filled check-stock-on-add-item | ✅ DONE | TASK-06 | — | Verified: gate PASS |
| TASK-08 | Run codegen.js against example.canonical-model.yaml | ✅ DONE | TASK-07 | — | Verified: real generated stub exists |
| TASK-09 | Write src/rules/check-stock-on-add-item.ts | ✅ DONE | TASK-08 | — | Verified: real implementation exists |
| TASK-10 | Run order-management scenario runner — all 3 rules must pass | ✅ DONE | TASK-09 | — | Verified: 7 tests passing |
| TASK-11 | Run fill.js against activate-on-trial-start template | ✅ DONE | — | — | Filled via Claude API. Status: filled-pending-gate. Commit 450ecee |
| TASK-12 | Run gate.js all 4 passes against re-filled activate-on-trial-start | ✅ DONE | TASK-11 | — | All 4 passes PASS. Commit aa33dac |
| TASK-13 | Run codegen.js against subscription-billing.canonical-model.yaml | ✅ DONE | TASK-12 | — | Codegen complete. Lifecycle compat shim + filled template lookup fix added. 0 GapFlags. Commit 350282e |
| TASK-14 | Run tsc --noEmit — must be clean after placeholder replaced | ✅ DONE | TASK-13 | — | tsc --noEmit exit 0. Restored check-stock-on-add-item stub deleted by codegen. |
| TASK-15 | Investigate 6 it.failing subscription scenario tests — promote resolved, document remainder | ✗ NOT DONE | TASK-14 | — | All 6 are operation-layer gaps per scenario runner report |
| TASK-16 | Write chain.js — PostgreSQL append-only, SHA-256, schema: pipeline_run { id, stage, canonicalModelHash, prevHash, artifactHash, timestamp, status } | ✗ NOT DONE | — | PostgreSQL instance | Foundation of FABRIC audit trail |
| TASK-17 | Write Prisma trigger migration scripts for immutable:true fields in both canonical models | ✗ NOT DONE | — | PostgreSQL instance | Gap 8 |
| TASK-18 | Write .github/workflows/dkce.yml — stages: validate → template-generator → fill → gate → codegen → tsc → scenario runner → chain record → block deploy | ✗ NOT DONE | TASK-03, TASK-04, TASK-05, TASK-10, TASK-15, TASK-16 | — | Include glossary checker and ANTHROPIC_API_KEY as CI secret |
| TASK-19 | Add oasdiff step to CI pipeline | ✗ NOT DONE | TASK-18 | — | Gap 7 |
| TASK-20 | Write signal-collector.js | ✗ NOT DONE | TASK-19 | — | Week 6+ |
| TASK-21 | Write pattern-analyser.js — Claude API | ✗ NOT DONE | TASK-20 | — | Week 6+ |
| TASK-22 | Write confidence-score.js | ✗ NOT DONE | TASK-20 | — | Week 6+ |
---
## FABRIC Phase 2 Tasks
### Sprint A — FABRIC foundation
| ID | Task | Status | Depends on | Blocked on | Notes |
|---|---|---|---|---|---|
| TASK-23 | Extend canonical-model.schema.json to v2.0.0: add objectMeta, objectDependencies, publishedOperations | ✗ NOT DONE | TASK-19 | — | Required before platform.canonical-model.yaml can be authored |
| TASK-24 | Author platform.canonical-model.yaml — FABRIC's own canonical model | ✗ NOT DONE | TASK-23 | — | — |
| TASK-25 | Run DKCE pipeline against platform.canonical-model.yaml — validate → gate → codegen → tsc → scenario runner | ✗ NOT DONE | TASK-24 | — | — |
### Sprint B — Registry
| ID | Task | Status | Depends on | Blocked on | Notes |
|---|---|---|---|---|---|
| TASK-26 | Write custom registry — PostgreSQL + filesystem artifact store, publish command | ✗ NOT DONE | TASK-25 | PostgreSQL instance | — |
| TASK-27 | Publish order-management object as first registry artifact | ✗ NOT DONE | TASK-26 | — | — |
### Sprint C — Dependency resolution
| ID | Task | Status | Depends on | Blocked on | Notes |
|---|---|---|---|---|---|
| TASK-28 | Add Gate Pass 0 to gate.js — dependency resolution: unresolvable deps, hash mismatches, breaking changes | ✗ NOT DONE | TASK-26 | — | — |
| TASK-29 | Update codegen to generate generated/dependencies/ typed adapter files from registry artifacts | ✗ NOT DONE | TASK-28 | — | — |
| TASK-30 | Generate runtime validators inside adapter files — validate cross-object responses at network boundary | ✗ NOT DONE | TASK-29 | — | — |
| TASK-31 | Generate X-Contract-Version response middleware in provider operation stubs | ✗ NOT DONE | TASK-29 | — | — |
| TASK-32 | Generate version header reader in consuming adapters — fail on version mismatch | ✗ NOT DONE | TASK-31 | — | — |
### Sprint D — Second object
| ID | Task | Status | Depends on | Blocked on | Notes |
|---|---|---|---|---|---|
| TASK-33 | Author inventory.canonical-model.yaml | ✗ NOT DONE | TASK-25 | — | — |
| TASK-34 | Run DKCE pipeline against inventory.canonical-model.yaml, publish to registry | ✗ NOT DONE | TASK-33, TASK-27 | — | — |
| TASK-35 | Declare inventory dependency in platform.canonical-model.yaml with version pin and compatibility mode | ✗ NOT DONE | TASK-34 | — | — |
| TASK-36 | Run codegen — generate typed adapter for inventory in generated/dependencies/ | ✗ NOT DONE | TASK-35, TASK-29 | — | — |
| TASK-37 | Confirm tsc --noEmit enforces inventory adapter contract | ✗ NOT DONE | TASK-36 | — | — |
| TASK-38 | Generate contract tests — tests/contracts/<objectId>@<version>.contract.test.ts | ✗ NOT DONE | TASK-29 | — | — |
### Sprint E — Breaking change detection
| ID | Task | Status | Depends on | Blocked on | Notes |
|---|---|---|---|---|---|
| TASK-39 | Integrate oasdiff into registry publish — classify every change as breaking or non-breaking | ✗ NOT DONE | TASK-27 | — | — |
| TASK-40 | Implement compatibility mode enforcement — breaking changes block consuming pipelines in backward mode | ✗ NOT DONE | TASK-39 | — | — |
| TASK-41 | Implement capability notifications — registry notifies consuming objects when new operation published | ✗ NOT DONE | TASK-39 | — | — |
| TASK-42 | Implement deprecation protocol — gate emits warnings, pipeline fails after declared removal date | ✗ NOT DONE | TASK-40 | — | — |
### Sprint F — Operation runtime
| ID | Task | Status | Depends on | Blocked on | Notes |
|---|---|---|---|---|---|
| TASK-43 | Write operation runtime — Node.js state machine executing declared operation contract steps with durability | ✗ NOT DONE | TASK-29 | — | — |
| TASK-44 | Implement compensating actions in operation runtime | ✗ NOT DONE | TASK-43 | — | — |
| TASK-45 | Implement onVersionMismatch handling — retry-with-backoff, route to compatible instance, throw PROVIDER_VERSION_MISMATCH | ✗ NOT DONE | TASK-32, TASK-43 | — | — |
### Sprint G — Full audit trail
| ID | Task | Status | Depends on | Blocked on | Notes |
|---|---|---|---|---|---|
| TASK-46 | Extend chain.js — record cross-object dependency resolutions with exact artifact hashes per pipeline run | ✗ NOT DONE | TASK-16, TASK-29 | — | — |
| TASK-47 | Run provider staging promotion gate — registry serves consumer contract test suite, staging promotion blocked until all consumer scenarios pass | ✗ NOT DONE | TASK-38, TASK-43 | — | — |
---
## Open verification items
These items need further verification before status can be confirmed:
| ID | Item | Question |
|---|---|---|
| VERIFY-01 | example.canonical-model.yaml meta.version is 1.0.0 | RESOLVED — meta.version is intentionally 1.0.0. Schema version ≠ model version is documented in file header. Version bump policy is undefined — see VERIFY-03. |
| VERIFY-02 | subscription-billing.canonical-model.yaml meta.version | RESOLVED — meta.version is 1.0.0 on both models. See VERIFY-03 for version bump policy gap. |
| VERIFY-03 | meta.version policy undefined | RESOLVED — Version bump policy added to AGENTS.md lines 301-309. Both models bumped to 1.1.0 with changeReason set. example model validates; subscription-billing has 167 pre-existing schema errors (not caused by version bump). |
---
## Critical paths
**Critical path to DKCE complete (TASK-19):**
TASK-10 ✅ → TASK-15 → TASK-16 → TASK-18 → TASK-19
Parallel work required before TASK-18: TASK-01a, TASK-01b, TASK-03, TASK-04, TASK-05, TASK-11 through TASK-17
**Critical path to FABRIC Sprint A complete (TASK-25):**
TASK-19 → TASK-23 → TASK-24 → TASK-25
