// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION — src/rules/subscription/activate-on-trial-start.ts
// ruleRef: activate-on-trial-start
// intentRef: activate-trial-subscription
// entityRef: subscription
// canonicalModelVersion: 1.1.0
// ─────────────────────────────────────────────────────────────────────────────

import type { ActivateOnTrialStartFn } from '../../../generated-subscription/rules/activate-on-trial-start';
import type { Subscription } from '../../../generated-subscription/interfaces/Subscription';

/**
 * Implements canonical rule: activate-on-trial-start
 *
 * canonicalCondition: plan-id is-not-null
 * canonicalAction: set status = "trialing"
 *   then: emit-event subscription.trial-started
 *
 * This rule checks that the subscription has a planId assigned, then
 * sets the status to "trialing". The emit-event is an operation-layer
 * concern and is not implemented here.
 *
 * Scenarios covered:
 *   - subscription-created-in-trial:     planId present → status set to trialing
 *   - subscription-created-without-trial: planId present → status set to trialing
 *     (operation layer determines if trial applies; rule always sets trialing)
 */
export const activateOnTrialStart: ActivateOnTrialStartFn = (subscription: Subscription): Subscription => {
  // intentRef: activate-trial-subscription
  // canonicalCondition: plan-id is-not-null
  if (subscription.planId !== null && subscription.planId !== undefined) {
    // canonicalAction: set status = "trialing"
    // Direct set — not using transitionSubscriptionStatus() because this is
    // initial state assignment, not a lifecycle transition from an existing state.
    // then: emit-event subscription.trial-started (operation-layer concern)
    return { ...subscription, status: 'trialing' as any };
  }

  // Condition not met — subscription has no plan assigned
  // PLAN_NOT_ACTIVE is declared in subscribe-to-plan operation errorResponses (statusCode: 409)
  throw new Error('PLAN_NOT_ACTIVE');
};
