// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: convert-trial-to-active
// canonicalModelVersion: 1.1.0
// entityRef: subscription
// scenarioRefs: [trial-converts-to-active, trial-not-converted-if-cancelled]
//
// Canonical condition:
//   AND [
//     status eq "trialing",
//     trial-ends-at lt {"$temporal":"now"},
//   ]
//
// Canonical action:
//   set status = "active"
//     emit-event subscription.trial-converted
//
// IMPLEMENT THIS STUB in: src/rules/convert-trial-on-renewal.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Subscription } from '../interfaces/Subscription';

export type ConvertTrialOnRenewalFn = (subscription: Subscription) => Subscription;

// The implementation must satisfy these scenarios:
// ✓ trial-converts-to-active                
// ✓ trial-not-converted-if-cancelled        
