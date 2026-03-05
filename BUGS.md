# DKCE Bug Log

All known bugs, gaps, and design deficiencies. Updated as fixes are applied.
Each entry: description, fix, status.

---

## Critical

### BUG-008 — Gate Pass 2 expectedConditionResult always returns true
**Status: CLOSED**
**Discovered by:** Pipeline audit (second domain test review)
**File:** gate.js lines 335–340

Every branch of `expectedConditionResult()` returns `true` — including for
failure/negative scenarios where the condition should evaluate to `false`.
Pass 2 would reject every correctly-written rule that has negative test
scenarios. A rule with a failure scenario where the condition correctly
evaluates to false would be reported as a gate failure.

**Masked by:** BUG-003 — Passes 1-2 never ran, so this was never triggered.

**Fix:** Add `expectedResult: true|false` field to scenario definitions in the
schema. Gate Pass 2 reads `scenario.expectedResult` directly. No inference
from coverageType — some failure scenarios fire the condition and fail on the
action, others do not fire the condition at all. Every scenario in both
canonical models needs this field added.

---

## High

### BUG-003 — Gate Passes 1-2 never ran on filled templates
**Status: CLOSED**
**Discovered by:** Pipeline audit (second domain test review)
**File:** gate.js, codegen.js

Gate was invoked as `node gate.js --model <file>` without the filled template
as a positional argument. The gate code sets `runTemplateGate = filledPath !== null`.
Without a filled template path, Passes 1-2 are silently skipped. Filled
templates remain at `_meta.status: filled-pending-gate` — never promoted to
`gate-passed-ready-for-codegen`. Codegen ran without checking this status.

**Masked by:** BUG-008 — Pass 2 was broken anyway, so running it would have
produced false failures. The two bugs masked each other.

**Fix:**
(a) gate.js writes `_meta.status: gate-passed-ready-for-codegen` back to the
filled YAML on pass.
(b) codegen.js checks `_meta.status === 'gate-passed-ready-for-codegen'` and
refuses to proceed if the template was not gate-validated.
Both changes required. Closes with BUG-007.

### BUG-009 — Gate Pass 2 cannot evaluate temporal values
**Status: CLOSED**
**Discovered by:** Pipeline audit (second domain test review)
**File:** gate.js line 319

The condition evaluator compares Date field values against the string `"$now"`
using JavaScript's `<` operator. `Date < "$now"` is type coercion and produces
nonsensical results. The evaluator has no temporal resolution layer. Pass 2
cannot semantically validate any condition involving temporal comparisons —
the core logic of convert-trial-on-renewal.

**Fix:** Add a value resolution layer in the evaluator before comparison:
```javascript
function resolveValue(val) {
  if (val === '$now' || val?.$temporal === 'now') return new Date();
  if (val === '$today' || val?.$temporal === 'today') return startOfDay(new Date());
  if (val?.$dateAdd) return resolveDate(val.$dateAdd);
  return val;
}
```
Lands together with BUG-FIX-1 (TemporalReference schema type). Both must
land in the same change.

### BUG-000 — Throw-checker does not recurse into subdirectories
**Status: CLOSED**
**Discovered by:** Second domain test review
**File:** gate.js lines 420, 454

Two problems:
(1) `fs.readdirSync(rulesDir)` at line 420 reads only top-level files.
Rules in subdirectories (src/rules/subscription/) are not scanned.
In the second domain test, 4 of 7 rule files were invisible to the gate.
Gate reported PASS but the guarantee was false.

(2) Identity derivation at line 454 uses `file.replace(/\.ts$/, '')`.
With recursive results, `file` becomes `subscription/cancel-at-period-end.ts`
and canonicalId resolves to `subscription/cancel-at-period-end` — not found
in canonical model. Gate emits a warning instead of validating. Same failure
mode, different cause.

**Fix:**
Line 1: Add `{ recursive: true }` to `fs.readdirSync` call (Node 18.17+).
Line 2: Change `file.replace(/\.ts$/, '')` to `path.basename(file).replace(/\.ts$/, '')`.
`relPath` at line 451 already handles recursive paths correctly — no change needed there.

---

## Medium

