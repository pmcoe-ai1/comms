// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    add-order-item
// method:       POST /orders/{orderId}/items
// intentRef:    prevent-oversell
// ruleRefs:     [check-stock-on-add-item]
// scenarioRefs: [order-item-added-when-stock-sufficient, order-item-rejected-when-out-of-stock]
//
// IMPLEMENT THIS STUB in: src/operations/add-order-item.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { OrderItem } from '../interfaces/OrderItem';

export type AddOrderItemRequest = {
  body: OrderItem;
  pathParams: { orderId: string };
};

export type AddOrderItemFn = (request: AddOrderItemRequest) => OrderItem;

// The implementation must satisfy these scenarios:
// ✓ order-item-added-when-stock-sufficient   — stock-level=10, quantity=3
// ✓ order-item-rejected-when-out-of-stock    — stock-level=2, quantity=5
