# FABRIC — Federated Architecture for Building Robust Interaction Contracts

Platform Design Document — Single Authoritative Specification

| Field | Value |
|---|---|
| Document type | Complete platform specification and build rules |
| Status | Design phase — DKCE prototype complete, FABRIC build pending |
| Decision | Option 3: Full custom build, no external platform dependencies |
| Bootstrap | DKCE pipeline generates FABRIC's governed foundation |
| Date | March 2026 |

---

## 1. What is FABRIC

FABRIC is a platform for building independently deployable objects that interact with each other without drift. Each object is self-describing — it declares its own entities, rules, lifecycle, and interaction surfaces in a canonical model. FABRIC derives all code, contracts, and enforcement from that declaration. Nothing is handwritten against assumptions. Every interaction is governed before it is implemented.

The name encodes the design:

- **Federated** — objects are independent, separately versioned, separately deployed
- **Architecture** — not a framework or a library, but a platform that governs the full build pipeline
- **Building** — the platform produces governed artifacts, not just documentation
- **Robust** — enforcement is structural and compile-time, not advisory or runtime-only
- **Interaction** — the primary design concern is how objects interact, not just what they contain
- **Contracts** — every interaction surface is a declared, versioned, machine-enforced contract

> **Core invariant**
>
> No object may interact with another object using anything other than a generated typed adapter derived from the provider's published canonical model at a declared version. Handwritten cross-object assumptions are structurally impossible.

DKCE (Domain Knowledge Crystallisation Engine) is the bootstrap layer for FABRIC. It is not a standalone prototype — it is the pipeline that will generate FABRIC's own governed foundation. When DKCE is complete, it will be pointed at `platform.canonical-model.yaml` and will generate the TypeScript interfaces, Prisma schema, OpenAPI spec, and rule stubs that FABRIC is built on top of. DKCE governs FABRIC's construction. Every gap closed in DKCE is a gap that cannot exist in FABRIC's foundation.

---

## 2. The Problem FABRIC Solves

### 2.1 What is drift

API drift occurs when actual API behaviour diverges from its specification or documentation over time. Code changes, but the spec, docs, and tests that describe it do not keep up.

### 2.2 The AI coding problem

AI coding assistants introduce a new category of drift. When an AI coding assistant hits ambiguity — a missing field definition, an undefined rule, an unclear relationship — it does not stop and ask. It produces a confident, plausible answer. The gap is invisible.

With a human developer, ambiguity usually triggers a question — they will ask, open a ticket, leave a comment. The gap is visible. With AI, ambiguity triggers a confident answer. The gap is invisible. The code looks authoritative and well-written, which makes it harder to spot the drift.

The AI drift cycle without a canonical model:

```
AI coding assistant hits ambiguity
  ↓ No canonical model to reference
  ↓ AI makes a reasonable assumption
  ↓ Assumption is plausible but wrong
  ↓ Code is committed
  ↓ Nobody notices — it looks correct
  ↓ Silent drift baked in from day one
```

### 2.3 What FABRIC prevents

| Problem | Conventional approach | FABRIC approach |
|---|---|---|
| Cross-object drift | Code review, documentation, hope | Compiler enforces generated typed contracts — handwritten calls fail tsc |
| Breaking changes | Semantic versioning convention | Registry classifies every change — breaking changes block consuming pipelines |
| Ungoverned operation logic | Unit tests, if written | Operation contracts declared in canonical model, gate validates implementation |
| Undeclared errors | Runtime surprises | Throw-checker in gate — undeclared error codes fail the build |
| Silent deprecation | Email notifications | Hard deadline in registry — consuming pipelines fail after removal date |
| Intent drift | Architecture decision records | Every rule traces to an intent in the canonical model — intent is the source of truth |

---

## 3. The Framework Vision

### 3.1 Core idea

The framework treats business logic as a formal specification that gets compiled into code. A single source of truth — the Canonical Model — is the only document any layer, system, or AI is permitted to treat as authoritative. Everything else is derived.

```
[Canonical Model — Single Source of Truth]
  ↓
  ┌─────────────┬──────────┬──────────┬──────────┐
  │    Code     │   Docs   │   Tests  │  Runtime │
  └─────────────┴──────────┴──────────┴──────────┘
```

### 3.2 What the framework is not

The framework is not just a development tool. It is a domain knowledge crystallisation engine — a system that takes human intent, runs it through increasingly precise feedback loops, and produces a machine-executable representation that gets more accurate over time. The software it generates is almost a side effect. The real output is an increasingly precise canonical model — institutional knowledge that does not live in people's heads, does not get lost when staff leave, and gets measurably better the more it is used.

### 3.3 The two input types

| Input | Describes | Author |
|---|---|---|
| Spec / Schema | Shape — what data looks like, API surfaces, contracts | Developer |
| Business Rules | Behaviour — what the system decides and does | Business Analyst |

---

## 4. Architecture

### 4.1 The seven layers

FABRIC has seven layers. Each layer enforces the guarantees of the layer below it. All seven layers derive from the canonical model.

| Layer | Component | What it enforces |
|---|---|---|
| 1 — Intent | Canonical model (YAML) | Business intent, rules, scenarios, entities, operations, events |
| 2 — Registry | Immutable artifact store (PostgreSQL + filesystem) | Published contracts are permanent and versioned — no overwriting |
| 3 — Dependency declaration | objectDependencies in canonical model | Every cross-object dependency is pinned to a specific version |
| 4 — Generated adapters | Codegen → generated/dependencies/ | No handwritten cross-object interfaces — only generated typed contracts |
| 5 — Compiler enforcement | tsc --noEmit | Wrong inputs, wrong outputs, wrong error codes — all fail the build |
| 6 — Gate enforcement | gate.js — Pass 0, 1, 2, 3 | Dependency resolution, structural, semantic, and contract validation |

Note: The DKCE prototype currently implements Pass 1 (structural), Pass 2 (semantic), Pass 3 (throw-checker), and Pass 4 (operation contract validation). Pass 0 (dependency resolution) is a FABRIC addition. The numbering will be reconciled when the FABRIC gate is built.
| 7 — Audit trail | Hash chain (PostgreSQL) | Every dependency resolution recorded with exact artifact hash |

These seven layers map to a more granular 12-layer model used during DKCE design. See Appendix B for the mapping.

### 4.2 The canonical model

The canonical model is a YAML file that declares everything about an object: its entities, its business rules, its operation contracts, its published interaction surface, its declared dependencies, and its scenarios. Nothing about the object exists outside this declaration. All code, contracts, and tests are derived from it.

A canonical model has the following top-level sections:

- **objectMeta** — identity, version, owner, status, hash
- **glossary** — domain terminology with precision definitions
- **intents** — named business goals that rules implement
- **scenarios** — holdout test cases tied to intents (not seen by fill AI)
- **scenarioCoverage** — coverage requirements per intent
- **entities** — data models with fields, types, lifecycle, relations
- **rules** — single-entity business rules with canonical conditions and actions
- **operations** — multi-entity orchestration with declared step sequences
- **publishedOperations** — the interaction surface this object exposes to others
- **objectDependencies** — pinned version declarations for every consumed dependency
- **events** — domain events this object emits
- **integrationContracts** — signed contracts between this object and its consumers
- **uiContracts** — UI field visibility and editability rules

> **Governance rule**
>
> The canonical model is the only document any layer, system, or AI is permitted to treat as authoritative. Everything else is derived. Nothing else is read directly. This rule is enforced by the framework and recorded on the chain.

The canonical model unifies three sources:

| Question | Source | Layer |
|---|---|---|
| What should the system do? | Single source of truth for meaning | Layer 1 — Intent |
| How should the system be built? | Single source of truth for building | Layer 2 — Contract |
| Was this approved and when? | Single source of truth for proof | Layer 7 — Chain |

### 4.3 The contract registry

The registry is an immutable, append-only store of published contract artifacts. When an object's pipeline passes completely — compiler clean, gate passing, scenario runner passing — it publishes one artifact to the registry. That artifact is permanent. It contains:

