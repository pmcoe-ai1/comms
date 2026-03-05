// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION — src/rules/confirm-order-on-payment.ts
// ruleRef: confirm-order-on-payment
// intentRef: confirm-order-on-payment
// entityRef: order
// canonicalModelVersion: 1.0.0
// ─────────────────────────────────────────────────────────────────────────────

import type { ConfirmOrderOnPaymentFn } from '../../generated/rules/confirm-order-on-payment';
import type { Order } from '../../generated/interfaces/Order';
import { transitionOrderStatus } from '../../generated/interfaces/Order';

/**
 * Implements canonical rule: confirm-order-on-payment
 *
 * canonicalCondition: status eq "pending"
 * canonicalAction: set status = "confirmed", then emit-event order.confirmed
 *
 * Uses transitionOrderStatus() for the status change (AGENTS.md rule 5:
 * lifecycle transitions must use the generated transition function).
 *
 * Scenarios covered:
 *   - order-confirmed-on-payment:              status=pending   → status=confirmed
 *   - order-not-confirmed-on-failed-payment:   status=pending   → status=pending (unchanged)
 *
 * Note: the "failed payment" scenario is a caller concern — if payment fails,
 * this rule is never invoked. The rule itself only fires when payment succeeds
 * and the order is pending.
 */
export const confirmOrderOnPayment: ConfirmOrderOnPaymentFn = (order: Order): Order => {
  // canonicalCondition: status eq "pending"
  if (order.status === 'pending') {
    // canonicalAction: set status = "confirmed"
    // Uses transitionOrderStatus() — enforces lifecycle guard (pending → confirmed is valid)
    // then: emit-event order.confirmed (event emission is operation-layer concern)
    return transitionOrderStatus(order, 'confirmed');
  }

  // Condition not met — return order unchanged
  return order;
};
