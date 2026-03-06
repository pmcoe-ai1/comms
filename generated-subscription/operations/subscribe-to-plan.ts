// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.2.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    subscribe-to-plan
// method:       POST /customers/{customerId}/subscriptions
// intentRef:    activate-trial-subscription
// ruleRefs:     [activate-on-trial-start]
// scenarioRefs: [subscription-created-in-trial, subscription-created-without-trial]
//
// IMPLEMENT THIS STUB in: src/operations/subscribe-to-plan.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Subscription } from '../interfaces/Subscription';

export type SubscribeToPlanRequest = {
  body: Subscription;
  pathParams: { customerId: string };
};

export type SubscribeToPlanFn = (request: SubscribeToPlanRequest) => Subscription;

// The implementation must satisfy these scenarios:
// ✓ subscription-created-in-trial           
// ✓ subscription-created-without-trial      