- The object ID and version
- The SHA-256 hash of the canonical model that produced it
- The SHA-256 hash of the generated TypeScript interfaces
- The full interface definition for every published operation
- The declared error codes for every published operation
- The events this object emits
- The timestamp and pipeline run ID that produced it

A published version is never overwritten. inventory@1.2.0 is permanent. Changes publish inventory@1.3.0. The registry only appends. This immutability is the foundation of the no-drift guarantee — a consuming object cannot resolve a dependency that was never successfully built and published.

### 4.4 Dependency declaration and version pinning

Every canonical model declares its dependencies explicitly with version pins and compatibility modes:

```yaml
objectDependencies:
  - objectId: inventory
    objectVersion: "1.2.0"
    consumes:
      - operation: checkStock
        operationVersion: "1.0.0"
        compatibilityMode: backward
        inputMapping:
          productId: order-item.productId
          quantity: order-item.quantity
        expectedOutputs: [available, stockLevel]
        handledErrors: [PRODUCT_NOT_FOUND, INSUFFICIENT_STOCK]
```

Compatibility modes control how evolution propagates:

| Mode | Behaviour |
|---|---|
| backward | Non-breaking changes propagate automatically. Breaking changes block the pipeline until explicitly upgraded. |
| pinned | No automatic propagation. Every change requires explicit human decision and canonical model update. |
| latest | Always resolves to the current published version. For active development only — not for production. |

### 4.5 Generated typed adapters

When codegen processes a canonical model, it resolves each dependency from the registry and generates a typed adapter file:

```typescript
// generated/dependencies/inventory@1.2.0/checkStock.ts
// AUTO-GENERATED — do not edit.
// Source: inventory@1.2.0 (sha256:b7c2...)

import type { CheckStockInput, CheckStockOutput } from './types';

export declare function checkStock(
  input: CheckStockInput // { productId: string, quantity: number }
): Promise<CheckStockOutput>; // { available: boolean, stockLevel: number }

export type CheckStockError = 'PRODUCT_NOT_FOUND' | 'INSUFFICIENT_STOCK';
```

This file is in `generated/` — declared off-limits to manual editing by the build rules. The operation implementation imports from this file and from nowhere else. If Inventory changes its checkStock signature in a new version, tsc fails at the consuming object's build when the dependency is upgraded. Drift is caught at compile time.

### 4.6 Operation contracts

Operations are the interaction layer between objects. In FABRIC, operations are not ungoverned implementation code — they are declared sequences of steps in the canonical model, validated by the gate:

```yaml
operations:
  - id: confirm-order
    intentRef: confirm-order-on-payment
    operationContract:
      steps:
        - call: inventory.checkStock
          inputs: { productId: item.productId, quantity: item.quantity }
          onSuccess: continue
          onFailure: throw INSUFFICIENT_STOCK
        - call: payment.charge
          inputs: { orderId: order.id, amount: order.total }
          onSuccess: continue
          onFailure: throw PAYMENT_FAILED
        - apply: confirm-order-on-payment
        - emit: order.confirmed
```

The gate validates that the operation implementation calls each declared step in the declared order, handles each declared failure path, and emits each declared event.

---

## 5. The Object Model

### 5.1 Business layer objects

The business layer is authored by analysts in natural language. It captures what the system should do, not how. It must be formalised into the contract layer before entering the pipeline.

**Intent** — Plain language description of what the system should do. Must be approved by a named human before entering the pipeline.

| Field | Type | Required |
|---|---|---|
| description | string | yes |
| author | string | yes |
| version | semver | |
| status | draft\|approved | yes |
| approvedBy | Human | yes |
| approvedAt | datetime | |

**Scenario** — A Given/When/Then example authored by an analyst. Automatically becomes a test case.

| Field | Type | Required |
|---|---|---|
| given | string | yes |
| when | string | yes |
| then | string | yes |
| intentRef | Intent | yes |
| coverageType | happy\|edge\|failure | |
| coverageScore | float | |

**GlossaryTerm** — Shared vocabulary with precise definitions. Ensures the same word means the same thing to analysts, developers, and AI.

| Field | Type | Required |
|---|---|---|
| term | string | yes |
| definition | string | yes |
| precision | Range | |
| synonyms | string[] | |
| conceptVersion | semver | |

**ScenarioCoverage** — Coverage requirements per intent.

| Field | Type | Required |
|---|---|---|
| intentRef | Intent | yes |
| happyPath | boolean | yes |
| edgeCases | Scenario[] | |
| failurePaths | Scenario[] | |
| coveragePct | float | |
| deployGate | float | yes |

> **Human Approval Gate — cannot be automated**
>
> Intent must be approved by a named human before entering pipeline. This is the only accountability anchor in the system. If this gate is automated, there is no human accountable for what gets built.

With AI as the only coder, incomplete scenarios become a deployment blocker — not just a quality metric. The `ScenarioCoverage.deployGate` field defines the minimum coverage percentage required before any pipeline run can proceed to deployment.

### 5.2 Contract layer objects

The contract layer is the single source of truth for building. It is where human meaning has been formalised into machine-readable structure — precise enough to generate from, human enough to reason about, immutable without consensus, and traceable to approved Intent.

**Entity** — Data models with fields, types, lifecycle, relations.

| Field | Type | Required |
|---|---|---|
| name | string | yes |
| fields | Field[] | yes |
| relations | Relation[] | |
| glossaryRef | GlossaryTerm | yes |
| version | semver | |

**Rule** — Single-entity business rules with canonical conditions and actions.

| Field | Type | Required |
|---|---|---|
| name | string | yes |
| condition | Expression | yes |
| action | Expression | yes |
| intentRef | Intent | yes |
| entity | Entity | yes |

**Operation** — Multi-entity orchestration with declared step sequences.

| Field | Type | Required |
|---|---|---|
| name | string | yes |
| input | Entity | yes |
| output | Entity | yes |
| rules | Rule[] | |
| scenarios | Scenario[] | |

**UIContract** — UI field visibility and editability rules.

| Field | Type | Required |
|---|---|---|
| entity | Entity | yes |
| visibleFields | Field[] | yes |
| editableFields | Field[] | |
| validations | Rule[] | |
| intentRef | Intent | yes |

**IntegrationContract** — Cross-organisation API agreements with cryptographic signatures and sunset governance.

| Field | Type | Required |
|---|---|---|
| producer | Organisation | yes |
| consumers | Organisation[] | yes |
| sharedEntity | Entity | yes |
| sharedOperation | Operation | yes |
| signatures | Signature[] | yes |
| version | semver | yes |

**Relationships:**

| From | Relationship | To | Cardinality |
|---|---|---|---|
| Rule | references | Intent | * → 1 |
| Rule | scopes to | Entity | * → 1 |
| Scenario | references | Intent | * → 1 |
| Operation | applies | Rule[] | 1 → * |
| UIContract | scopes | Entity | * → 1 |
| Entity | anchors | GlossaryTerm | * → 1 |
| IntegrationContract | uses | Entity | 1 → 1 |
| IntegrationContract | requires | Signature[] | 1 → * |
| ScenarioCoverage | gates | Deploy | 1 → 1 |

---

## 6. The Enforcement Pipeline

### 6.1 Pipeline stages

Every FABRIC object runs through the same pipeline on every change to its canonical model. Each stage must pass before the next runs. No stage is optional.

| Stage | Tool | What it catches |
|---|---|---|
| Validate | validate.js | Canonical model does not conform to JSON Schema — malformed model |
| Template generation | template-generator.js | Null rules, missing scenarios, incomplete intents |
| AI fill | fill.js (Claude API) | Fills null rule conditions and actions from intent declarations |
| Enforcement Gate | gate.js (Pass 0–3) | Dependency resolution, structural violations, semantic violations, undeclared throws |
| Code generation | codegen.js | Generates TypeScript interfaces, Prisma, OpenAPI, rule stubs, operation stubs, dependency adapters |
| Compiler | tsc --noEmit | Type violations, wrong adapter usage, missing error handling |
| Scenario runner | Jest — tests/scenarios/ | Rule implementations fail must-pass scenarios, rules modify undeclared fields |
| Chain record | chain.js | Records pipeline run with canonical hash and all resolved dependency hashes |
| Publish | registry publish | Publishes contract artifact to registry if all stages pass |

