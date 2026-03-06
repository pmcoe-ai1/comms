// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.2.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    renew-subscription
// method:       POST /subscriptions/{subscriptionId}/renew
// intentRef:    renew-active-subscription
// ruleRefs:     [convert-trial-on-renewal]
// scenarioRefs: [trial-converts-to-active, active-subscription-renewed, renewal-fails-moves-to-past-due]
//
// IMPLEMENT THIS STUB in: src/operations/renew-subscription.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Subscription } from '../interfaces/Subscription';

export type RenewSubscriptionRequest = {
  pathParams: { subscriptionId: string };
};

export type RenewSubscriptionFn = (request: RenewSubscriptionRequest) => Subscription;

// The implementation must satisfy these scenarios:
// ✓ trial-converts-to-active                
// ✓ active-subscription-renewed             
// ✓ renewal-fails-moves-to-past-due         
