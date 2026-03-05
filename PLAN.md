# DKCE Build Plan

## Purpose of DKCE

DKCE is the bootstrap layer for FABRIC. It is not a standalone prototype — it is the pipeline that will generate FABRIC's own governed foundation. When DKCE is complete, it will be pointed at platform.canonical-model.yaml and will generate the TypeScript interfaces, Prisma schema, OpenAPI spec, and rule stubs that FABRIC is built on top of. DKCE governs FABRIC's construction.

This changes the completion criteria for DKCE. It is not done when the order-management domain works. It is done when the pipeline is robust enough to govern the construction of a platform more complex than the order-management domain. Every gap closed in DKCE is a gap that cannot exist in FABRIC's foundation.

---

## Current status

Week 4 in progress. Gate Stage 2 confirmed passing. Field-level diff check prompt issued.

```
canonical-model.yaml
  → template-generator.js   ✓ BUILT
  → fill.js                  ✓ BUILT
  → gate.js                  ✓ BUILT (Pass 1 structural + Pass 2 semantic)
  → codegen.js               ✓ BUILT + UPDATED (Change 1 — gapflags.json blocking)
  → generated/               ✓ PRODUCED (10 files, 0 TypeScript errors)
  → src/rules/               ✓ 2 of 3 done (check-stock-on-add-item blocked — 3 GapFlags)
  → Jest + ts-jest            ✓ CONFIRMED (10 tests passing)
  → tests/scenarios/         ✓ Gate Stage 2 PASSING (7 tests, 2 it.failing for cross-entity gap)
  → Field-level diff check    ⟳ IN PROGRESS (prompt-field-diff-check.md issued)
```

**Schema version:** v1.3.0
**Canonical model:** order-management domain
**Entities:** Order, Customer, Product, OrderItem
**Rules:** 3 total — 2 fully implemented, 1 blocked on GapFlags

---

## What has been proved

1. Canonical model schema is complete enough to drive generation
2. Traceability chain is real — every generated file carries intentRef + canonicalModelVersion
3. TypeScript compiler enforces the canonical model structurally (drift wall)
4. Gate catches real issues — found missing fieldRefs in failure scenario on first run
5. transitionOrderStatus() derived from lifecycle, not hand-written
6. Tight stubs constrain AI to one reasonable implementation — proved on apply-high-value-discount and confirm-order-on-payment
7. Loose stubs surface GapFlags — proved on check-stock-on-add-item (3 GapFlags, all valid)
8. codegen.js blocks stub generation for unfilled rules and writes machine-readable gapflags.json
9. Gate Stage 2 fires correctly — 5 scenarios pass on real logic, 2 it.failing confirm cross-entity gap

---

## 6-week plan progress

```
Week 1:  Canonical model schema                               ✓ DONE
Week 2:  Template generator + AI fill + Gate Stage 1         ✓ DONE
Week 3:  Code generation pipeline end to end                  ✓ DONE
Week 4:  Application coding + Gate Stage 2                    ⟳ IN PROGRESS
Week 5:  Hash chain + CI pipeline                             ← PLANNED
Week 6+: Pattern analysis + CI feedback loop                  ← PLANNED
Phase 2: FABRIC bootstrap                                     ← AFTER DKCE COMPLETE
```

---

## Week 4 detail

### ✓ Change 1 — codegen.js blocks unfilled rules (DONE)
### ✓ Rule implementations — apply-high-value-discount, confirm-order-on-payment (DONE)
### ✗ Rule implementation — check-stock-on-add-item (BLOCKED — 3 GapFlags)
### ✓ Jest setup (DONE — 10 tests passing)
### ✓ Change 2 — scenario-runner / Gate Stage 2 (DONE — 7 tests, 0 failures)
### ⟳ Change 3 — field-level diff check in scenario runner (IN PROGRESS)
Prompt issued: prompt-field-diff-check.md. Awaiting deliberate mutation verification.
### ← Change 4 — throw-checker in gate.js (AFTER Change 3)
Scans src/ for throw statements, verifies each against canonical model errorResponses.

---

## Open GapFlags

| # | Rule | Type | Resolution |
|---|---|---|---|
| 1 | check-stock-on-add-item | UNFILLED_RULE (condition, action) | Run fill.js with ANTHROPIC_API_KEY |
| 2 | check-stock-on-add-item | Cross-entity type signature insufficient | Document operation-layer delegation in canonical model |
| 3 | check-stock-on-add-item | INVALID_QUANTITY undeclared | Add to add-order-item errorResponses in canonical model |

Resolution sequence: fill → update canonical model → re-run codegen → re-implement → re-run scenario runner.

---