> **Pipeline guarantee**
>
> If a FABRIC pipeline passes completely, every rule traces to a declared intent, every operation follows a declared sequence, every cross-object dependency is resolved from an immutable published artifact, and the full audit trail is recorded. Nothing that passes the pipeline has ungoverned behaviour.

The pipeline order in the DKCE prototype:

```
canonical-model.yaml
  ↓ validate.js           validates model against JSON Schema
  ↓ template-generator.js reads model → produces fill templates for null rules
  ↓ fill.js               calls Claude API → populates rule slots
  ↓ gate.js               validates filled templates (structural + semantic)
  ↓ codegen.js            reads approved model → generates all artifacts
  ↓ tsc --noEmit          TypeScript compiler — drift wall
  ↓ scenario runner       Jest tests validate rule implementations
```

Each stage produces artifacts consumed by the next. No stage may skip the one before it.

### 6.2 Template generation

The framework reads the canonical model and generates structured templates — pre-filling everything that is known and marking only what the AI must provide as [REQUIRED]. The AI receives the minimum information needed to fill the slots, not the entire canonical model.

Example template:

```yaml
rule:
  # Pre-filled by framework
  name: high_value_order
  entity: Order
  intentRef: reward_high_value

  # Context: available fields (AI may only reference these)
  fields_available:
    - id: uuid
    - total: decimal
    - discount: decimal
    - status: enum[pending, confirmed, cancelled]

  # Context: scenario AI must satisfy
  must_satisfy:
    given: a confirmed order with a total of 1200
    when: the discount rule is applied
    then: the order discount is 120

  # AI fills these slots
  condition:
    field: [REQUIRED — must be from fields_available]
    operator: [REQUIRED — e.g. gt, lt, eq, gte, lte]
    value: [REQUIRED — must be a concrete value]

  action:
    field: [REQUIRED — must be from fields_available]
    operation: [REQUIRED — e.g. set, multiply, add, subtract]
    value: [REQUIRED — expression or literal]
```

### 6.3 AI template fill

The AI reads the template — not the full canonical model. It fills only the [REQUIRED] slots, constrained to fields and rules explicitly listed in the template.

**GapFlag — deterministic, not AI-enforced**

After AI generates a filled template, the framework scans all slot values, compares against the canonical model, and raises a GapFlag for any reference not in the model. The block decision is the framework's, not the AI's.

Instructing the AI to raise gaps itself is unreliable. The AI does not experience a missing field as a gap — it experiences it as an opportunity to fill from training data. The framework must detect gaps after generation by comparing what the AI referenced against what exists in the canonical model. This is deterministic and cannot be bypassed.

GapFlag triggers CI Cycle 2: surface to analyst → canonical model updated → template regenerated → AI re-fills with better context.

### 6.4 Enforcement gate

The first enforcement gate runs against the filled template before any code exists. This is the most important gate in the pipeline — catching AI intent drift before a single line of code is written.

| Check Type | Description | Method |
|---|---|---|
| STRUCTURAL | Every filled field exists in Entity definition | Schema lookup |
| STRUCTURAL | Operator valid for field type | Type check |
| STRUCTURAL | No [REQUIRED] slots remain unfilled | Completeness check |
| STRUCTURAL | IntentRef resolves to approved Intent on chain | Chain lookup |
| STRUCTURAL | No fields invented outside template constraints | Constraint check |
| SEMANTIC | Filled rule satisfies Scenario given/when/then | Scenario runner |
| SEMANTIC | Rule traceable to approved Intent | Traceability check |
| COVERAGE | ScenarioCoverage meets deployGate threshold | Coverage check |

Failure handling:

```
Fail → structured feedback to AI
  Structural fail → flag undefined reference with exact location
  Semantic fail → flag violated Scenario with expected vs actual
  AI re-fills failed slots (max 3 attempts)
  Exceed limit → escalate to human (CI Cycle 2)
  Pattern identified → canonical model updated → template regenerated
```

### 6.5 Code generation

Code generation is deterministic — template-based, no AI inference. The same validated template always produces the same code. Generators cover all output types from the canonical model:

| Generator | Input | Output |
|---|---|---|
| Model Generator | Entity | TypedClass |
| Rule Generator | Rule | Interface + stub |
| API Generator | Operation | OpenAPISpec + endpoint stub |
| Schema Generator | Entity | DBMigration (Prisma) |
| Test Generator | Scenario | TestCase (Jest) |

### 6.6 Codegen additions for runtime enforcement

Runtime enforcement requires four additions to the codegen pipeline. All are additions to codegen templates. None require changes to the canonical model schema. None are handwritten.

- Generated adapters carry runtime validators — derived from published contract schema
- Generated adapters read and verify X-Contract-Version response headers
- Provider operation stubs include X-Contract-Version response middleware
- Contract test generation — codegen generates `tests/contracts/<objectId>@<version>.contract.test.ts` for the provider staging gate

## 7. Object Independence and Interaction

### 7.1 What independence means

Each FABRIC object has its own canonical model, its own pipeline, its own generated artifacts, its own published version in the registry, and its own deployment lifecycle. Adding a new object does not require changes to any existing object. Deploying a new version of Inventory does not require redeploying Order. An object can be authored, built, tested, and shipped without coordinating with other objects.

Independence does not mean isolation. Objects interact — but every interaction is declared, versioned, and enforced. The independence is at the build and deployment layer. The governance is at the canonical model layer.

### 7.2 How scope expands

Adding a new object to the application means:

1. Author the new object's canonical model — entities, rules, operations, published operations
2. Run the FABRIC pipeline — generates all artifacts, publishes to registry
3. Declare the dependency in consuming objects' canonical models
4. Codegen generates typed adapters for the new dependency
5. tsc enforces the contract from the first line of consuming code

No existing object is touched. No shared pipeline is rerun. No coordinated release. The application grows by addition, not by modification.

### 7.3 Dynamic capability evolution without drift

FABRIC supports dynamic evolution of object capabilities through a four-mechanism protocol:

**Operation-level versioning** — Each published operation is versioned independently of the object. inventory@1.3.0 can add reserveStock@1.0.0 and update checkStock to @1.1.0. A consuming object can upgrade to inventory@1.3.0 to access reserveStock while remaining on checkStock@1.0.0. Operation pins decouple capability discovery from capability consumption.

**Breaking change classification** — When a new version is published, the registry classifies every change against the previous version. New required inputs, removed fields, and changed types are classified as breaking. New optional fields and new error codes are classified as non-breaking. Breaking changes block every consuming pipeline that has the affected operation in backward compatibility mode. The build fails. The human must explicitly declare the upgrade. There is no silent propagation of breaking changes.

**Capability notifications** — When a new operation is published, the registry notifies all objects that depend on the publishing object. The notification is advisory — consuming the new capability is optional and requires a deliberate declaration in the consuming canonical model. New capabilities are visible. They are never consumed silently.

**Deprecation protocol** — An operation marked deprecated in the canonical model publishes with a declared removal date. Every consuming pipeline shows a deprecation warning in its output. After the removal date, consuming pipelines fail. The consuming object has the declared notice period to migrate. Deprecation is not a notification. It is a hard deadline enforced by the gate.

---

## 8. What FABRIC Produces

For every object whose canonical model passes the full pipeline, FABRIC generates:

| Artifact | Description |
|---|---|
| TypeScript interfaces | Typed entity interfaces for all declared entities — the only sanctioned types for this object |
| Prisma schema | Database schema derived from entity declarations — migration-ready |
| OpenAPI 3.1 spec | Full API specification derived from operation declarations — no handwriting |
| Rule stubs | Typed function signatures for every rule — implementations must satisfy these exactly |
| Operation stubs | Typed function signatures for every operation, importing generated dependency adapters |
| Dependency adapters | Generated typed interfaces for every declared cross-object dependency, derived from registry artifacts |
| Scenario runner tests | Jest test file executing all must-pass scenarios against rule implementations |
| gapflags.json | Machine-readable record of any rules or operations that could not be fully generated |
| Backstage catalog entry | Auto-generated service catalog entry for the object registry |
| Registry artifact | Published immutable contract artifact containing all interface definitions and hashes |
| Hash chain record | Audit trail entry linking this pipeline run to all resolved dependency versions |

