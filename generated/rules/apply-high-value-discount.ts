// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: reward-high-value-orders
// canonicalModelVersion: 1.1.0
// entityRef: order
// scenarioRefs: [high-value-discount-applied, already-discounted-not-re-discounted, no-discount-below-threshold]
//
// Canonical condition:
//   AND [
//     total gte 1000,
//     NOT (
//       discount gt 0
//     ),
//   ]
//
// Canonical action:
//   set discount = total multiply 0.1
//     emit-event order.discount-applied
//
// IMPLEMENT THIS STUB in: src/rules/apply-high-value-discount.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Order } from '../interfaces/Order';

export type ApplyHighValueDiscountFn = (order: Order) => Order;

// The implementation must satisfy these scenarios:
// ✓ high-value-discount-applied              — total=1200, discount=0
// ✓ already-discounted-not-re-discounted     — discount=50
// ✓ no-discount-below-threshold              — total=999, discount=0
