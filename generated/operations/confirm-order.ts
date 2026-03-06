// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    confirm-order
// method:       POST /orders/{orderId}/confirm
// intentRef:    confirm-order-on-payment
// ruleRefs:     [confirm-order-on-payment]
// scenarioRefs: [order-confirmed-on-payment, order-not-confirmed-on-failed-payment]
//
// IMPLEMENT THIS STUB in: src/operations/confirm-order.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Order } from '../interfaces/Order';

export type ConfirmOrderRequest = {
  pathParams: { orderId: string };
};

export type ConfirmOrderFn = (request: ConfirmOrderRequest) => Order;

// The implementation must satisfy these scenarios:
// ✓ order-confirmed-on-payment               — status=pending
// ✓ order-not-confirmed-on-failed-payment   
