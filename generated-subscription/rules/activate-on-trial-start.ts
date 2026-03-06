// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: activate-trial-subscription
// canonicalModelVersion: 1.1.0
// entityRef: subscription
// scenarioRefs: [subscription-created-in-trial, subscription-created-without-trial]
//
// Canonical condition:
//   plan-id is-not-null
//
// Canonical action:
//   set status = "trialing"
//     emit-event subscription.trial-started
//
// IMPLEMENT THIS STUB in: src/rules/activate-on-trial-start.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Subscription } from '../interfaces/Subscription';

export type ActivateOnTrialStartFn = (subscription: Subscription) => Subscription;

// The implementation must satisfy these scenarios:
// ✓ subscription-created-in-trial           
// ✓ subscription-created-without-trial      
