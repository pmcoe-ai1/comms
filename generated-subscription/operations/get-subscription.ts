// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.2.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    get-subscription
// method:       GET /subscriptions/{subscriptionId}
// intentRef:    view-subscription-details
// ruleRefs:     []
// scenarioRefs: []
//
// IMPLEMENT THIS STUB in: src/operations/get-subscription.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Subscription } from '../interfaces/Subscription';

export type GetSubscriptionRequest = {
  pathParams: { subscriptionId: string };
};

export type GetSubscriptionFn = (request: GetSubscriptionRequest) => Subscription;
