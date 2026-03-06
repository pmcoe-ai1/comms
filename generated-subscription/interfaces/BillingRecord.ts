// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: billing-record
// canonicalModelVersion: 1.1.0
// entityRef: billing-record

import type { BillingRecordType, BillingRecordStatus } from './enums';

export interface BillingRecord {
  readonly id: string; // uuid, immutable, system
  readonly subscriptionId: string; // uuid, immutable, FK → Subscription
  readonly type: BillingRecordType; // enum, immutable
  readonly amount: number; // decimal, immutable, validation: {min:0, max:99999.99}
  status: BillingRecordStatus; // enum
  readonly periodStart: Date; // datetime, immutable
  readonly periodEnd: Date; // datetime, immutable
  attemptNumber: number; // integer, validation: {min:1, max:3}
  readonly createdAt: Date; // datetime, immutable, system
}

// Input type for creating a BillingRecord (excludes system fields; immutable non-system fields are required)
export interface CreateBillingRecordInput {
  subscriptionId: string;
  type: BillingRecordType;
  amount: number;
  status: BillingRecordStatus;
  periodStart: Date;
  periodEnd: Date;
  attemptNumber: number;
}

// Input type for updating a BillingRecord (only mutable, non-system fields)
export interface UpdateBillingRecordInput {
  status?: BillingRecordStatus;
  attemptNumber?: number;
}