## Architecture assessment gaps — resolution plan

### This sprint (before second domain test)

**Gap 3 — Rule effects unconstrained by type** ⟳ Change 3 in progress
**Gap 1 — Operation layer ungoverned (partial)** ← Change 4 + operation contracts design

### Week 5

**Gap 5 — Glossary precision advisory** ← Glossary precision checker in gate.js Pass 1
**Gap 7 — No semantic diff on model changes** ← OpenAPI diff step in CI using oasdiff
**Gap 8 — Immutability compile-time only** ← Prisma triggers for immutable fields
**Gap 9 — Gate cannot catch boundary conditions** ← fast-check + Schemathesis

### Backlog

**Gap 2 — Scenarios not a true holdout** ← Process change required before tooling
**Gap 6 — No rule interaction model** ← Low priority until domain has enough rules
**Gap 4 — Event emission unenforceable** ← Resolves with operation contracts (Gap 1)

---

## Remaining steps in priority order

### 1. Confirm Change 3 — field-level diff check (immediate)
Post npx jest --verbose output including deliberate mutation test result.

### 2. Resolve check-stock-on-add-item GapFlags
fill.js → canonical model updates → codegen → re-implement → scenario runner passes all 3 rules.

### 3. Change 4 — throw-checker in gate.js
Gate Stage 1 extension. Closes GapFlag 3 class and Gap 1 (partial).

### 4. Design operation contracts schema extension
New canonical model schema section. Declares ordered rule calls, cross-entity inputs, expected events.
Must be designed before second domain canonical model is authored.
This is a FABRIC-critical design — operation contracts in the second domain canonical model become the template for all FABRIC object canonical models.

### 5. Second domain generalisation test
Full pipeline against subscription-billing or invoice-management.
Second domain canonical model includes operationContracts from the start.
Decision gate: < 3 GapFlags = schema generalises and is ready to bootstrap FABRIC.

### 6. Hash chain (Week 5)
chain.js — PostgreSQL append-only, SHA-256.
Schema: pipeline_run { id, stage, canonicalModelHash, prevHash, artifactHash, timestamp, status }
This is the foundation of FABRIC's audit trail — must be proven here before FABRIC extends it to cross-object dependency resolutions.

### 7. CI pipeline (Week 5)
GitHub Actions. Stages: validate → template-generator → fill → gate Stage 1 → codegen → tsc → scenario runner → chain record → block deploy.
Plus: glossary precision checker (Gap 5), OpenAPI semantic diff (Gap 7).

### 8. Week 5 enforcement additions
Prisma triggers for immutable fields (Gap 8). fast-check property-based tests (Gap 9). Schemathesis OpenAPI testing.

### 9. Continuous improvement loop (Week 6+)
signal-collector.js, pattern-analyser.js (Claude API), confidence-score.js.

### 10. FABRIC bootstrap (Phase 2)
Author platform.canonical-model.yaml.
Run DKCE pipeline against it.
FABRIC's TypeScript interfaces, Prisma schema, OpenAPI spec, and rule stubs are generated.
FABRIC is built on top of that governed foundation.
See FABRIC.docx for the full Phase 2 build sequence.

---

## DKCE completion criteria

DKCE is complete — and ready to bootstrap FABRIC — when:

1. Gate Stage 2 passing with field-level diff check (Change 3)
2. All GapFlags resolved including check-stock-on-add-item
3. Throw-checker in gate.js (Change 4)
4. Operation contracts schema extension designed and validated
5. Second domain test passing with < 3 GapFlags
6. Hash chain operational
7. CI pipeline running on every commit
8. Week 5 enforcement additions in place

At that point DKCE is a proven, multi-domain pipeline with structural enforcement at every layer. It is ready to govern the construction of FABRIC.

---

## Tool status

