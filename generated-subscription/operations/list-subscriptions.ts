// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.2.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    list-subscriptions
// method:       GET /customers/{customerId}/subscriptions
// intentRef:    view-subscription-details
// ruleRefs:     []
// scenarioRefs: []
//
// IMPLEMENT THIS STUB in: src/operations/list-subscriptions.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Subscription } from '../interfaces/Subscription';

export type ListSubscriptionsRequest = {
  pathParams: { customerId: string };
};

export type ListSubscriptionsFn = (request: ListSubscriptionsRequest) => Subscription;
