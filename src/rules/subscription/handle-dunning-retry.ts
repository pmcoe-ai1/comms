// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION — src/rules/subscription/handle-dunning-retry.ts
// ruleRef: handle-dunning-retry
// intentRef: handle-dunning
// entityRef: subscription
// canonicalModelVersion: 1.0.0
// ─────────────────────────────────────────────────────────────────────────────

import type { HandleDunningRetryFn } from '../../../generated-subscription/rules/handle-dunning-retry';
import type { Subscription } from '../../../generated-subscription/interfaces/Subscription';

/**
 * Implements canonical rule: handle-dunning-retry
 *
 * canonicalCondition: AND [
 *   status eq "past-due",
 *   dunning-attempts lte 3
 * ]
 * canonicalAction: set dunning-attempts = dunning-attempts + 1
 *
 * This rule increments the dunning counter when the subscription is past-due
 * and has not exhausted all retry attempts. The operation layer is responsible
 * for the actual payment retry, status transitions (past-due → active on
 * success, past-due → cancelled when dunning exhausted), and dunningAttempts
 * reset on success.
 *
 * Scenarios covered:
 *   - dunning-retry-succeeds:                   status=past-due, attempts=1 → attempts=2
 *     (status→active and reset→0 are operation-layer concerns after payment success)
 *   - dunning-exhausted-cancels-subscription:   status=past-due, attempts=3 → attempts=4
 *     (status→cancelled is operation-layer concern when attempts > max)
 */
export const handleDunningRetry: HandleDunningRetryFn = (subscription: Subscription): Subscription => {
  // intentRef: handle-dunning
  // canonicalCondition: AND [status eq "past-due", dunning-attempts lte 3]
  if (subscription.status === 'past-due' && subscription.dunningAttempts <= 3) {
    // canonicalAction: set dunning-attempts = dunning-attempts + 1
    return {
      ...subscription,
      dunningAttempts: subscription.dunningAttempts + 1,
    };
  }

  // Condition not met — subscription is not in a retryable state
  // SUBSCRIPTION_NOT_PAST_DUE is declared in retry-payment operation errorResponses (statusCode: 409)
  throw new Error('SUBSCRIPTION_NOT_PAST_DUE');
};
