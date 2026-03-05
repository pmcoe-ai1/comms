// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.0.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: multiple
// canonicalModelVersion: 1.0.0
// entityRef: subscription

import type { SubscriptionStatus } from './enums';

export interface Subscription {
  readonly id: string; // uuid, immutable, system
  readonly customerId: string; // uuid, immutable, FK → Customer
  planId: string; // uuid, FK → Plan
  status: SubscriptionStatus; // enum
  trialEndsAt: Date | null; // datetime, nullable
  currentPeriodStart: Date; // datetime
  currentPeriodEnd: Date; // datetime
  readonly anchorDate: number; // integer, immutable, validation: {min:1, max:28}
  dunningAttempts: number; // integer, validation: {min:0, max:4}, default: 0
  cancelledAt: Date | null; // datetime, nullable
  readonly createdAt: Date; // datetime, immutable, system
  readonly updatedAt: Date; // datetime, system
}

// Input type for creating a Subscription (excludes system fields; immutable non-system fields are required)
export interface CreateSubscriptionInput {
  customerId: string;
  planId: string;
  trialEndsAt?: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  anchorDate: number;
  dunningAttempts?: number;
  cancelledAt?: Date | null;
  // status omitted — set by lifecycle initialState on creation
  // use transitionSubscriptionStatus() for all subsequent state changes
}

// Input type for updating a Subscription (only mutable, non-system fields)
// Note: status changes must use transitionSubscriptionStatus(), not this type directly.
export interface UpdateSubscriptionInput {
  planId?: string;
  trialEndsAt?: Date | null;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  dunningAttempts?: number;
  cancelledAt?: Date | null;
}

// Error class for invalid lifecycle transitions
export class InvalidLifecycleTransition extends Error {
  constructor(public readonly from: SubscriptionStatus, public readonly to: SubscriptionStatus) {
    super(`Invalid lifecycle transition: ${from} → ${to}`);
    this.name = 'InvalidLifecycleTransition';
  }
}

// Lifecycle transition function — enforces valid state transitions
// entityRef: subscription
export function transitionSubscriptionStatus(
  entity: Subscription,
  to: SubscriptionStatus
): Subscription {
  const validTransitions: Record<SubscriptionStatus, SubscriptionStatus[]> = {
    'trialing': ['active', 'cancelled'],
    'active': ['past-due', 'cancelled', 'active'],
    'past-due': ['active', 'cancelled'],
    'cancelled': ['active'],
    'expired': [],
  };
  const allowed = validTransitions[entity.status];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidLifecycleTransition(entity.status, to);
  }
  return { ...entity, status: to };
}
