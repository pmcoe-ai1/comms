// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: cancel-subscription
// canonicalModelVersion: 1.1.0
// entityRef: subscription
// scenarioRefs: [active-subscription-cancelled, trialing-subscription-cancelled, expired-subscription-cannot-be-cancelled]
//
// Canonical condition:

//
// Canonical action:
//   set status = "cancelled"
//
// IMPLEMENT THIS STUB in: src/rules/cancel-at-period-end.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Subscription } from '../interfaces/Subscription';

export type CancelAtPeriodEndFn = (subscription: Subscription) => Subscription;

// The implementation must satisfy these scenarios:
// ✓ active-subscription-cancelled           
// ✓ trialing-subscription-cancelled         
// ✓ expired-subscription-cannot-be-cancelled 
