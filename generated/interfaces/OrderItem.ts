// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: prevent-oversell
// canonicalModelVersion: 1.1.0
// entityRef: order-item

export interface OrderItem {
  readonly id: string; // uuid, immutable, system
  readonly orderId: string; // uuid, immutable, FK → Order
  readonly productId: string; // uuid, immutable, FK → Product
  quantity: number; // integer, validation: {min:1, max:9999}
  readonly unitPrice: number; // decimal, immutable, validation: {min:0, precision:2}
}

// Input type for creating an OrderItem (excludes system fields; immutable non-system fields are required)
export interface CreateOrderItemInput {
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

// Input type for updating an OrderItem (only mutable, non-system fields)
export interface UpdateOrderItemInput {
  quantity?: number;
}