> **Key property**
>
> Every generated artifact carries a canonicalModelVersion and intentRef. Any generated file can be traced back to the exact canonical model version and business intent that produced it. Traceability is not a feature — it is built into every artifact by construction.

---

## 9. Runtime Enforcement

The architecture described in sections 4–6 is entirely build-time and pipeline-time governance. Once objects are deployed and calling each other over the network, three runtime mechanisms enforce the contracts. Without these, build-time guarantees are advisory at runtime.

### 9.1 Schema validation at network boundary

Every response that crosses an object boundary is validated against the published contract schema before the consuming object business logic sees it. The validator is generated by codegen from the same canonical model that produced the TypeScript interface. It is not a separate schema maintained by hand.

The validator runs inside the generated adapter, not in the consuming object code. The consuming object never receives an unvalidated cross-object response. If the provider returns a structurally invalid response, the adapter rejects it at the boundary with a declared error type before any business logic executes.

### 9.2 Response version headers

Runtime schema validation catches shape violations but not version mismatches during rolling deployments. If v1.3.0 of a provider returns a structurally compatible response with different semantics, the schema validator passes silently.

The fix is response version headers. The provider includes its contract version in every cross-object response:

```
X-Contract-Version: inventory@1.2.0
```

The generated adapter reads this header and compares it against the pinned dependency version in the consuming canonical model. If the versions do not match — because a rolling update is in progress and this request hit a v1.3.0 instance while the consumer was built against v1.2.0 — the adapter fails at the boundary with a version mismatch error, not silently:

```
ContractVersionMismatch: expected inventory@1.2.0, received inventory@1.3.0
Pinned dependency: inventory.checkStock@1.0.0
Action: retry or route to compatible instance
```

The canonical model declares how to handle this:

```yaml
- call: inventory.checkStock
  onVersionMismatch: retry-with-backoff
  maxRetries: 3
  onExhausted: throw PROVIDER_VERSION_MISMATCH
```

The version header is not handwritten. Codegen generates middleware in the provider operation stubs that attaches X-Contract-Version to every response. The consuming adapter reads it. Both sides are generated from the canonical model.

### 9.3 Consumer-driven contract tests against staging

Contract tests run against the provider staging environment as part of the provider promotion pipeline — after the provider build passes and the new version is deployed to staging, but before it is promoted to production.

The precise sequence:

1. Provider build passes — unit tests, gate, scenario runner, tsc all clean
2. New version is deployed to staging
3. Registry serves the contract test suite for every consuming object that depends on this provider
4. Provider staging promotion gate runs all consumer contract tests against the staging endpoint
5. If any consumer scenario fails against staging, promotion to production is blocked
6. Provider team sees exactly which consumer scenario failed and what the staging response was
7. Production promotion proceeds only when all consumer contract tests pass

> **Sequencing precision**
>
> Contract tests run against the version about to be promoted, not the current production version. They run in the provider pipeline, not the consumer pipeline. The provider is responsible for not breaking its consumers. The consuming object does not need to do anything — its declared scenarios in the registry are automatically used as the contract test suite.

### 9.4 Operation runtime

The operation contracts design declares failure paths and compensating actions. The operation runtime executes declared steps with durability. If payment.charge succeeds but inventory.reserve fails, the runtime executes the declared compensating action for payment.charge automatically. The canonical model declares what compensation looks like. The runtime enforces it.

This closes the time-of-check to time-of-use problem by making every failure path governed.

### 9.5 Complete enforcement chain

| Phase | Mechanism | What it catches |
|---|---|---|
| Build time | Compiler (tsc) | Wrong input/output types, wrong error codes, missing error handling |
| Build time | Gate Pass 0–3 | Unresolved dependencies, structural violations, semantic violations, undeclared throws |
| Build time | Scenario runner | Rule implementations fail scenarios, rules modify undeclared fields |
| Deployment time | Contract tests (staging) | Provider behaviour deviates from declared consumer scenarios before reaching production |
| Runtime | Response schema validation | Provider returns structurally invalid response — caught at adapter boundary |
| Runtime | Response version headers | Rolling deployment version mismatch — caught at adapter boundary, not silently |
| Runtime | Operation runtime | Failure paths and compensating actions governed by canonical model declarations |
| Audit | Hash chain | Every cross-object call that fails validation recorded with contract version and violating response |

### 9.6 Blockchain governance

For single-organisation deployments, a PostgreSQL hash chain with SHA-256 provides the audit trail. For multi-organisation deployments, a permissioned blockchain (Hyperledger Fabric or R3 Corda) governs IntegrationContracts.

**What the chain stores:**

| On chain — shared, immutable, consensus required | Off chain — each org owns internally |
|---|---|
| IntegrationContract versions | Internal Entity definitions |
| Shared Entity definitions | Internal Rules |
| Shared Scenarios | Internal business logic |
| Consensus and signatures | AI fill process |
| Version history | Code generation |
| Pipeline run records with canonical model hash | Deployment |

**Pipeline chain record:**

```
Block: Pipeline Run pr-4471
  canonicalModelHash: g2b5c9...  ← exact version used
  templateHash: d4e1f2...
  aiFillHash: f6a8b3...
  enforcementHash: h9c3a1...
  codeHash: i1d7e4...
  deployHash: j3f9b2...
```

**Single org vs multi-org:**

| Requirement | Single Org | Multi-Org |
|---|---|---|
| Canonical model integrity | Hash chain in framework database | Permissioned blockchain |
| Contract change approval | Git branch protection + PR approval | Cryptographic multi-signature |
| Audit trail | Hash chain records | Immutable ledger |
| Dispute resolution | Internal process | Cryptographic proof |
| Smart contract governance | Not required | Recommended |

---

## 10. Application Coding Constraints

AI writes application code — but only against generated interfaces. The generated code is the contract. AI cannot modify it. If AI deviates from a generated interface, the compiler rejects it before the enforcement gate is even reached.

### 10.1 The four walls

| Wall | Mechanism | What it prevents |
|---|---|---|
| Wall 1 — Canonical Model | AI reads one source. Everything it can reference is defined. | AI inventing entities, fields, relationships |
| Wall 2 — Generated Interfaces | Compiler enforces generated contracts. | AI changing method signatures or field types |
| Wall 3 — Enforcement Gate Stage 2 | Scenario tests run against running code. | AI implementing correct structure but wrong logic |
| Wall 4 — Chain Provenance | Code linked to canonical model version hash. | Code deploying against superseded canonical model |

### 10.2 Application scope vs generated scope

| Generated (immutable) | Application only (AI writes) |
|---|---|
| Data models | Server setup |
| Rule interfaces | Authentication |
| API signatures | Error handling middleware |
| DB schema | Infrastructure config |
| Test cases | UI rendering and navigation |
| UI field contracts | State management |

### 10.3 Application code rules

These rules apply when writing implementations (not generators).

**Always import from `generated/`, never redefine types:**

```typescript
// ✅ CORRECT
import type { Order, CreateOrderInput } from '../generated/interfaces/Order';

// ✗ WRONG — redefining types that already exist in generated/
interface Order {
  id: string;
  // ... duplicating what's already generated
}
```

**Rule implementations must import their stub type:**

```typescript
// ✅ CORRECT
import type { ApplyHighValueDiscountFn } from '../generated/rules/apply-high-value-discount';

export const applyHighValueDiscount: ApplyHighValueDiscountFn = (order) => {
  // intentRef: reward-high-value-orders
  if (order.total >= 1000 && !(order.discount > 0)) {
    return { ...order, discount: order.total * 0.1 };
  }
  return order;
};
```

**Never throw errors not declared in the canonical model.** If `add-order-item` declares four error codes, the implementation throws exactly those four codes. It does not throw generic `Error`, `TypeError`, or undeclared domain errors. New error conditions must first be added to the canonical model.

**Use the lifecycle transition function for all status changes:**

```typescript
// ✅ CORRECT
import { transitionOrderStatus } from '../generated/interfaces/Order';
const confirmed = transitionOrderStatus(order, 'confirmed');

// ✗ WRONG
const confirmed = { ...order, status: 'confirmed' as OrderStatus };
```

