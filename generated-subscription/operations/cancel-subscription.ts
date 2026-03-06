// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.2.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    cancel-subscription
// method:       POST /subscriptions/{subscriptionId}/cancel
// intentRef:    cancel-subscription
// ruleRefs:     [cancel-at-period-end]
// scenarioRefs: [active-subscription-cancelled, trialing-subscription-cancelled, expired-subscription-cannot-be-cancelled]
//
// IMPLEMENT THIS STUB in: src/operations/cancel-subscription.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Subscription } from '../interfaces/Subscription';

export type CancelSubscriptionRequest = {
  pathParams: { subscriptionId: string };
};

export type CancelSubscriptionFn = (request: CancelSubscriptionRequest) => Subscription;

// The implementation must satisfy these scenarios:
// ✓ active-subscription-cancelled           
// ✓ trialing-subscription-cancelled         
// ✓ expired-subscription-cannot-be-cancelled 
