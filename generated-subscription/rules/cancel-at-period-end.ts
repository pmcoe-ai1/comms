// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.0.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: cancel-subscription
// canonicalModelVersion: 1.0.0
// entityRef: subscription
// scenarioRefs: [active-subscription-cancelled, trialing-subscription-cancelled, expired-subscription-cannot-be-cancelled]
//
// Canonical condition:
//   OR [
//     status eq "trialing",
//     status eq "active",
//   ]
//
// Canonical action:
//   set status = "cancelled"
//     set cancelled-at = {"$temporal":"now"}
//
// IMPLEMENT THIS STUB in: src/rules/cancel-at-period-end.ts
// Do not modify this file. Changes here will be overwritten by codegen.

import type { Subscription } from '../interfaces/Subscription';

export type CancelAtPeriodEndFn = (subscription: Subscription) => Subscription;

// The implementation must satisfy these scenarios:
// ✓ active-subscription-cancelled            — status=active
// ✓ trialing-subscription-cancelled          — status=trialing
// ✓ expired-subscription-cannot-be-cancelled  — status=expired
