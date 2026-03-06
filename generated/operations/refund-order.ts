// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    refund-order
// method:       POST /orders/{orderId}/refund
// intentRef:    confirm-order-on-payment
// ruleRefs:     []
// scenarioRefs: [confirmed-order-refunded, delivered-order-refunded]
//
// IMPLEMENT THIS STUB in: src/operations/refund-order.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Order } from '../interfaces/Order';

export type RefundOrderRequest = {
  pathParams: { orderId: string };
};

export type RefundOrderFn = (request: RefundOrderRequest) => Order;

// The implementation must satisfy these scenarios:
// ✓ confirmed-order-refunded                
// ✓ delivered-order-refunded                
