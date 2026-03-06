// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    list-orders
// method:       GET /customers/{customerId}/orders
// intentRef:    —
// ruleRefs:     []
// scenarioRefs: []
//
// IMPLEMENT THIS STUB in: src/operations/list-orders.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Order } from '../interfaces/Order';

export type ListOrdersRequest = {
  pathParams: { customerId: string };
};

export type ListOrdersFn = (request: ListOrdersRequest) => Order;
