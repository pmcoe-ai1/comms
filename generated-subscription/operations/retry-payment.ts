// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.2.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    retry-payment
// method:       POST /subscriptions/{subscriptionId}/retry
// intentRef:    handle-dunning
// ruleRefs:     [handle-dunning-retry]
// scenarioRefs: [dunning-retry-succeeds, dunning-exhausted-cancels-subscription]
//
// IMPLEMENT THIS STUB in: src/operations/retry-payment.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Subscription } from '../interfaces/Subscription';

export type RetryPaymentRequest = {
  pathParams: { subscriptionId: string };
};

export type RetryPaymentFn = (request: RetryPaymentRequest) => Subscription;

// The implementation must satisfy these scenarios:
// ✓ dunning-retry-succeeds                  
// ✓ dunning-exhausted-cancels-subscription  
