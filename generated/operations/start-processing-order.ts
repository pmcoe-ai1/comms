// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    start-processing-order
// method:       POST /orders/{orderId}/process
// intentRef:    confirm-order-on-payment
// ruleRefs:     []
// scenarioRefs: [confirmed-order-moves-to-processing]
//
// IMPLEMENT THIS STUB in: src/operations/start-processing-order.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Order } from '../interfaces/Order';

export type StartProcessingOrderRequest = {
  pathParams: { orderId: string };
};

export type StartProcessingOrderFn = (request: StartProcessingOrderRequest) => Order;

// The implementation must satisfy these scenarios:
// ✓ confirmed-order-moves-to-processing     
