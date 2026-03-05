// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.0.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: customer
// canonicalModelVersion: 1.0.0
// entityRef: customer

export interface Customer {
  readonly id: string; // uuid, immutable, system
  email: string; // string, unique
  paymentMethodId: string | null; // string, nullable
  readonly createdAt: Date; // datetime, immutable, system
}

// Input type for creating a Customer (excludes system fields; immutable non-system fields are required)
export interface CreateCustomerInput {
  email: string;
  paymentMethodId?: string | null;
}

// Input type for updating a Customer (only mutable, non-system fields)
export interface UpdateCustomerInput {
  email?: string;
  paymentMethodId?: string | null;
}