### BUG-006 — formatAction() ignores call-operation and other action types
**Status: CLOSED**
**Discovered by:** Second domain test review
**File:** codegen.js lines ~919–938

`formatAction()` only has a branch for `type: 'set'`. When action type is
`call-operation`, `emit-event`, or `db-write`, the function returns an empty
array — producing a blank canonical action comment in the generated stub.
The implementer has no guidance from the stub about what the rule should do.

**Fix:** Add branches for `call-operation`, `emit-event`, and `db-write`:
- call-operation: `// canonicalAction: call-operation → <operationRef>`
- emit-event: `// canonicalAction: emit-event → <eventRef>`
- db-write: `// canonicalAction: db-write`
Fix alongside BUG-013.

### BUG-007 — Template _meta.status lifecycle never enforced
**Status: CLOSED**
**Discovered by:** Pipeline audit (second domain test review)
**File:** fill.js, gate.js, codegen.js

The `_meta.status` field lifecycle (`template-generated → filled-pending-gate
→ gate-passed-ready-for-codegen`) is declared but not enforced. fill.js
correctly sets `filled-pending-gate`. Nothing sets `gate-passed-ready-for-codegen`.
codegen.js does not check the status field. The lifecycle is aspirational
dead code.

**Fix:** Closes with BUG-003.
(a) gate.js writes `gate-passed-ready-for-codegen` on pass.
(b) codegen.js checks status and refuses to proceed if `filled-pending-gate`.

### BUG-010 — findModel() silently uses wrong model when --model not provided
**Status: CLOSED**
**Discovered by:** Pipeline audit (second domain test review)
**File:** gate.js lines 53–56

Default candidate list hardcodes only the e-commerce model path. If `--model`
is not passed, gate silently validates against the wrong model. With multiple
domains in one codebase, throw-checker produces spurious warnings and misses
real errors. No warning or error is emitted.

**Fix:** Require `--model` explicitly. If no `--model` is passed and default
candidates are not found, gate exits with a clear error rather than silently
proceeding with the wrong model.

### BUG-013 — formatCondition renders object values as [object Object]
**Status: CLOSED**
**Discovered by:** Pipeline audit (second domain test review)
**File:** codegen.js line 914

`cond.value` is rendered via implicit toString. For FieldReference objects
like `{$field: "total"}`, this produces `[object Object]` in the generated
stub comment. Implementer gets no useful information about the value comparison.

**Fix:** Replace implicit toString with `JSON.stringify(cond.value)`.
Consistent with how `formatAction` handles complex values at line 927.
Fix alongside BUG-006.

---

## Low

### BUG-004 — Cross-domain throw-checker noise
**Status: CLOSED**
**Discovered by:** Second domain test review
**File:** gate.js Pass 3

When gate runs against the subscription-billing model, it scans the top-level
`src/rules/` and finds e-commerce rules. These produce warnings:
"has no matching rule in canonical model — throw unverifiable."
Technically correct but noisy. Grows linearly with number of domains.

**Fix:** Add `--rules-dir` flag to gate.js. CI pipeline for each domain passes
its own rules directory. No cross-domain noise.

### BUG-005 — tsconfig.json include does not cover generated-subscription/
**Status: CLOSED**
**Discovered by:** Second domain test review
**File:** tsconfig.json

`"include": ["src/**/*", "tests/**/*", "generated/**/*"]` does not cover
`generated-subscription/`. TSC passes because TypeScript follows imports
transitively. But IDE tooling does not index the directory and standalone
errors in unreachable generated files would not be caught.

**Fix:** Codegen outputs to `generated/<domain>/` rather than parallel
top-level directories. `generated/order-management/` and
`generated/subscription/`. Aligns with FABRIC multi-object structure.
Update tsconfig to `"generated/**/*"` covers all subfolders automatically.

### BUG-011 — _fill-manifest.json is write-once, never updated
**Status: CLOSED**
**Discovered by:** Pipeline audit (second domain test review)
**File:** template-generator.js, fill.js, gate.js

`_fill-manifest.json` is created with `filled: false`, `filledAt: null`,
`gateResult: null`. Neither fill.js nor gate.js updates it. The manifest
is permanently stale. Nothing reads it downstream.

