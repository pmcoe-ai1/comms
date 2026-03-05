# DKCE Prototype — AGENTS.md

## What this project is

The **Domain Knowledge Crystallisation Engine (DKCE)**. A pipeline that prevents
AI/code drift by using a canonical model as the single source of truth for all
code generation.

The canonical model (`canonical-model.yaml`) is authored by humans. Everything
else — TypeScript interfaces, Prisma schemas, OpenAPI specs, rule stubs — is
generated from it. The AI (this agent) writes generators and application code.
It never writes domain objects directly.

---

## The pipeline (in order)

```
canonical-model.yaml
  ↓ template-generator.js   reads model → produces fill templates for null rules
  ↓ fill.js                  calls Claude API → populates rule slots
  ↓ gate.js                  validates filled templates (structural + semantic)
  ↓ codegen.js               reads approved model → generates all artifacts
  ↓ (app layer)              Claude Code writes application code against generated interfaces
```

Each stage produces artifacts consumed by the next. **No stage may skip the one before it.**

---

## Project structure

```
dkce-prototype/
  canonical-model.schema.json     — JSON Schema for the canonical model format
  example.canonical-model.yaml    — the live canonical model (do not edit directly)
  template-generator.js           — stage 1: produces fill templates
  fill.js                         — stage 2: AI fill via Claude API
  gate.js                         — stage 3: enforcement gate
  codegen.js                      — stage 4: TO BUILD (see below)
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
  AGENTS.md                       — this file
```

---

## Hard rules — non-negotiable

These are enforced by the pipeline. Violating them produces drift. Claude Code
must follow every one of them without exception.

### 1. Never invent domain objects

**Generated code is a projection of the canonical model. It is not an improvement of it.**

```typescript
// ✅ CORRECT — field exists in canonical model with this exact id and type
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

If a field seems missing and useful, the fix is to add it to `canonical-model.yaml`
with an approved Intent and GlossaryTerm. Not to add it to generated code.

### 2. Every generated type must carry its traceability comment

Every generated TypeScript interface, Prisma model, and rule stub must include
its canonical model references as comments. This is the audit trail.

```typescript
// ✅ CORRECT
// intentRef: reward-high-value-orders
// canonicalModelVersion: 1.0.0
// entityRef: order
export interface Order { ... }

// ✗ WRONG — missing traceability
export interface Order { ... }
```

```prisma
// ✅ CORRECT
/// intentRef: confirm-order-on-payment
/// canonicalModelVersion: 1.0.0
model Order {
  id String @id
}

// ✗ WRONG
model Order {
  id String @id
}
```

### 3. Never add helper methods or computed properties to generated interfaces

Generated interfaces are data shapes only. No methods. No getters. No computed fields.
Application logic belongs in `src/`, not in `generated/`.

```typescript
// ✅ CORRECT — data shape only
export interface Order {
  id: string;
  total: number;
  discount: number;
}

// ✗ WRONG — methods and computed properties do not belong in generated interfaces
export interface Order {
  id: string;
  total: number;
  discount: number;
  getNetTotal(): number;          // ✗ method — belongs in src/
  readonly netTotal: number;      // ✗ computed — belongs in src/
  isHighValue: boolean;           // ✗ derived — belongs in src/
}
```

### 4. Immutable fields must not have setters

If a field is `immutable: true` in the canonical model, the generated code must
enforce this. In TypeScript: `readonly`. In Prisma: the field must be excluded
from update input types.

```typescript
// canonical model: field id: unit-price, immutable: true

// ✅ CORRECT
export interface OrderItem {
  readonly unitPrice: number; // immutable: true in canonical model
}

// ✗ WRONG — unitPrice can be reassigned
export interface OrderItem {
  unitPrice: number;
}
```

### 5. Lifecycle transitions must be enforced — no raw status assignments

If an entity has `lifecycle` defined in the canonical model, generated code must
not allow arbitrary status assignment. Status changes must go through a transition
function that validates against the declared transitions.

```typescript
// canonical model: order has lifecycle with transitions

