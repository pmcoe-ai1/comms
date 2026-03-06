// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// intentRef: multiple
// canonicalModelVersion: 1.1.0
// entityRef: order

import type { OrderStatus } from './enums';

export interface Order {
  readonly id: string; // uuid, immutable, system
  readonly customerId: string; // uuid, immutable, FK → Customer
  status: OrderStatus; // enum, default: "pending"
  total: number; // decimal, validation: {min:0, max:999999.99, precision:2}
  discount: number; // decimal, validation: {min:0, max:999999.99, precision:2}, default: 0
  shippingAddress: OrderShippingAddress; // object
  tags: string[]; // array, default: []
  readonly createdAt: Date; // datetime, immutable, system
  readonly updatedAt: Date; // datetime, system
}

// Embedded object type for Order.shippingAddress
export interface OrderShippingAddress {
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  country: string;
}

// Input type for creating a Order (excludes system fields; immutable non-system fields are required)
export interface CreateOrderInput {
  customerId: string;
  total: number;
  discount?: number;
  shippingAddress?: OrderShippingAddress;
  tags?: string[];
  // status omitted — set by lifecycle initialState on creation
  // use transitionOrderStatus() for all subsequent state changes
}

// Input type for updating a Order (only mutable, non-system fields)
// Note: status changes must use transitionOrderStatus(), not this type directly.
export interface UpdateOrderInput {
  total?: number;
  discount?: number;
  shippingAddress?: OrderShippingAddress;
  tags?: string[];
}

// Error class for invalid lifecycle transitions
export class InvalidLifecycleTransition extends Error {
  constructor(public readonly from: OrderStatus, public readonly to: OrderStatus) {
    super(`Invalid lifecycle transition: ${from} → ${to}`);
    this.name = 'InvalidLifecycleTransition';
  }
}

// Lifecycle transition function — enforces valid state transitions
// entityRef: order
export function transitionOrderStatus(
  entity: Order,
  to: OrderStatus
): Order {
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['processing', 'refunded'],
    'processing': ['shipped'],
    'shipped': ['delivered', 'refunded'],
    'delivered': ['refunded'],
    'cancelled': [], // terminal
    'refunded': [], // terminal
  };
  const allowed = validTransitions[entity.status];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidLifecycleTransition(entity.status, to);
  }
  return { ...entity, status: to };
}