**Fix:** fill.js and gate.js update the manifest after their operations.
`filled: true`, `filledAt: <timestamp>`, `gateResult: pass|fail`.

---

## None / Trivial

### BUG-012 — actionSlotSpec reads condition.then (dead code with type confusion)
**Status: CLOSED**
**Discovered by:** Pipeline audit (second domain test review)
**File:** fill.js line 284

```javascript
const declaredEvents = (rule.condition?.then || [])...
```

Conditions do not have a `then` property — that is an action chain property.
Always resolves to `undefined`. The variable is also shadowed downstream
and never used. Dead code with a type confusion indicating a
misunderstanding of the condition/action split during authoring.

**Fix:** Remove the dead code. Trivial.

---


### BUG-014 — Generated Prisma schema has invalid hyphenated enum values
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** codegen.js

Prisma requires alphanumeric enum identifiers — underscores allowed, hyphens
not. codegen writes enum values verbatim from the canonical model. The
subscription-billing domain has `past-due` as an enum value, which generates:

```prisma
enum SubscriptionStatus {
  past-due   -- invalid Prisma identifier
}
```

`prisma validate` and `prisma generate` both fail on this schema.
Any domain with hyphenated enum values produces a broken Prisma schema.

**Fix:** In codegen, sanitise enum values before writing to Prisma:
convert hyphens to underscores (`past-due` → `past_due`) and add
`@map("past-due")` annotation to preserve the original string value.
Apply consistently to all enum blocks.

---

### BUG-015 — activate-on-trial-start references phantom operation determine-initial-status
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** subscription-billing.canonical-model.yaml

The `activate-on-trial-start` rule action declares:
```yaml
action:
  type: call-operation
  operation: determine-initial-status
```
No operation with id `determine-initial-status` exists in the model.
Gate Pass 1 has validation for this at lines 260-264, but Pass 1 only
runs against filled templates. This rule was pre-filled in the canonical
model directly — it was never a fill target and was never gate-validated.
No pipeline stage validates call-operation references for rules already
specified in the canonical model body.

**Fix:** Two parts:
(a) validate.js must check rule action call-operation references against
the operations list — not just gate Pass 1. This catches model-level
inconsistencies regardless of how the rule was filled.
(b) Correct the canonical model: either add `determine-initial-status`
as a declared operation or change the action to reference an existing
operation.

---

### BUG-016 — formatCondition renders undefined for unary operators
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** codegen.js line 914

```javascript
lines.push(`${indent}${cond.field} ${cond.operator} ${cond.value}`);
```

For `is-null` / `is-not-null` operators, `cond.value` is `undefined`.
JavaScript string interpolation produces the literal text `"undefined"`:
```typescript
// Canonical condition:
//   status is-null undefined
```

**Fix:**
```javascript
const valStr = cond.value !== undefined ? ` ${JSON.stringify(cond.value)}` : '';
lines.push(`${indent}${cond.field} ${cond.operator}${valStr}`);
```
Fix alongside BUG-006 and BUG-013 — all three are codegen stub comment
quality issues in the same file.

---

### BUG-017 — cancel-at-period-end description/action mismatch
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** subscription-billing.canonical-model.yaml

Rule description says "Set status to cancelled and record cancelledAt."
The action sets only `status`. No action sets `cancelledAt`. The
description promises two mutations, the action delivers one. The
implementation follows the action, not the description.

No pipeline stage detects description/action mismatches. An implementer
reading the description would write different code than one reading the action.

**Fix:** Two options:
(a) Authoring fix — add a chained action to set `cancelledAt`, or remove
the `cancelledAt` claim from the description.
(b) Pipeline fix — gate or validate.js could detect when a description
mentions a field name that does not appear in the declared action. Fragile
for natural language but worth considering as a warning.
Immediate fix: correct the description in the canonical model.

---

### BUG-018 — dunningAttempts max:3 but rule increments to 4
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** subscription-billing.canonical-model.yaml

Field declared with `validation: { min: 0, max: 3 }`. Rule condition is
`dunning-attempts lte 3` and action increments by 1. When
`dunningAttempts = 3`, the condition fires and the action sets it to 4 —
exceeding the declared max. The gate does not check that action outputs
stay within field validation bounds.

