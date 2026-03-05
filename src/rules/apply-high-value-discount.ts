// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION — src/rules/apply-high-value-discount.ts
// ruleRef: apply-high-value-discount
// intentRef: reward-high-value-orders
// entityRef: order
// canonicalModelVersion: 1.0.0
// ─────────────────────────────────────────────────────────────────────────────

import type { ApplyHighValueDiscountFn } from '../../generated/rules/apply-high-value-discount';
import type { Order } from '../../generated/interfaces/Order';

/**
 * Implements canonical rule: apply-high-value-discount
 *
 * canonicalCondition: AND(total >= 1000, NOT(discount > 0))
 * canonicalAction: set discount = total multiply 0.1, then emit-event order.discount-applied
 *
 * Scenarios covered:
 *   - high-value-discount-applied:            total=1200, discount=0  → discount=120
 *   - already-discounted-not-re-discounted:   total=1200, discount=50 → discount=50 (unchanged)
 *   - no-discount-below-threshold:            total=999,  discount=0  → discount=0  (unchanged)
 */
export const applyHighValueDiscount: ApplyHighValueDiscountFn = (order: Order): Order => {
  // canonicalCondition: AND(total >= 1000, NOT(discount > 0))
  // glossaryRef: high-value-order (threshold = 1000 AUD, conceptVersion 1.0)
  const meetsThreshold = order.total >= 1000;
  // glossaryRef: discount (must be zero to qualify — NOT(discount > 0))
  const notAlreadyDiscounted = !(order.discount > 0);

  if (meetsThreshold && notAlreadyDiscounted) {
    // canonicalAction: set discount = total multiply 0.1
    // glossaryRef: discount-rate (0.1 = 10%, conceptVersion 1.0)
    // then: emit-event order.discount-applied (event emission is operation-layer concern)
    return { ...order, discount: order.total * 0.1 };
  }

  // Condition not met — return order unchanged
  return order;
};
