// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    apply-discount-to-order
// method:       POST /orders/{orderId}/discount
// intentRef:    reward-high-value-orders
// ruleRefs:     [apply-high-value-discount]
// scenarioRefs: [high-value-discount-applied, no-discount-below-threshold]
//
// IMPLEMENT THIS STUB in: src/operations/apply-discount-to-order.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Order } from '../interfaces/Order';

export type ApplyDiscountToOrderRequest = {
  pathParams: { orderId: string };
};

export type ApplyDiscountToOrderFn = (request: ApplyDiscountToOrderRequest) => Order;

// The implementation must satisfy these scenarios:
// ✓ high-value-discount-applied              — total=1200, discount=0
// ✓ no-discount-below-threshold              — total=999, discount=0