---

## 11. Continuous Improvement

The framework is structurally identical to how LLMs are trained — input, output, evaluation, feedback, improvement. The difference is what is being trained. In LLM training, the model weights improve. In this framework, the canonical model improves. The enforcement gate is the evaluator. The chain is the training dataset.

### 11.1 The four improvement cycles

| Cycle | Timescale | Trigger | Outcome |
|---|---|---|---|
| 1 — Immediate | Seconds to minutes | Enforcement gate fail | AI re-fills failed slots from structured feedback. Max 3 attempts then escalates. |
| 2 — Session | Minutes to hours | Repeated slot failures | Pattern identified, surfaced to analyst, canonical model updated, template regenerated. |
| 3 — Release | Days to weeks | Aggregate failures across runs | Systemic Scenario gaps identified, coverage improved before next release. |
| 4 — Retrospective | Weeks to months | Deep pattern analysis | Canonical model schema evolved, GlossaryTerm precision fields added, framework itself improves. |

### 11.2 CI objects

**PipelineSignal** — Records each enforcement event.

| Field | Type | Required |
|---|---|---|
| source | Layer | yes |
| type | gap\|fail\|pass\|escalate | |
| slotRef | TemplateSlot | |
| ruleRef | Rule | |
| chainHash | string | yes |

**PatternAnalyser** — Reads the chain, detects recurring failures, suggests missing Scenarios, flags ambiguous Intent, identifies concept drift.

**ConfidenceScore** — Composite metric tracking canonical model health.

| Field | Type | Required |
|---|---|---|
| scenarioCoverage | float | yes |
| gapFlagRate | float | |
| firstPassRate | float | |
| escalationRate | float | |
| productionErrorRate | float | |

### 11.3 The compounding return

```
More pipeline runs
  ↓ Better canonical model
  ↓ Better templates
  ↓ AI fills more accurately first time
  ↓ Fewer enforcement failures
  ↓ More signal about what works
  ↓ Even better canonical model

Early: many gap flags, many failures, frequent escalation
Later: AI fills correctly first time, rare escalation
```

---

## 12. Build Rules — Non-Negotiable

These are enforced by the pipeline. Violating them produces drift. All agents must follow every one of them without exception.

### 12.1 The ten hard rules

**Rule 1: Never invent domain objects.** Generated code is a projection of the canonical model. It is not an improvement of it. If a field seems missing and useful, the fix is to add it to `canonical-model.yaml` with an approved Intent and GlossaryTerm. Not to add it to generated code.

```typescript
// ✅ CORRECT — field exists in canonical model
export interface Order {
  id: string;           // canonical field: id, type: uuid
  customerId: string;   // canonical field: customer-id, type: uuid
  status: OrderStatus;  // canonical field: status, type: enum
  total: number;        // canonical field: total, type: decimal
  discount: number;     // canonical field: discount, type: decimal
}

// ✗ WRONG — 'updatedBy' does not exist in the canonical model
export interface Order {
  id: string;
  customerId: string;
  status: OrderStatus;
  total: number;
  discount: number;
  updatedBy: string;    // ✗ not in canonical model — REMOVE
}
```

**Rule 2: Every generated type must carry its traceability comment.** Every generated TypeScript interface, Prisma model, and rule stub must include its canonical model references as comments. This is the audit trail.

```typescript
// ✅ CORRECT
// intentRef: reward-high-value-orders
// canonicalModelVersion: 1.0.0
// entityRef: order
export interface Order { ... }

// ✗ WRONG — missing traceability
export interface Order { ... }
```

**Rule 3: Never add helper methods or computed properties to generated interfaces.** Generated interfaces are data shapes only. No methods. No getters. No computed fields. Application logic belongs in `src/`, not in `generated/`.

**Rule 4: Immutable fields must not have setters.** If a field is `immutable: true` in the canonical model, the generated code must enforce this. In TypeScript: `readonly`. In Prisma: the field must be excluded from update input types.

**Rule 5: Lifecycle transitions must be enforced — no raw status assignments.** If an entity has `lifecycle` defined in the canonical model, generated code must not allow arbitrary status assignment. Status changes must go through a transition function that validates against the declared transitions.

```typescript
// ✅ CORRECT — transition enforced
function transitionOrderStatus(order: Order, to: OrderStatus): Order {
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    pending:    ['confirmed', 'cancelled'],
    confirmed:  ['processing', 'cancelled', 'refunded'],
    processing: ['shipped'],
    shipped:    ['delivered', 'refunded'],
    delivered:  ['refunded'],
    cancelled:  [],   // terminal
    refunded:  [],    // terminal
  };
  if (!validTransitions[order.status].includes(to)) {
    throw new InvalidLifecycleTransition(order.status, to);
  }
  return { ...order, status: to };
}

// ✗ WRONG — raw assignment bypasses lifecycle
order.status = 'confirmed';          // ✗ no transition check
order = { ...order, status: 'confirmed' };  // ✗ still bypasses it
```

**Rule 6: Rule implementations must match their canonical condition exactly.** When implementing a rule in `src/rules/`, the condition logic must match the canonical model's filled condition. No additions, no shortcuts.

**Rule 7: Operations must declare all canonical error responses.** Every operation implementation must handle every `errorResponse` declared in the canonical model. Undeclared error shapes must not be thrown.

```typescript
// canonical model: add-order-item has errorResponses:
//   ORDER_NOT_FOUND (404), PRODUCT_NOT_FOUND (404),
//   INSUFFICIENT_STOCK (409), ORDER_NOT_EDITABLE (409)

// ✅ CORRECT — all declared errors handled
async function addOrderItem(orderId: string, input: AddOrderItemInput) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND');

  const product = await db.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND');

  if (order.status !== 'pending') throw new ApiError(409, 'ORDER_NOT_EDITABLE');
  if (product.stockLevel < input.quantity) throw new ApiError(409, 'INSUFFICIENT_STOCK');
  // ...
}

// ✗ WRONG — throws undeclared error, misses declared ones
async function addOrderItem(orderId: string, input: AddOrderItemInput) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Not found');        // ✗ undeclared error shape
  // PRODUCT_NOT_FOUND never checked                ✗ declared error missing
  // ORDER_NOT_EDITABLE never checked               ✗ declared error missing
}
```

**Rule 8: Never modify files in `generated/` by hand.** The `generated/` directory is owned by `codegen.js`. Any manual edit will be overwritten on the next codegen run. If generated output is wrong, fix `codegen.js` or fix `canonical-model.yaml`. Never patch `generated/` directly.

**Rule 9: Generated files must include a file-level guard comment.** Every file in `generated/` must start with:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v{version}
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────
```

**Rule 10: The canonical model is the source of truth for field names.** Generated code uses the `name` field from the canonical model verbatim. Do not camelCase, snake_case, or rename.

### 12.2 Prohibitions

| Action | Why |
|---|---|
| Edit `canonical-model.yaml` directly | Only humans with approvedBy authority may change the canonical model |
| Edit `canonical-model.schema.json` | Schema changes require a version bump and human review |
| Edit anything in `generated/` | Generated files are owned by codegen.js |
| Add fields to generated types that aren't in the canonical model | This is the primary source of drift |
| Throw undeclared error codes | Every error shape must be in the canonical model's errorResponses |
| Bypass the lifecycle transition function | Direct status assignments break the state machine guarantee |
| Combine two rules into one implementation | One canonical rule → one implementation function |
| Skip the gate stage | Gate-failed templates must be refilled, not force-merged |

### 12.3 GapFlag protocol

If application code needs something that doesn't exist in the canonical model (a field, a rule, an operation), do not invent it. Instead:

1. Stop. Do not write the code that needs the missing thing.
2. Output a `GapFlag` comment at the point in the code where the gap was found:

```typescript
// GAPFLAG: entity 'order' is missing field 'promotionCode'.
// Required by: add-order-item operation, coupon validation logic.
// Resolution: add GlossaryTerm 'promotion-code', add Field to Order entity,
//             add Rule 'validate-promotion-code' with intentRef.
// Do not implement this until the canonical model is updated and approved.
```

3. Continue with everything else that doesn't depend on the missing thing.

GapFlags are collected by the continuous improvement layer and fed back to the canonical model owners. They are never resolved by the agent unilaterally.

Instructing the AI to raise gaps itself is unreliable. The AI does not experience a missing field as a gap — it experiences it as an opportunity to fill from training data. The framework must detect gaps after generation by comparing what the AI referenced against what exists in the canonical model. This is deterministic and cannot be bypassed.

---

## 13. Codegen Specification

### 13.1 Pipeline order and commands

```
canonical-model.yaml
  ↓ validate.js           validates model against JSON Schema
  ↓ template-generator.js reads model → produces fill templates for null rules
  ↓ fill.js               calls Claude API → populates rule slots
  ↓ gate.js               validates filled templates (structural + semantic)
  ↓ codegen.js            reads approved model → generates all artifacts
  ↓ tsc --noEmit          TypeScript compiler — drift wall
  ↓ scenario runner       Jest tests validate rule implementations
