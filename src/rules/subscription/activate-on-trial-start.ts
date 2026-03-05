// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION — src/rules/subscription/activate-on-trial-start.ts
// ruleRef: activate-on-trial-start
// intentRef: activate-trial-subscription
// entityRef: subscription
// canonicalModelVersion: 1.0.0
// ─────────────────────────────────────────────────────────────────────────────

import type { ActivateOnTrialStartFn } from '../../../generated-subscription/rules/activate-on-trial-start';
import type { Subscription } from '../../../generated-subscription/interfaces/Subscription';

/**
 * Implements canonical rule: activate-on-trial-start
 *
 * canonicalCondition: status is-null
 * canonicalAction: call-operation determine-initial-status
 *   then: emit-event subscription.trial-started
 *
 * This rule validates the precondition for subscription activation: the
 * subscription's status must be null (not yet initialised). The actual
 * determination of initial status (trialing vs active based on plan.trialDays)
 * is the responsibility of the operation layer — this rule cannot access
 * cross-entity data (plan.trialDays).
 *
 * Scenarios covered:
 *   - subscription-created-in-trial:     status=null → operation sets trialing
 *   - subscription-created-without-trial: status=null → operation sets active
 */
export const activateOnTrialStart: ActivateOnTrialStartFn = (subscription: Subscription): Subscription => {
  // intentRef: activate-trial-subscription
  // canonicalCondition: status is-null
  if (subscription.status === null || subscription.status === undefined) {
    // canonicalAction: call-operation determine-initial-status
    // The actual operation call is the caller's responsibility — this rule validates
    // the precondition (status is null) and returns the subscription unchanged.
    // then: emit-event subscription.trial-started (event emission is operation-layer concern)
    return subscription;
  }

  // Condition not met — subscription already has a status, cannot re-activate
  // PLAN_NOT_ACTIVE is declared in subscribe-to-plan operation errorResponses (statusCode: 409)
  throw new Error('PLAN_NOT_ACTIVE');
};
