// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.0.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: confirm-order-on-payment
// canonicalModelVersion: 1.0.0
// entityRef: order
// scenarioRefs: [order-confirmed-on-payment, order-not-confirmed-on-failed-payment]
//
// Canonical condition:
//   status eq pending
//
// Canonical action:
//   set status = "confirmed"
//   then: emit-event order.confirmed
//
// IMPLEMENT THIS STUB in: src/rules/confirm-order-on-payment.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Order } from '../interfaces/Order';

export type ConfirmOrderOnPaymentFn = (order: Order) => Order;

// The implementation must satisfy these scenarios:
// ✓ order-confirmed-on-payment               — status=pending
// ✓ order-not-confirmed-on-failed-payment   
