// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    cancel-order
// method:       POST /orders/{orderId}/cancel
// intentRef:    confirm-order-on-payment
// ruleRefs:     []
// scenarioRefs: [pending-order-cancelled, confirmed-order-cannot-be-cancelled]
//
// IMPLEMENT THIS STUB in: src/operations/cancel-order.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Order } from '../interfaces/Order';

export type CancelOrderRequest = {
  pathParams: { orderId: string };
};

export type CancelOrderFn = (request: CancelOrderRequest) => Order;

// The implementation must satisfy these scenarios:
// ✓ pending-order-cancelled                 
// ✓ confirmed-order-cannot-be-cancelled     