| Layer | Tool | Status |
|---|---|---|
| Canonical model schema | JSON Schema 2020-12 + YAML | ✓ v1.3.0 |
| Template generation | template-generator.js | ✓ Built |
| AI fill | fill.js (Claude API) | ✓ Built |
| Enforcement Gate Stage 1 | gate.js | ✓ Built |
| Code generation | codegen.js | ✓ Built + Change 1 |
| GapFlag tracking | generated/gapflags.json | ✓ Change 1 |
| TypeScript interfaces | generated/interfaces/ | ✓ Produced |
| Prisma schema | generated/prisma/ | ✓ Produced |
| OpenAPI 3.1 | generated/openapi/ | ✓ Produced |
| Rule stubs | generated/rules/ | ✓ 2 of 3 |
| Compiler enforcement | tsc --noEmit | ✓ Passing |
| Rule implementations | src/rules/ | ✓ 2 of 3 |
| Test framework | Jest + ts-jest | ✓ Confirmed |
| Scenario runner (Gate 2) | tests/scenarios/ | ✓ 7 tests passing |
| Field-level diff check | scenario runner extension | ⟳ Change 3 in progress |
| Throw-checker | gate.js extension | ← Change 4 |
| Operation contracts | canonical model schema + gate | ← Design first |
| Glossary precision checker | gate.js extension | ← Week 5 |
| OpenAPI semantic diff | CI pipeline step (oasdiff) | ← Week 5 |
| Prisma triggers | migration scripts | ← Week 5 |
| Property-based testing | fast-check + Schemathesis | ← Week 5 |
| Hash chain | chain.js (PostgreSQL + SHA-256) | ← Week 5 |
| CI pipeline | GitHub Actions | ← Week 5 |
| Pattern analysis | pattern-analyser.js (Claude API) | ← Week 6+ |
| FABRIC bootstrap | platform.canonical-model.yaml → DKCE pipeline | ← Phase 2 |

---

## Prompt files

| File | Task | Status |
|---|---|---|
| (inline) | codegen.js Change 1 | ✓ Done |
| (inline) | src/rules/ implementations | ✓ Done |
| prompt-jest-setup.md | Jest + ts-jest setup | ✓ Done |
| prompt-scenario-runner.md | Gate Stage 2 scenario runner | ✓ Done |
| prompt-field-diff-check.md | Field-level diff check (Change 3) | ⟳ Awaiting report |
| prompt-throw-checker.md | Throw-checker in gate.js (Change 4) | ← To write |
| prompt-operation-contracts.md | Operation contracts schema extension | ← To write after design |

---

## Known limitations (documented, not blocking)

1. **Cross-entity conditions** — LeafCondition can only reference fields on the rule's entity. Cross-entity checks belong at the operation layer.
2. **Non-composing expressions** — ArithmeticExpression is single-operator only.
3. **GapFlags are JSON only** — gapflags.json for now. FABRIC's signal-collector will consume them.
4. **fill.js requires ANTHROPIC_API_KEY** — CI pipeline will need this as a secret.
5. **check-stock-on-add-item inline type** — must be updated to import from generated stub once GapFlags resolved.
6. **Operation layer ungoverned** — partial resolution via throw-checker; full resolution via operation contracts.
7. **Event emission unenforceable** — resolves with operation contracts.
8. **Glossary precision advisory** — precision checker planned for Week 5.

---

## Schema version history

| Version | Key changes |
|---|---|
| v1.0.0 | Initial schema — 14 objects |
| v1.1.0 | Compound conditions, events registry, lifecycle, ObjectSchema, Pagination, PathParam, ErrorResponse |
| v1.2.0 | ExpressionValue, uuid+refEntity FK pattern, many-to-one relation, required inputMode/outputMode |
| v1.3.0 | Arithmetic action types removed, $value number-only, emits array/string, refEntity constrained, UIContract.intentRef optional |
| v2.0.0 | objectMeta, objectDependencies, publishedOperations, operationContracts ← PLANNED for FABRIC bootstrap |

---

## Decision log

| Decision | Rationale |
|---|---|
| Own JSON Schema instead of TypeSpec | Simpler, more controllable, core IP. TypeSpec can be added later as emitter target. |
| Node.js for pipeline scripts | Same runtime as project, js-yaml battle-tested, no compile step. |
| Prisma over raw SQL | Entity → Prisma model is a direct mapping. Migration generation is free. |
| Arithmetic action types removed v1.3.0 | Two ways to express the same thing creates bug vectors. |
| No blockchain yet | PostgreSQL hash chain sufficient for single-org. Blockchain not justified until multi-org is real. |
| Scenarios as holdout set | Prevents reward hacking. Gate holds scenarios; fill.js never modifies them. |
| Jest over Vitest | Rest of pipeline is CommonJS. Mixing ESM/CJS adds friction not worth it at this stage. |
| Scenario runner as Jest test file | Integrates with tsc, CI, coverage. Failures show as named test failures in Actions output. |
| One prompt at a time to Claude Code | Each change needs a checkpoint. Prevents compounding failures. |
| it.failing over it.skip for known gaps | Skipped tests are invisible. it.failing keeps gaps visible and auto-promotes to real failures when resolved. |
| Operation contracts before second domain | Second domain canonical model must include operationContracts from authoring time, not retrofitted later. |
| DKCE bootstraps FABRIC | FABRIC's foundation is generated by DKCE. FABRIC governs its own construction from its first line. |
| Full custom build for FABRIC (Option 3) | No external platform dependencies. Full portability. Core IP owned end to end. |
