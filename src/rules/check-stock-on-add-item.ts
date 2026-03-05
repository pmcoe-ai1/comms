// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION — src/rules/check-stock-on-add-item.ts
// ruleRef: check-stock-on-add-item
// intentRef: prevent-oversell
// entityRef: order-item
// canonicalModelVersion: 1.0.0
// ─────────────────────────────────────────────────────────────────────────────

import type { CheckStockOnAddItemFn } from '../../generated/rules/check-stock-on-add-item';
import type { OrderItem } from '../../generated/interfaces/OrderItem';

/**
 * Implements canonical rule: check-stock-on-add-item
 *
 * canonicalCondition: quantity gte 1
 * canonicalAction: call-operation add-order-item
 *
 * Cross-entity stock validation (Product.stockLevel vs OrderItem.quantity) is
 * the responsibility of the add-order-item operation layer, not this rule.
 * This rule validates only what OrderItem's type signature can see: quantity >= 1.
 *
 * Scenarios covered:
 *   - order-item-added-when-stock-sufficient:   quantity=3,  stock=10 → delegated to operation
 *   - order-item-rejected-when-out-of-stock:    quantity=5,  stock=2  → delegated to operation
 */
export const checkStockOnAddItem: CheckStockOnAddItemFn = (orderItem: OrderItem): OrderItem => {
  // intentRef: prevent-oversell
  // canonicalCondition: quantity gte 1
  // glossaryRef: order-item-quantity (min: 1, max: 9999, conceptVersion 1.0)
  if (!(orderItem.quantity >= 1)) {
    // INVALID_QUANTITY is declared in add-order-item operation errorResponses (statusCode: 422)
    throw new Error('INVALID_QUANTITY');
  }

  // canonicalAction: call-operation add-order-item
  // The actual operation call is the caller's responsibility — this rule validates
  // the precondition (quantity >= 1) and returns the orderItem unchanged if valid.
  return orderItem;
};
