// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.2.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    reactivate-subscription
// method:       POST /subscriptions/{subscriptionId}/reactivate
// intentRef:    activate-trial-subscription
// ruleRefs:     []
// scenarioRefs: []
//
// IMPLEMENT THIS STUB in: src/operations/reactivate-subscription.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Subscription } from '../interfaces/Subscription';

export type ReactivateSubscriptionRequest = {
  pathParams: { subscriptionId: string };
};

export type ReactivateSubscriptionFn = (request: ReactivateSubscriptionRequest) => Subscription;
