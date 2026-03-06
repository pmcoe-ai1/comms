// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    mark-order-delivered
// method:       POST /orders/{orderId}/deliver
// intentRef:    confirm-order-on-payment
// ruleRefs:     []
// scenarioRefs: [shipped-order-marked-delivered]
//
// IMPLEMENT THIS STUB in: src/operations/mark-order-delivered.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Order } from '../interfaces/Order';

export type MarkOrderDeliveredRequest = {
  pathParams: { orderId: string };
};

export type MarkOrderDeliveredFn = (request: MarkOrderDeliveredRequest) => Order;

// The implementation must satisfy these scenarios:
// ✓ shipped-order-marked-delivered          
