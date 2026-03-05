// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION — src/rules/subscription/cancel-at-period-end.ts
// ruleRef: cancel-at-period-end
// intentRef: cancel-subscription
// entityRef: subscription
// canonicalModelVersion: 1.0.0
// ─────────────────────────────────────────────────────────────────────────────

import type { CancelAtPeriodEndFn } from '../../../generated-subscription/rules/cancel-at-period-end';
import type { Subscription } from '../../../generated-subscription/interfaces/Subscription';
import { transitionSubscriptionStatus } from '../../../generated-subscription/interfaces/Subscription';

/**
 * Implements canonical rule: cancel-at-period-end
 *
 * canonicalCondition: OR [
 *   status eq "trialing",
 *   status eq "active"
 * ]
 * canonicalAction: set status = "cancelled"
 *
 * Uses transitionSubscriptionStatus() for the status change (lifecycle
 * transitions must use the generated transition function).
 *
 * Scenarios covered:
 *   - active-subscription-cancelled:                status=active   → status=cancelled
 *   - trialing-subscription-cancelled:              status=trialing → status=cancelled
 *   - expired-subscription-cannot-be-cancelled:     status=expired  → throw SUBSCRIPTION_NOT_CANCELLABLE
 */
export const cancelAtPeriodEnd: CancelAtPeriodEndFn = (subscription: Subscription): Subscription => {
  // intentRef: cancel-subscription
  // canonicalCondition: OR [status eq "trialing", status eq "active"]
  if (subscription.status === 'trialing' || subscription.status === 'active') {
    // canonicalAction: set status = "cancelled"
    // Uses transitionSubscriptionStatus() — enforces lifecycle guard
    // (trialing → cancelled and active → cancelled are both valid)
    return transitionSubscriptionStatus(subscription, 'cancelled');
  }

  // Condition not met — subscription is not in a cancellable state
  // SUBSCRIPTION_NOT_CANCELLABLE is declared in cancel-subscription operation errorResponses (statusCode: 409)
  throw new Error('SUBSCRIPTION_NOT_CANCELLABLE');
};