```

```bash
# Validate canonical model
node validate.js

# Generate fill templates for null rules
node template-generator.js example.canonical-model.yaml --output-dir ./templates

# Fill templates (requires ANTHROPIC_API_KEY)
node fill.js templates/<rule-id>.fill-template.yaml

# Run enforcement gate
node gate.js templates/<rule-id>.filled.yaml --model example.canonical-model.yaml

# Generate all artifacts
node codegen.js example.canonical-model.yaml --output-dir ./generated

# Run TypeScript compiler against generated interfaces (drift wall)
npx tsc --noEmit

# Run scenario runner
npx jest tests/scenarios/
```

### 13.2 Project structure

```
dkce-prototype/
  canonical-model.schema.json     — JSON Schema for the canonical model format
  example.canonical-model.yaml    — the live canonical model (do not edit directly)
  template-generator.js           — stage 1: produces fill templates
  fill.js                         — stage 2: AI fill via Claude API
  gate.js                         — stage 3: enforcement gate
  codegen.js                      — stage 4: code generator
  generated/                      — all codegen output lives here
    interfaces/                   — TypeScript entity interfaces
    prisma/schema.prisma          — Prisma schema
    openapi/openapi.yaml          — OpenAPI 3.1 spec
    rules/                        — typed rule function stubs
  src/                            — application code lives here
    rules/                        — rule implementations (AI-written against generated stubs)
    operations/                   — operation handlers (AI-written)
    services/                     — service layer
  package.json
```

### 13.3 Codegen inputs and outputs

**Inputs:** Any `canonical-model.yaml` passed as argument.

**Outputs (all in `generated/`):**

| Output | Description |
|---|---|
| `interfaces/{EntityName}.ts` | TypeScript interface per entity |
| `interfaces/enums.ts` | All enum types in one file |
| `prisma/schema.prisma` | Full Prisma schema |
| `openapi/openapi.yaml` | OpenAPI 3.1 spec |
| `rules/{rule-id}.ts` | Typed rule function stub per rule |

### 13.4 TypeScript interface spec

For each entity, produce one file. Example for `Order`:

```typescript
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.0.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml

// intentRef: (first intent that references this entity, or 'multiple')
// canonicalModelVersion: 1.0.0
// entityRef: order

import type { OrderStatus } from './enums';

export interface Order {
  readonly id: string;             // uuid, immutable, system
  readonly customerId: string;     // uuid, immutable, FK → Customer
  status: OrderStatus;             // enum
  total: number;                   // decimal, validation: {min:0, max:999999.99}
  discount: number;                // decimal, default: 0
  shippingAddress: OrderShippingAddress | null;
  tags: string[];
  readonly createdAt: Date;        // datetime, immutable, system
  updatedAt: Date;                 // datetime, system
}

export interface OrderShippingAddress {
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  country: string;
}

export interface CreateOrderInput {
  customerId: string;
  total: number;
  discount?: number;
  shippingAddress?: OrderShippingAddress;
  tags?: string[];
}

export interface UpdateOrderInput {
  total?: number;
  discount?: number;
  shippingAddress?: OrderShippingAddress;
  tags?: string[];
}
```

**Rules for interface generation:**

- `immutable: true` → `readonly` in TypeScript
- `systemField: true` → `readonly`, excluded from `CreateInput` and `UpdateInput`
- `nullable: true` → union with `null`
- `required: false` → optional in `CreateInput`
- `type: object` → generate a named embedded interface `{EntityName}{FieldName}` in PascalCase
- `type: array, itemType: string` → `string[]`
- `type: array, itemType: ref:entityId` → `EntityName[]` (import if needed)
- `type: reference` → generate as the FK type (usually `string` for uuid)
- `type: decimal` → `number` in TypeScript (document precision in comment)
- `type: uuid` → `string`
- `type: datetime` → `Date`
- Status fields with lifecycle → comment must note: "use transitionOrderStatus()"
- Always generate `CreateInput` and `UpdateInput` types alongside the base interface

### 13.5 Prisma schema spec

Single `schema.prisma` file.

```prisma
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.0.0
// Regenerate: node codegen.js example.canonical-model.yaml

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// intentRef: confirm-order-on-payment
/// canonicalModelVersion: 1.0.0
/// entityRef: order
model Order {
  id             String        @id @default(uuid())
  customerId     String
  status         OrderStatus   @default(pending)
  total          Decimal       @db.Decimal(10, 2)
  discount       Decimal       @default(0) @db.Decimal(10, 2)
  shippingAddress Json?
  tags           String[]
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  deletedAt      DateTime?     // softDelete: true

  customer       Customer      @relation(fields: [customerId], references: [id])
  items          OrderItem[]

  @@index([customerId])
  @@index([status])
  @@index([createdAt])
}

enum OrderStatus {
  pending
  confirmed
  processing
  shipped
  delivered
  cancelled
  refunded
}
```

**Rules for Prisma generation:**

- `softDelete: true` → add `deletedAt DateTime?`
- `systemField: true` + `immutable: true` + `type: uuid` → `@id @default(uuid())`
- `systemField: true` + name = `createdAt` → `@default(now())`
- `systemField: true` + name = `updatedAt` → `@updatedAt`
- `type: decimal` → `Decimal @db.Decimal(10, 2)` (use precision/scale from validation if set)
- `type: uuid` + `refEntity` → generate `@relation` and a named relation field
- `indexes` → `@@index([fieldName])` or `@@unique([fieldName])`
- `unique: true` on field → `@unique`
- Enum types → generate Prisma `enum` block, one per canonical enum field
- Object fields → `Json` type in Prisma (Prisma doesn't support embedded types natively)
- Hyphenated enum values → convert hyphens to underscores, add `@map("original-value")`
- Nullable fields → `Type?` (question mark after the type, not the field name)
- Boolean defaults → `@default(true)` or `@default(false)`
- Lifecycle status field → exclude from `CreateInput` (defaults to `initialState`)

### 13.6 OpenAPI 3.1 spec

Single `openapi.yaml`. Map canonical model operations exactly:

- `inputMode: body` → `requestBody` with schema referencing the entity's CreateInput
- `inputMode: query` → `parameters` array with filterable fields as query params
- `inputMode: none` → no `requestBody`
- `outputMode: single` → `200` response with entity schema (or `201` for POST creation)
- `outputMode: collection` → `200` response with paginated wrapper: `{ data: Entity[], cursor?: string, total?: number }`
- `outputMode: none` → `204` response, no content
- `errorResponses` → one response entry per declared error. Multiple errors on the same HTTP status code use `oneOf` composition.
- `pathParams` → `parameters` with `in: path`
- `auth.required: true` → `security` on the operation
- `rateLimit` → `x-rate-limit` extension on the operation

### 13.7 Rule stub spec

For each rule in the canonical model, generate a typed stub in `generated/rules/`:

```typescript
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.0.0

