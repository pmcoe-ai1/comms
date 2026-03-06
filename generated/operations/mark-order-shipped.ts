// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    mark-order-shipped
// method:       POST /orders/{orderId}/ship
// intentRef:    confirm-order-on-payment
// ruleRefs:     []
// scenarioRefs: [processing-order-marked-shipped]
//
// IMPLEMENT THIS STUB in: src/operations/mark-order-shipped.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Order } from '../interfaces/Order';

export type MarkOrderShippedRequest = {
  pathParams: { orderId: string };
};

export type MarkOrderShippedFn = (request: MarkOrderShippedRequest) => Order;

// The implementation must satisfy these scenarios:
// ✓ processing-order-marked-shipped         
