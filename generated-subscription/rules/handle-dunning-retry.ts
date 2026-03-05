// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.0.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: handle-dunning
// canonicalModelVersion: 1.0.0
// entityRef: subscription
// scenarioRefs: [dunning-retry-succeeds, dunning-exhausted-cancels-subscription]
//
// Canonical condition:
//   AND [
//     status eq "past-due",
//     dunning-attempts lte 3,
//   ]
//
// Canonical action:
//   set dunning-attempts = dunning-attempts add 1
//
// IMPLEMENT THIS STUB in: src/rules/handle-dunning-retry.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Subscription } from '../interfaces/Subscription';

export type HandleDunningRetryFn = (subscription: Subscription) => Subscription;

// The implementation must satisfy these scenarios:
// ✓ dunning-retry-succeeds                   — status=past-due, dunning-attempts=1
// ✓ dunning-exhausted-cancels-subscription   — status=past-due, dunning-attempts=3
