// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.0.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: product
// canonicalModelVersion: 1.0.0
// entityRef: product

export interface Product {
  readonly id: string; // uuid, immutable, system
  readonly sku: string; // string, immutable, unique, validation: {pattern:^[A-Z]{2,4}-[0-9]{4,8}$}
  name: string; // string, validation: {maxLength:255}
  price: number; // decimal, validation: {min:0, precision:2}
  stockLevel: number; // integer, validation: {min:0}, default: 0
  readonly createdAt: Date; // datetime, immutable, system
}

// Input type for creating a Product (excludes system fields; immutable non-system fields are required)
export interface CreateProductInput {
  sku: string;
  name: string;
  price: number;
  stockLevel?: number;
}

// Input type for updating a Product (only mutable, non-system fields)
export interface UpdateProductInput {
  name?: string;
  price?: number;
  stockLevel?: number;
}