The implementation is correct — 4 is the intended signal for dunning
exhausted. The model declaration is wrong.

**Fix:** Correct the canonical model: change `max: 3` to `max: 4`, or
remove the max entirely since the rule intentionally exceeds 3.
Longer term: gate should warn when an arithmetic action can provably
exceed a field's declared validation bounds.

---

### BUG-019 — Scenario fieldRefs describe input only — no machine-readable expected output
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** canonical-model.schema.json, both canonical models

Scenario `fieldRefs` describe input state. Expected output exists only
in the natural-language `then` field. There is no machine-readable
expected output specification. Gate Pass 2 can evaluate whether a
condition fires against inputs but cannot verify that the action produces
the correct output. The scenario runner fills this gap manually but is
handwritten per domain — not generated.

**Fix:** Add `expectedResult` field to scenario definitions (closes BUG-008)
and add `outputFieldRefs` array to scenario definitions in the schema:
```yaml
outputFieldRefs:
  - entityId: subscription
    fieldId: status
    value: active
```
Gate Pass 2 verifies both: condition evaluation matches `expectedResult`,
and action output matches `outputFieldRefs`. This makes scenario
validation fully automated and generated rather than handwritten.
Schema change required — both canonical models need updating.

---

### BUG-020 — get-subscription and list-subscriptions have wrong intentRef
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** subscription-billing.canonical-model.yaml

```yaml
- id: get-subscription
  intentRef: cancel-subscription    # wrong — this is a read operation

- id: list-subscriptions
  intentRef: cancel-subscription    # wrong — this is a read operation
```

These are read/query operations with no relationship to cancellation.
The generated OpenAPI spec tags them under the wrong intent and
traceability comments in generated code are misleading.

Gate Pass 1 only checks that the intentRef exists — not that it is
semantically appropriate for the operation's HTTP method or purpose.

**Fix:** Two parts:
(a) Authoring fix — add a `view-subscription` or `query-subscription`
intent to the canonical model and update these operations to reference it.
(b) Pipeline enhancement — gate could warn when a GET/LIST operation
references a mutating intent (one whose name contains cancel, delete,
update, create). Heuristic only, but catches obvious mismatches.
Immediate fix: correct the canonical model.


---

## Third pass — additional verified gaps

### BUG-021 — OpenAPI drops duplicate error responses on same HTTP status code
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** codegen.js line 848

`if (!operation.responses[statusStr])` — only the first error response per
HTTP status code is kept. add-order-item declares both ORDER_NOT_FOUND (404)
and PRODUCT_NOT_FOUND (404) — only ORDER_NOT_FOUND survives. retry-payment
has SUBSCRIPTION_NOT_PAST_DUE and DUNNING_EXHAUSTED both at 409 — only the
first survives. Generated API specs silently lose error codes.

**Fix:** Use `oneOf` to compose multiple error schemas under the same status
code, or aggregate error codes into a single response object with an `enum`
on the `code` property.

---

### BUG-022 — OpenAPI uses HTTP 200 for all POST creation endpoints
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** codegen.js line 811

All `outputMode: 'single'` responses use HTTP 200. POST operations that
create resources should return 201 Created. `POST /customers/{customerId}/subscriptions`
returns 200 in the generated spec.

**Fix:** Check `op.method === 'POST'` and emit 201 for creation operations.

---

### BUG-023 — Gate Pass 1 lifecycle validation checks global target states not per-source
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** gate.js line 236

```javascript
const validNextStates = new Set(entity.lifecycle.transitions.map(t => t.to))
```

Collects ALL target states from ALL transitions globally. A rule that sets
`status = past-due` from `trialing` would pass the gate even though
`trialing → past-due` is not a declared transition — because `past-due`
appears somewhere in the transition table.

**Fix:** Filter transitions by current source state before collecting target
states. Requires correlating the condition's source state with the action's
target state — non-trivial but necessary for correct lifecycle enforcement.

---

### BUG-024 — Gate Pass 2 uses loose equality for condition evaluation
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** gate.js line 314

`result = fieldVal == condVal` uses `==` instead of `===`. JavaScript type
coercion: `0 == false` is true, `"" == false` is true, `null == undefined`
is true. Semantic evaluation gives wrong results for edge cases.