// ✅ CORRECT — transition enforced
function transitionOrderStatus(
  order: Order,
  to: OrderStatus
): Order {
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

### 6. Rule implementations must match their canonical condition exactly

When implementing a rule in `src/rules/`, the condition logic must match the
canonical model's filled condition. No additions, no shortcuts.

```typescript
// canonical model: apply-high-value-discount
// condition: { and: [ {field: total, operator: gte, value: 1000},
//                     {not: {field: discount, operator: gt, value: 0}} ] }

// ✅ CORRECT — matches canonical condition exactly
function applyHighValueDiscount(order: Order): Order {
  // intentRef: reward-high-value-orders
  // canonicalCondition: AND(total >= 1000, NOT(discount > 0))
  if (order.total >= 1000 && !(order.discount > 0)) {
    return { ...order, discount: order.total * 0.1 };
  }
  return order;
}

// ✗ WRONG — condition modified (added loyalty check not in canonical model)
function applyHighValueDiscount(order: Order, customer: Customer): Order {
  if (order.total >= 1000 && customer.isLoyal && !(order.discount > 0)) {
    return { ...order, discount: order.total * 0.1 };
  }
  return order;
}
```

### 7. Operations must declare all canonical error responses

Every operation implementation must handle every `errorResponse` declared in the
canonical model. Undeclared error shapes must not be thrown.

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

### 8. Never modify files in `generated/` by hand

The `generated/` directory is owned by `codegen.js`. Any manual edit will be
overwritten on the next codegen run. If generated output is wrong, fix `codegen.js`
or fix `canonical-model.yaml`. Never patch `generated/` directly.

### 9. Generated files must include a file-level guard comment

Every file in `generated/` must start with this comment so editors and reviewers
know not to edit it manually:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v{version}
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────
```

### 10. The canonical model is the source of truth for field names

Generated code uses the `name` field from the canonical model verbatim. Do not
camelCase, snake_case, or rename. If the canonical model says `customerId`, the
TypeScript field is `customerId`. If it says `stockLevel`, the Prisma column is
`stockLevel`.

```typescript
// canonical model: field id: customer-id, name: customerId

// ✅ CORRECT
export interface Order {
  customerId: string;
}

// ✗ WRONG — renamed
export interface Order {
  customer_id: string;   // ✗ snake_case not in canonical model
  customerID: string;    // ✗ different casing
  customer: string;      // ✗ abbreviated
}
```

---

## What to build: codegen.js

This is the next piece to build. It reads the approved canonical model and
generates all artifacts.

### Inputs
- `example.canonical-model.yaml` (or any canonical-model.yaml passed as argument)

### Outputs (all in `generated/`)

| Output | Description |
|--------|-------------|
| `interfaces/{EntityName}.ts` | TypeScript interface per entity |
| `interfaces/enums.ts` | All enum types in one file |
| `prisma/schema.prisma` | Full Prisma schema |
| `openapi/openapi.yaml` | OpenAPI 3.1 spec |
| `rules/{rule-id}.ts` | Typed rule function stub per rule |

### TypeScript interface spec

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

// Embedded object type for Order.shippingAddress
export interface OrderShippingAddress {
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  country: string;
}

// Input type for creating an Order (excludes system and immutable fields)
export interface CreateOrderInput {
  customerId: string;
  total: number;
  discount?: number;
  shippingAddress?: OrderShippingAddress;
  tags?: string[];
}

// Input type for updating an Order (only mutable, non-system fields)
// Note: status changes must use transitionOrderStatus(), not this type directly.
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

### Prisma schema spec

Single `schema.prisma` file. Example for `Order`:

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

### OpenAPI 3.1 spec

Single `openapi.yaml`. Map canonical model operations exactly:

- `inputMode: body` → `requestBody` with schema referencing the entity's CreateInput
- `inputMode: query` → `parameters` array with filterable fields as query params
- `inputMode: none` → no `requestBody`
- `outputMode: single` → `200` response with entity schema
- `outputMode: collection` → `200` response with paginated wrapper: `{ data: Entity[], cursor?: string, total?: number }`
- `outputMode: none` → `204` response, no content
- `errorResponses` → one response entry per declared error, using the `code` as the schema discriminator
- `pathParams` → `parameters` with `in: path`
- `auth.required: true` → `security` on the operation
- `rateLimit` → `x-rate-limit` extension on the operation

### Rule stub spec

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

## When writing application code in `src/`

These rules apply when Claude Code writes implementations (not generators).

### Always import from `generated/`, never redefine types

```typescript
// ✅ CORRECT
import type { Order, CreateOrderInput } from '../generated/interfaces/Order';

// ✗ WRONG — redefining types that already exist in generated/
interface Order {
  id: string;
  // ... duplicating what's already generated
}
```

### Rule implementations must import their stub type

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

### Never throw errors not declared in the canonical model

If `add-order-item` declares four error codes, the implementation throws exactly
those four codes. It does not throw generic `Error`, `TypeError`, or undeclared
domain errors. New error conditions must first be added to the canonical model.

### Use the lifecycle transition function for all status changes

```typescript
// ✅ CORRECT
import { transitionOrderStatus } from '../generated/interfaces/Order';
const confirmed = transitionOrderStatus(order, 'confirmed');

// ✗ WRONG
const confirmed = { ...order, status: 'confirmed' as OrderStatus };
```

---

## Running the pipeline

```bash
# Validate canonical model
node validate.js

# Generate fill templates for null rules
node template-generator.js example.canonical-model.yaml --output-dir ./templates

# Fill templates (requires ANTHROPIC_API_KEY)
node fill.js templates/<rule-id>.fill-template.yaml

# Run enforcement gate
node gate.js templates/<rule-id>.filled.yaml --model example.canonical-model.yaml

# Generate all artifacts (once codegen.js is built)
node codegen.js example.canonical-model.yaml --output-dir ./generated

# Run TypeScript compiler against generated interfaces (drift wall)
npx tsc --noEmit
```

---

## GapFlag — what to do when the canonical model is incomplete

If application code needs something that doesn't exist in the canonical model
(a field, a rule, an operation), do not invent it. Instead:

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

GapFlags are collected by the continuous improvement layer and fed back to the
canonical model owners. They are never resolved by the agent unilaterally.

---

## What Claude Code should never do

| Action | Why |
|--------|-----|
| Edit `canonical-model.yaml` directly | Only humans with approvedBy authority may change the canonical model |
| Edit `canonical-model.schema.json` | Schema changes require a version bump and human review |
| Edit anything in `generated/` | Generated files are owned by codegen.js |
| Add fields to generated types that aren't in the canonical model | This is the primary source of drift |
| Throw undeclared error codes | Every error shape must be in the canonical model's errorResponses |
| Bypass the lifecycle transition function | Direct status assignments break the state machine guarantee |
| Combine two rules into one implementation | One canonical rule → one implementation function |
| Skip the gate stage | Gate-failed templates must be refilled, not force-merged |
