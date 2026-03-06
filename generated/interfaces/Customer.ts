// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: customer
// canonicalModelVersion: 1.1.0
// entityRef: customer

export interface Customer {
  readonly id: string; // uuid, immutable, system
  email: string; // string, unique, validation: {maxLength:255, pattern:^[^@]+@[^@]+\.[^@]+$}
  readonly createdAt: Date; // datetime, immutable, system
}

// Input type for creating a Customer (excludes system fields; immutable non-system fields are required)
export interface CreateCustomerInput {
  email: string;
}

// Input type for updating a Customer (only mutable, non-system fields)
export interface UpdateCustomerInput {
  email?: string;
}