// intentRef: reward-high-value-orders
// entityRef: order
// scenarioRefs: [high-value-discount-applied, already-discounted-not-re-discounted, no-discount-below-threshold]
//
// Canonical condition:
//   AND [
//     total >= 1000,
//     NOT (discount > 0)
//   ]
//
// Canonical action:
//   set discount = total * 0.1
//   then: emit-event order.discount-applied
//
// IMPLEMENT THIS STUB in: src/rules/apply-high-value-discount.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Order } from '../interfaces/Order';

export type ApplyHighValueDiscountFn = (order: Order) => Order;

// The implementation must satisfy these scenarios:
// ✓ high-value-discount-applied     — order.total=1200, order.discount=0 → discount=120
// ✓ already-discounted-not-re-discounted — order.total=1200, order.discount=50 → discount=50 (unchanged)
// ✓ no-discount-below-threshold     — order.total=999, order.discount=0 → discount=0 (unchanged)
```

---

## 14. Drift Prevention — Complete Picture

### 14.1 Classical drift scenarios eliminated

| Drift Scenario | Prevention Mechanism | Layer |
|---|---|---|
| Business rule changes, code does not | Regeneration triggered by canonical model change | 2 + 6 |
| Code changed directly without updating contract | Generated code is immutable | 6 |
| DB schema diverges from Entity definition | Schema generated from same Entity | 6 |
| F/E shows fields not in UIContract | UI components generated from UIContract | 6 |
| API docs show wrong response shape | Docs generated from Operation | 6 + 11 |
| Tests pass against old behaviour | Tests regenerated from Scenarios | 6 |
| AI invents a new field | Compiler — field not in generated model | 7 |
| AI misinterprets intent | Scenario test fails | 8 |
| AI uses wrong field | Enforcement gate — field mismatch | 5 |
| AI fills gap silently | GapFlag — canonical model lookup fails | 4 |
| AI codes against wrong version | Chain hash mismatch | 9 |
| Inter-service drift | Shared IntegrationContract on chain | 9 |

### 14.2 Residual risks

| Risk | Source | Severity | Mitigation |
|---|---|---|---|
| Canonical model poisoning | Human approval failure | High | Multi-sign for high-impact Intent, structured approval checklist |
| Scenario gaming | AI optimisation behaviour | High | Diverse scenario types, edge + failure coverage required |
| Intent approval failure | Human cognitive limits | High | Domain expert review, structured checklist |
| Training signal contamination | Enforcement gate gaps | Medium | Gate completeness reviews, anomaly detection |
| Emergent complexity drift | Scale + interaction effects | Medium | Cross-rule impact analysis, complexity thresholds |
| Concept drift over time | Real-world change | Medium | GlossaryTerm conceptVersion, periodic human review |
| Cross-domain scenario blindness | Scenario authoring scope | Low | Cross-domain Scenario type required |
| Canonical model CI drift | CI improvement side effects | Low | Backward compat check on every model update |

### 14.3 The irreducible minimum

With this model, AI can play the role of application coder without creating drift — with one condition. The canonical model must be complete, approved, and unambiguous. The risk of AI creating drift has been transformed from a coding problem into a canonical model authoring problem. That is a much smaller, more manageable, more human-appropriate problem to solve.

| Technology eliminates | Human judgment must provide |
|---|---|
| Pipeline integrity | Complete scenarios |
| Structural correctness | Unambiguous intent |
| Provable audit trail | Thorough glossary |
| Consensus on changes | Edge case coverage |
| AI structural drift | Canonical model approval quality |

---

## 15. Relationship to Existing Platforms and Research

### 15.1 Platform comparison

| Platform | What it solves | FABRIC relationship |
|---|---|---|
| Confluent Schema Registry | Schema versioning, compatibility enforcement, breaking change detection | FABRIC's registry design learns from Confluent's compatibility mode model. FABRIC extends it to cover behaviour, not just structure. |
| Pact (consumer-driven contracts) | Provider builds fail when they break consumer contracts | FABRIC's cross-object gate is Pact applied one layer earlier — at canonical model declaration time, not test time. |
| Temporal (workflow orchestration) | Durable, versioned, explicit operation step sequences with failure handling | FABRIC's operation contracts compile to Temporal-style workflows. FABRIC adds intent governance on top. |
| Smithy (AWS interface model) | Generated typed clients as the only sanctioned consumption path | FABRIC's dependency adapters follow the Smithy principle. FABRIC adds the canonical model layer that drives generation. |
| Backstage (Spotify) | Service catalog, dependency graph visibility, deprecation tracking | FABRIC generates Backstage catalog entries automatically. The catalog is a derived artifact, not a maintained document. |

FABRIC does not replace these platforms. In a full production deployment, FABRIC's canonical model is the source of truth that drives them.

### 15.2 Competitive landscape

**Spec-Driven Development (SDD)** has emerged as the dominant term for this approach. Existing implementations include StrongDM's Software Factory (closest to FABRIC's vision — treats scenarios as holdout sets), Constitutional Spec-Driven Development (embeds security constraints into the specification layer), and GitHub Spec Kit (makes specifications the centre of the engineering process but treats them as Markdown, not formalised machine-readable objects).

The critical gap across all existing implementations: the validation stage relies on test-first validation rather than direct specification-to-code verification. Every existing tool solves one layer. Nobody has built the unified pipeline that connects Intent → Contract → Template → AI Fill → Enforcement → Code Generation → Application Code → Chain with a single canonical model as the source of truth throughout.

### 15.3 Academic field mapping

| Field / Concept | How it maps to this framework |
|---|---|
| Model-Driven Engineering | Canonical model generating all artifacts |
| Domain-Driven Design | Ubiquitous language (GlossaryTerm), bounded contexts (IntegrationContract) |
| Formal Methods | Intent as specification, Scenario as formal assertion |
| Contract Testing (Pact) | IntegrationContract — replaced by shared canonical model |
| RLHF | CI feedback loop — enforcement gate as evaluator, chain as training data |
| Smart Contracts | Blockchain governance of IntegrationContracts |
| Behaviour-Driven Development | Given/When/Then Scenarios — extended to drive generation |
| Type-Driven Development | Generated interfaces as constraints on AI coding |
| Continuous Integration | Enforcement gates in pipeline |
| Knowledge Management | Canonical model as institutional knowledge store |

---

## 16. Build Sequence

FABRIC is built in two phases. Phase 1 completes the DKCE prototype — the current single-object pipeline. Phase 2 builds FABRIC on top of DKCE, using DKCE's own pipeline to generate FABRIC's governed foundation.

### 16.1 Phase 1 — Complete DKCE prototype

| Step | Work |
|---|---|
| Change 3 | Field-level diff check in scenario runner |
| GapFlag resolution | Fill check-stock-on-add-item, update canonical model, re-run codegen, re-implement |
| Change 4 | Throw-checker in gate.js |
| Second domain test | Run full pipeline against subscription-billing domain |
| Hash chain | PostgreSQL append-only chain.js with SHA-256 |
| CI pipeline | GitHub Actions — full pipeline on every commit to canonical model |
| Week 5 enforcement | Glossary checker, OpenAPI diff, Prisma triggers, property-based testing |

### 16.2 Phase 2 — Build FABRIC

| Sprint | Work |
|---|---|
| Sprint A | Author platform.canonical-model.yaml — the canonical model describing FABRIC itself. Run DKCE pipeline against it. FABRIC's foundation is governed from its first line. |
| Sprint B | Custom registry — PostgreSQL + filesystem artifact store. Publish command. Order-management object publishes first artifact. |
| Sprint C | Schema extension — objectMeta, objectDependencies, publishedOperations added to canonical model schema v2.0.0. Gate Pass 0 with dependency resolution. |
| Sprint D | Second object — Inventory canonical model authored and published. Order declares dependency. Codegen generates typed adapter. tsc enforces it. |
| Sprint E | Breaking change detection — oasdiff integration, compatibility modes, staleness notifications, deprecation protocol. |
| Sprint F | Operation runtime — custom Node.js state machine executing declared operation contract steps with durability, failure handling, and compensating actions. |
| Sprint G | Full audit trail — hash chain extended to cover cross-object dependency resolutions. Every pipeline run records exact dependency artifact hashes. |

> **Bootstrap insight**
>
> FABRIC is built using DKCE. The DKCE pipeline generates FABRIC's TypeScript interfaces, Prisma schema, OpenAPI spec, and rule stubs from platform.canonical-model.yaml. FABRIC's own components — the registry, the operation runtime, the cross-object gate — are built as governed implementations on top of that generated skeleton. FABRIC governs its own construction.

---

## 17. DKCE Completion Criteria

DKCE is complete — and ready to bootstrap FABRIC — when all of the following are met:

| # | Criterion |
|---|---|
| 1 | Gate Stage 2 passing with field-level diff check |
| 2 | All GapFlags resolved across both domains |
| 3 | Throw-checker in gate.js operational |
| 4 | Operation contracts schema extension designed and validated |
| 5 | Second domain test passing with < 3 GapFlags |
| 6 | Hash chain operational |
| 7 | CI pipeline running on every commit |
| 8 | Week 5 enforcement additions in place |

At that point DKCE is a proven, multi-domain pipeline with structural enforcement at every layer. It is ready to govern the construction of FABRIC.

---

## 18. Decision Log

| Decision | Rationale |
|---|---|
| Own JSON Schema instead of TypeSpec | Simpler, more controllable, core IP. TypeSpec can be added later as emitter target. |
| Full custom build for FABRIC (Option 3) | No external platform dependencies. Full portability. Core IP owned end to end. |
| DKCE bootstraps FABRIC | FABRIC's foundation is generated by DKCE. FABRIC governs its own construction from its first line. |
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
| Direct calls over step injection for operation implementations | Rationale not documented in source material. Decision recorded in HANDOVER.md. |
| Per-step compensating actions (not operation-level rollback) | Rationale not documented in source material. Decision recorded in HANDOVER.md. Per-step compensation is the pattern described in FABRIC section 9.4. |
| Reads/writes entity access declaration deferred | Documented as known open vector. Decision recorded in HANDOVER.md. |

---

## 19. Known Limitations

1. **Cross-entity conditions** — LeafCondition can only reference fields on the rule's entity. Cross-entity checks belong at the operation layer.
2. **Non-composing expressions** — ArithmeticExpression is single-operator only.
3. **GapFlags are JSON only** — gapflags.json for now. FABRIC's signal-collector will consume them.
4. **fill.js requires ANTHROPIC_API_KEY** — CI pipeline will need this as a secret.
5. **Operation layer ungoverned** — partial resolution via throw-checker; full resolution via operation contracts.
6. **Event emission unenforceable** — resolves with operation contracts.
7. **Glossary precision advisory** — precision checker is a planned enforcement addition.
8. **Canonical model authoring has late feedback loop** — authors discover schema mismatches only at validate.js time. Resolution: add YAML language server `$schema` directive to canonical model files, create schema migration guide, add `ajv-errors` annotations to schema for actionable error messages.

---

## 20. Known Gaps and Resolution Plan

The following gaps were identified in a formal architecture assessment. All have defined resolution plans.

### 20.1 Current sprint

| Gap | Resolution |
|---|---|
| Rule effects unconstrained by type — rules can silently modify fields outside their declared canonical action | Field-level diff check in scenario runner. After each rule call, assert only canonical action fields changed. |
| Operation layer ungoverned (partial) — operation implementations have no enforcement equivalent to rule stubs | Throw-checker in gate.js closes error code surface. Full resolution via operation contracts schema extension. |

### 20.2 Week 5

| Gap | Resolution |
|---|---|
| Glossary precision advisory — glossary changes do not propagate to filled conditions | Glossary precision checker in gate.js Pass 1. Extracts numeric precision from glossary, verifies it appears in filled condition. |
| No semantic diff on model changes — breaking changes invisible to downstream consumers | OpenAPI diff step in CI pipeline using oasdiff. backwardCompatible: true becomes verifiable. |
| Immutability compile-time only — TypeScript readonly has no runtime enforcement | Prisma migration scripts with database-level triggers for declared immutable fields. |
| Gate cannot catch boundary condition errors — sparse scenarios miss edge cases | fast-check property-based testing for numeric conditions. Schemathesis for OpenAPI spec. |

### 20.3 Backlog

| Gap | Resolution |
|---|---|
| Scenarios not a true holdout — fill AI sees scenario descriptions during fill | Process change: scenario authoring separated from canonical model authoring. Separate session, separate person. |
| No rule interaction model — conflicting rules on same entity field undetected | Gate pass checking for overlapping conditions across all rules on the same entity field. |
| Event emission unenforceable — rule returns plain object, emission deferred to operation layer | Resolves as consequence of operation contracts. No separate work needed. |
| Cross-object gate validation undesigned — gate is single-model validator | Dependency manifest with version pinning. Gate Pass 0 resolves cross-model dependencies from registry. |

---

## 21. Schema Version History

| Version | Key changes |
|---|---|
| v1.0.0 | Initial schema — 14 objects |
| v1.1.0 | Compound conditions, events registry, lifecycle, ObjectSchema, Pagination, PathParam, ErrorResponse |
| v1.2.0 | ExpressionValue, uuid+refEntity FK pattern, many-to-one relation, required inputMode/outputMode |
| v1.3.0 | Arithmetic action types removed, $value number-only, emits array/string, refEntity constrained, UIContract.intentRef optional |
| v2.1.0 | TemporalReference ($temporal, $dateAdd), expectedResult + outputFieldRefs on scenarios, operationContract definition, $id traceability alignment |
| v2.0.0 | objectMeta, objectDependencies, publishedOperations, operationContracts — PLANNED for FABRIC bootstrap |

---

## Appendix A — Key Terms

| Term | Definition |
|---|---|
| Canonical Model | The single versioned artifact containing all Intent, Scenario, GlossaryTerm, Entity, Rule, Operation, UIContract, and IntegrationContract objects. The only authoritative source for all layers. |
| Intent | Plain language description of what the system should do. Must be approved by a named human before entering the pipeline. |
| Scenario | A Given/When/Then example authored by an analyst. Automatically becomes a test case. Incomplete scenarios are the primary residual risk. |
| GlossaryTerm | Shared vocabulary with precise definitions. Ensures the same word means the same thing to analysts, developers, and AI. |
| Contract Layer | The formalised machine-readable representation of Intent. The single source of truth for building. |
| Template | A structured artifact produced by the framework from the canonical model. Pre-fills everything known, marks only what AI must provide as [REQUIRED]. |
| GapFlag | Raised when AI references something not in the canonical model. Framework-enforced after generation, not AI self-reported. |
| Enforcement Gate | Two-stage validation — Stage 1 against filled template (pre-code), Stage 2 against running application code (post-code). |
| IntegrationContract | A contract owned by neither producer nor consumer, governing the shared boundary between services or organisations. |
| ConfidenceScore | A composite metric tracking scenario coverage, gap flag rate, first-pass rate, escalation rate, and production error rate. The primary measure of canonical model health over time. |
| Concept Drift | The real-world meaning of a GlossaryTerm shifting over time without the canonical model being updated. A residual risk that requires periodic human review. |

---

## Appendix B — Layer Model Mapping

The FABRIC 7-layer architecture maps to the more granular 12-layer DKCE design model as follows:

| FABRIC Layer | DKCE Layer(s) |
|---|---|
| 1 — Intent (Canonical model) | Layer 1 — Business (Intent, Scenario, Glossary) + Layer 2 — Contract (Entity, Rule, Operation, UIContract, IntegrationContract) |
| 2 — Registry | Not in DKCE model (FABRIC addition) |
| 3 — Dependency declaration | Not in DKCE model (FABRIC addition) |
| 4 — Generated adapters | Layer 6 — Code Generation |
| 5 — Compiler enforcement | Part of Layer 7 — Application Coding (Wall 2) |
| 6 — Gate enforcement | Layer 3 — Template Generation + Layer 4 — AI Template Fill + Layer 5 — Enforcement Gate Stage 1 + Layer 8 — Enforcement Gate Stage 2 |
| 7 — Audit trail | Layer 9 — Blockchain Governance |

DKCE layers not mapped above: Layer 10 — Continuous Improvement, Layer 11 — Outputs (covered by section 8 "What FABRIC Produces"), Layer 12 — Residual Risk Register (covered by section 14.2 "Residual Risks").
