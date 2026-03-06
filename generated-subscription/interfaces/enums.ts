// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

export type PlanInterval =
  | 'monthly'
  | 'annual';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past-due'
  | 'cancelled'
  | 'expired';

export type BillingRecordType =
  | 'charge'
  | 'refund'
  | 'credit';

export type BillingRecordStatus =
  | 'pending'
  | 'succeeded'
  | 'failed';