**Fix:** Change to `===` and `!==` on lines 314-315.

---

### BUG-025 — Prisma nullable syntax wrong — ? after field name not type
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** codegen.js line 491

Generated output: `trialEndsAt?     DateTime` — invalid Prisma syntax.
Correct syntax: `trialEndsAt      DateTime?` — `?` must follow the type,
not the field name. Every nullable field in every generated Prisma schema
has this error. `prisma validate` fails.

**Fix:** Move the `?` marker to after the Prisma type: `${prismaType}${nullable}`.

---

### BUG-026 — Prisma boolean defaults not generated
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** codegen.js lines 477-483

Default value handler covers `decimal`, `integer`, and `string` types only.
Boolean fields with defaults (e.g. `isActive: true` in Plan) do not get
`@default(true)` in the generated Prisma schema. Database inserts that
omit the field will fail or use wrong defaults.

**Fix:** Add boolean type handling to the default value generator.

---

### BUG-027 — Template generator filters immutable fields from condition slot
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** template-generator.js line 243

```javascript
const mutableFields = fields.filter(f => !f.systemField && !f.immutable)
```

Used for the condition slot spec. Conditions READ fields — they do not write.
Immutable fields like `anchorDate` are valid condition references but the
template excludes them. The action slot correctly filters to writable-only.
The condition slot should include all non-system fields.

**Fix:** Use a separate filter for conditions that excludes only system fields,
not immutable ones.

---

### BUG-028 — Template generator drops entityId from scenario fieldRefs
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** template-generator.js lines 160-163

```javascript
out.fieldValues = s.fieldRefs.map(fr => ({
  field: fr.fieldId,
  value: fr.value      // entityId dropped
}));
```

For multi-entity scenarios, the AI fill loses which entity each field
belongs to. `stock-level` and `quantity` appear as flat field names with
no entity context.

**Fix:** Preserve `entityId` in the mapped output:
`{ entity: fr.entityId, field: fr.fieldId, value: fr.value }`.

---

### BUG-029 — CreateInput includes lifecycle status field
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** codegen.js lines 288-294

`CreateInput` includes all non-system fields including the lifecycle status
field. A caller can pass `status: 'expired'` in the create input, bypassing
the lifecycle's `initialState` guarantee. `UpdateInput` correctly excludes
the status field when a lifecycle is present (lines 300-312) but `CreateInput`
does not apply the same exclusion.

**Fix:** Exclude the lifecycle status field from `CreateInput`, matching the
`UpdateInput` behaviour. The field should be omitted entirely or marked as
optional with a comment noting it defaults to `initialState`.

---

### BUG-030 — fill.js pre-validation does not check operator validity for field type
**Status: CLOSED**
**Discovered by:** Pipeline audit (third pass)
**File:** fill.js lines 291-296

`checkCondition` validates that field and operator exist and that the field
is on the entity. It does not check whether the operator is valid for the
field's type (e.g. `contains` on an integer field). Gate Pass 1 catches this
downstream, but the fill stage claims structural pre-validation and this gap
weakens that claim.

**Fix:** Add type-operator compatibility check to `checkCondition`. Map each
field type to its valid operators and reject invalid combinations at fill time.

## Design gaps (not bugs — schema or process changes required)

### DESIGN-001 — Temporal ExpressionValue incomplete
**Status: CLOSED**

The `"$now"` string workaround passes schema validation (strings are valid
LiteralValues) but is indistinguishable from a literal string. The
implementation hardcodes `new Date()` and ignores the model value — that is
drift. Date arithmetic (`trialEndsAt + 30 days`) is not supported at all.

**Fix:** Add `TemporalReference` type to ExpressionValue in schema v2.1.0:
```json
{ "$temporal": "now" | "today" }
{ "$dateAdd": { "$field": "trialEndsAt", "offset": 30, "unit": "days|hours|months|minutes" } }
```
Update subscription-billing model to replace `"$now"` string.
Update gate evaluator (closes BUG-009). Lands as schema v2.1.0.

### DESIGN-002 — Canonical model authoring has late feedback loop
**Status: CLOSED**

