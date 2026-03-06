// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.2.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: handle-dunning
// canonicalModelVersion: 1.2.0
// entityRef: subscription
// scenarioRefs: [dunning-retry-succeeds, dunning-exhausted-cancels-subscription]
//
// Canonical condition:

//
// Canonical action:
//   set dunning-attempts = {"$add":{"left":{"$field":"dunning-attempts"},"right":{"$value":1}}}
//
// IMPLEMENT THIS STUB in: src/rules/handle-dunning-retry.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Subscription } from '../interfaces/Subscription';

export type HandleDunningRetryFn = (subscription: Subscription) => Subscription;

// The implementation must satisfy these scenarios:
// ✓ dunning-retry-succeeds                  
// ✓ dunning-exhausted-cancels-subscription  
