# DKCE Build Plan

## Current status

Week 4 in progress. Rule implementations complete, codegen gap-blocking built, Jest setup underway.

```
canonical-model.yaml
  → template-generator.js   ✓ BUILT
  → fill.js                  ✓ BUILT
  → gate.js                  ✓ BUILT (Pass 1 structural + Pass 2 semantic)
  → codegen.js               ✓ BUILT + UPDATED (Change 1 — gapflags.json blocking)
  → generated/               ✓ PRODUCED (10 files, 0 TypeScript errors)
  → src/rules/               ✓ 2 of 3 done (check-stock-on-add-item blocked — 3 GapFlags)
  → Jest                     ⟳ SETTING UP (prompt-jest-setup.md issued)
  → tests/scenarios/         ← NEXT after Jest confirmed
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
8. codegen.js now blocks stub generation for unfilled rules and writes machine-readable gapflags.json

---

## 6-week plan progress

```
Week 1:  Canonical model schema                               ✓ DONE (own schema, not TypeSpec)
Week 2:  Template generator + AI fill + Gate Stage 1         ✓ DONE
Week 3:  Code generation pipeline end to end                  ✓ DONE
Week 4:  Application coding + Gate Stage 2                    ⟳ IN PROGRESS
Week 5:  Hash chain + CI pipeline                             ← PLANNED
Week 6+: Pattern analysis + CI feedback loop                  ← PLANNED
```

---

## Week 4 detail

### ✓ Change 1 — codegen.js blocks unfilled rules (DONE)
- codegen.js checks for null condition/action before generating stubs
- Blocked rules written to generated/gapflags.json as machine-readable records
- Summary prints gap flag count and resolution instructions
- Verified: 1 entry for check-stock-on-add-item, two-gap test correct, tsc clean

### ✓ Rule implementations — apply-high-value-discount, confirm-order-on-payment (DONE)
- Both in src/rules/ against generated stubs, importing stub types, carrying intentRef comments
- apply-high-value-discount: zero ambiguity — one mechanical translation
- confirm-order-on-payment: minimal ambiguity — pure guard is only defensible reading
- tsc --noEmit clean

### ✗ Rule implementation — check-stock-on-add-item (BLOCKED)
3 open GapFlags (see below). Implementation exists with inline type workaround pending resolution.

### ⟳ Jest setup (IN PROGRESS)
Prompt issued: prompt-jest-setup.md. Awaiting report before writing scenario-runner prompt.

### ← Change 2 — scenario-runner.js / Gate Stage 2 (NEXT)
Jest test file in tests/scenarios/. Executes must-pass scenarios against src/rules/ directly.
Expected outcome: 2 pass, 1 fails (check-stock-on-add-item cross-entity — correct and expected).

### ← Change 3 — throw-checker in gate.js (AFTER Gate 2 passing)
Scans src/ for throw statements, verifies each error code exists in canonical model errorResponses.

---

## Open GapFlags

| # | Rule | Type | Resolution |
|---|---|---|---|
| 1 | check-stock-on-add-item | UNFILLED_RULE (condition, action) | Run fill.js with ANTHROPIC_API_KEY |
| 2 | check-stock-on-add-item | Cross-entity type signature insufficient | Document operation-layer delegation in canonical model rule description |
| 3 | check-stock-on-add-item | INVALID_QUANTITY undeclared | Add to add-order-item errorResponses in canonical model |

Resolution sequence: fill → update canonical model → re-run codegen → re-implement → re-run scenario runner.

---

## Remaining steps in priority order

### 1. Confirm Jest setup (immediate)
Post npx jest output. Confirm path aliases resolve. Then write prompt-scenario-runner.md.

### 2. scenario-runner.js / Gate Stage 2
tests/scenarios/scenario-runner.test.ts. Must-pass scenarios against rule implementations.
First firing of Gate Stage 2.

### 3. Resolve check-stock-on-add-item GapFlags
fill.js → canonical model updates → codegen → re-implement → scenario runner passes all 3.

### 4. throw-checker in gate.js (Change 3)
Gate Stage 1 extension. Closes GapFlag 3 class permanently.

### 5. Second domain generalisation test
Full pipeline against subscription-billing or invoice-management.
Decision gate: < 3 GapFlags = schema generalises.

### 6. Hash chain (Week 5)
chain.js — PostgreSQL append-only, SHA-256.
Schema: pipeline_run { id, stage, canonicalModelHash, prevHash, artifactHash, timestamp, status }

### 7. CI pipeline (Week 5)
GitHub Actions on every commit to canonical-model.yaml.
Stages: validate → template-generator → fill → gate Stage 1 → codegen → tsc → scenario runner → chain record → block deploy.

### 8. Continuous improvement loop (Week 6+)
signal-collector.js, pattern-analyser.js (Claude API), confidence-score.js.

### 9. Multi-org (when needed)
Hyperledger Fabric or R3 Corda. Only when second organisation is real.

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
| Test framework | Jest + ts-jest | ⟳ Setting up |
| Scenario runner (Gate 2) | tests/scenarios/ | ← Next |
| Throw-checker | gate.js extension | ← Change 3 |
| Hash chain | chain.js (PostgreSQL + SHA-256) | ← Planned |
| CI pipeline | GitHub Actions | ← Planned |
| Pattern analysis | pattern-analyser.js (Claude API) | ← Planned |
| Multi-org chain | Hyperledger Fabric | ← When needed |

---

## Prompt files

| File | Task | Status |
|---|---|---|
| (inline) | codegen.js Change 1 | ✓ Done |
| (inline) | src/rules/ implementations | ✓ Done |
| prompt-jest-setup.md | Jest + ts-jest setup | ⟳ Awaiting report |
| prompt-scenario-runner.md | Gate Stage 2 | ← To write |

---

## Known limitations (documented, not blocking)

1. **Cross-entity conditions** — LeafCondition can only reference fields on the rule's entity. Cross-entity checks belong at the operation layer.
2. **Non-composing expressions** — ArithmeticExpression is single-operator only.
3. **GapFlags are JSON only** — gapflags.json for now. Step 8 feeds them into signal-collector.
4. **fill.js requires ANTHROPIC_API_KEY** — CI pipeline will need this as a secret.
5. **check-stock-on-add-item inline type** — must be updated to import from generated stub once GapFlags resolved.

---

## Schema version history

| Version | Key changes |
|---|---|
| v1.0.0 | Initial schema — 14 objects |
| v1.1.0 | Compound conditions, events registry, lifecycle, ObjectSchema, Pagination, PathParam, ErrorResponse |
| v1.2.0 | ExpressionValue, uuid+refEntity FK pattern, many-to-one relation, required inputMode/outputMode |
| v1.3.0 | Arithmetic action types removed, $value number-only, emits array/string, refEntity constrained, UIContract.intentRef optional |

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