Authors write YAML and discover schema mismatches only at validate.js time.
151 errors in the second domain model. 7/9 categories were wrong property
names and missing fields caught only at validation. 2/9 were schema evolution
issues with no migration guide.

**Fix (three parts in priority order):**
A. Add `# yaml-language-server: $schema=https://dkce.io/canonical-model/v2.0.0/schema`
to all canonical model files. Zero cost. Catches 7/9 error categories in
the editor in real time.
B. Create `docs/schema-migration.md`. Documents breaking changes between
schema versions. Entry for v1.x → v2.0.0 now. Required on every version bump.
C. Add `ajv-errors` annotations to schema. `additionalProperties: false`
throughout the schema causes AJV to generate 10+ cascading errors per
structural mismatch. Actionable error messages via errorMessage annotations
reduce noise. Requires `ajv-errors` package in validate.js.

### DESIGN-003 — Second domain test result qualified
**Status: CLOSED**

The second domain test reported 0 GapFlags and 0 pipeline modifications.
Both are accurate for codegen and tsc. However:
- BUG-003: Gate Passes 1-2 did not run on filled templates
- BUG-008: Pass 2 semantic validation was broken anyway
The semantic validation layer has never been exercised against real data on
either domain. The test must be rerun after BUG-008, BUG-003, and BUG-009
are fixed to produce a clean result.

---

### BUG-031 — Schema $id URL says v2.0.0 but description says v2.1.0
**Status: CLOSED**
**Discovered by:** Traceability audit (AGENTS.md rule 2)
**File:** files/canonical-model.schema.json line 3

The `$id` URL was `https://dkce.io/canonical-model/v2.0.0/schema` while the
description text already documented v2.1.0. Traceability requires these to match.

**Fix:** Changed `$id` URL from `v2.0.0` to `v2.1.0`. Comment-only, no logic change.

---

### BUG-032 — convert-trial-on-renewal.ts comments reference obsolete "$now" format
**Status: CLOSED**
**Discovered by:** Traceability audit (AGENTS.md rule 2)
**File:** src/rules/subscription/convert-trial-on-renewal.ts lines 18, 32

Two traceability comments referenced `"$now"` (the old string-based temporal
format). The canonical model at subscription-billing.canonical-model.yaml
lines 723 and 758 uses `{ $temporal: now }`. Comments must match the model.

**Fix:** Changed both comment occurrences from `"$now"` to
`{ $temporal: "now" }`. Comment-only, no logic change.

---

## Fix priority order for Week 5

### Tier 1 — Broken output (codegen produces invalid artifacts)
- BUG-025 — Prisma nullable syntax wrong (every nullable field invalid)
- BUG-014 — Prisma enum hyphens (every hyphenated enum invalid)
- BUG-029 — CreateInput includes lifecycle status field
- BUG-021 — OpenAPI drops duplicate error codes per status
- BUG-023 — Lifecycle validation checks global not per-source transitions

### Tier 2 — Non-functional validation (gate cannot validate correctly)
- BUG-008 + BUG-019 — expectedConditionResult + outputFieldRefs (design together)
- BUG-003 + BUG-007 — gate/codegen status enforcement
- BUG-009 + DESIGN-001 — temporal resolver + TemporalReference schema (land together)
- BUG-024 — Pass 2 loose equality

### Tier 3 — Pipeline correctness
- BUG-000 — throw-checker recursion (two-line fix)
- BUG-015 — phantom operation validation in validate.js
- BUG-027 — template generator condition slot filters immutable fields
- BUG-028 — template generator drops entityId from fieldRefs

### Tier 4 — Stub and output quality
- BUG-006 + BUG-013 + BUG-016 — codegen stub comment quality (one prompt)
- BUG-022 — OpenAPI 200 vs 201 for POST
- BUG-026 — Prisma boolean defaults
- BUG-030 — fill.js operator validity check

### Tier 5 — Model corrections
- BUG-017 + BUG-018 + BUG-020 — canonical model authoring errors

### Tier 6 — Low/trivial cleanup
- BUG-010 — findModel requires --model
- BUG-004, BUG-005, BUG-011, BUG-012 — noise, config, dead code
- DESIGN-002 — authoring guidance

### Final step
- DESIGN-003 — rerun second domain test with all fixes in place

