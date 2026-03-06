// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: prevent-oversell
// canonicalModelVersion: 1.1.0
// entityRef: order-item
// scenarioRefs: [order-item-added-when-stock-sufficient, order-item-rejected-when-out-of-stock]
//
// Canonical condition:
//   quantity gte 1
//
// Canonical action:
//   call-operation add-order-item
//
// IMPLEMENT THIS STUB in: src/rules/check-stock-on-add-item.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { OrderItem } from '../interfaces/OrderItem';

export type CheckStockOnAddItemFn = (orderItem: OrderItem) => OrderItem;

// The implementation must satisfy these scenarios:
// ✓ order-item-added-when-stock-sufficient   — stock-level=10, quantity=3
// ✓ order-item-rejected-when-out-of-stock    — stock-level=2, quantity=5
