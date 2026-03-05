// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION — src/rules/subscription/convert-trial-on-renewal.ts
// ruleRef: convert-trial-on-renewal
// intentRef: convert-trial-to-active
// entityRef: subscription
// canonicalModelVersion: 1.0.0
// ─────────────────────────────────────────────────────────────────────────────

import type { ConvertTrialOnRenewalFn } from '../../../generated-subscription/rules/convert-trial-on-renewal';
import type { Subscription } from '../../../generated-subscription/interfaces/Subscription';
import { transitionSubscriptionStatus } from '../../../generated-subscription/interfaces/Subscription';

/**
 * Implements canonical rule: convert-trial-on-renewal
 *
 * canonicalCondition: AND [
 *   status eq "trialing",
 *   trial-ends-at lt { $temporal: "now" }
 * ]
 * canonicalAction: set status = "active"
 *   then: emit-event subscription.trial-converted
 *
 * Uses transitionSubscriptionStatus() for the status change (lifecycle
 * transitions must use the generated transition function).
 *
 * Scenarios covered:
 *   - trial-converts-to-active:         status=trialing, trialEndsAt in past → status=active
 *   - trial-not-converted-if-cancelled: status=cancelled → unchanged (condition not met)
 */
export const convertTrialOnRenewal: ConvertTrialOnRenewalFn = (subscription: Subscription): Subscription => {
  // intentRef: convert-trial-to-active
  // canonicalCondition: AND [status eq "trialing", trial-ends-at lt { $temporal: "now" }]
  const now = new Date();
  if (
    subscription.status === 'trialing' &&
    subscription.trialEndsAt !== null &&
    subscription.trialEndsAt < now
  ) {
    // canonicalAction: set status = "active"
    // Uses transitionSubscriptionStatus() — enforces lifecycle guard (trialing → active is valid)
    // then: emit-event subscription.trial-converted (event emission is operation-layer concern)
    return transitionSubscriptionStatus(subscription, 'active');
  }

  // Condition not met — return subscription unchanged
  return subscription;
};
