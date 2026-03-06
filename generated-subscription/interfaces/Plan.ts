// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: activate-trial-subscription
// canonicalModelVersion: 1.1.0
// entityRef: plan

import type { PlanInterval } from './enums';

export interface Plan {
  readonly id: string; // uuid, immutable, system
  name: string; // string
  price: number; // decimal, validation: {min:0, max:99999.99}
  interval: PlanInterval; // enum
  trialDays: number; // integer, validation: {min:0, max:90}
  isActive: boolean; // boolean
  readonly createdAt: Date; // datetime, immutable, system
}

// Input type for creating a Plan (excludes system fields; immutable non-system fields are required)
export interface CreatePlanInput {
  name: string;
  price: number;
  interval: PlanInterval;
  trialDays?: number;
  isActive: boolean;
}

// Input type for updating a Plan (only mutable, non-system fields)
export interface UpdatePlanInput {
  name?: string;
  price?: number;
  interval?: PlanInterval;
  trialDays?: number;
  isActive?: boolean;
}
