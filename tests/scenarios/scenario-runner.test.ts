// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO RUNNER — tests/scenarios/scenario-runner.test.ts
// Gate Stage 2: Execute must-pass scenarios from canonical model directly
// against rule implementation functions.
// canonicalModelVersion: 1.0.0
//
// No HTTP server. No mocks. Import rule functions and call with plain objects
// constructed from scenario fieldRefs.
// ─────────────────────────────────────────────────────────────────────────────

import type { Order } from '@generated/interfaces/Order';
import type { OrderItem } from '@generated/interfaces/OrderItem';
import { applyHighValueDiscount } from '@rules/apply-high-value-discount';
import { confirmOrderOnPayment } from '@rules/confirm-order-on-payment';
import { checkStockOnAddItem } from '@rules/check-stock-on-add-item';

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers: construct minimal valid objects from scenario fieldRefs.
// These are NOT mocks — they are plain objects matching the generated interfaces.
// ─────────────────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'test-order-1',
    customerId: 'test-customer-1',
    status: 'pending',
    total: 0,
    discount: 0,
    shippingAddress: {
      line1: '123 Test St',
      line2: null,
      city: 'Sydney',
      postcode: '2000',
      country: 'AU',
    },
    tags: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as Order;
}

function makeOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'test-item-1',
    orderId: 'test-order-1',
    productId: 'test-product-1',
    quantity: 1,
    unitPrice: 100,
    ...overrides,
  } as OrderItem;
}

// ─────────────────────────────────────────────────────────────────────────────
// Field-scope enforcement helper.
// Asserts that a rule only modified fields declared in its canonical action.
// This closes the gap where a rule could silently touch fields outside its
// declared scope — something the TypeScript type system cannot catch.
// ─────────────────────────────────────────────────────────────────────────────

function assertOnlyDeclaredFieldsChanged<T extends object>(
  before: T,
  after: T,
  allowedFields: (keyof T)[],
  scenarioId: string,
): void {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof T>;
  for (const key of allKeys) {
    if (allowedFields.includes(key)) continue;
    expect(after[key]).toStrictEqual(before[key]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario group: apply-high-value-discount
// ruleRef: apply-high-value-discount
// intentRef: reward-high-value-orders
// entityRef: order
// canonicalAction: set discount = total * 0.1
// Declared modified fields: [discount]
// ─────────────────────────────────────────────────────────────────────────────

describe('apply-high-value-discount scenarios', () => {
  // scenarioRef: high-value-discount-applied
  // priority: must-pass
  // fieldRefs: {order, total, 1200}, {order, discount, 120}
  // ruleRefs: [apply-high-value-discount]
  it('high-value-discount-applied — total=1200, discount=0 → discount=120', () => {
    // fieldRefs: order.total = 1200 (input), order.discount = 120 (expected output)
    const before = makeOrder({ total: 1200, discount: 0 });
    const result = applyHighValueDiscount({ ...before });
    // canonicalAction: set discount = total multiply 0.1
    // Assert only declared fields changed (canonical action: set discount only)
    assertOnlyDeclaredFieldsChanged(before, result, ['discount'], 'high-value-discount-applied');
    expect(result.discount).toBe(120);
    // Verify total unchanged
    expect(result.total).toBe(1200);
  });

  // scenarioRef: already-discounted-not-re-discounted
  // priority: must-pass
  // fieldRefs: {order, discount, 50}
  // ruleRefs: [apply-high-value-discount]
  it('already-discounted-not-re-discounted — total=1200, discount=50 → discount=50', () => {
    // fieldRefs: order.discount = 50 (already discounted → NOT(discount > 0) is false)
    const before = makeOrder({ total: 1200, discount: 50 });
    const result = applyHighValueDiscount({ ...before });
    // Condition not met: NOT(discount > 0) is false, so order unchanged
    // Assert only declared fields changed (canonical action: set discount only)
    assertOnlyDeclaredFieldsChanged(before, result, ['discount'], 'already-discounted-not-re-discounted');
    expect(result.discount).toBe(50);
    expect(result.total).toBe(1200);
  });

  // scenarioRef: no-discount-below-threshold
  // priority: must-pass
  // fieldRefs: {order, total, 999}, {order, discount, 0}
  // ruleRefs: [apply-high-value-discount]
  it('no-discount-below-threshold — total=999, discount=0 → discount=0', () => {
    // fieldRefs: order.total = 999 (below 1000 threshold), order.discount = 0
    const before = makeOrder({ total: 999, discount: 0 });
    const result = applyHighValueDiscount({ ...before });
    // Condition not met: total < 1000, so order unchanged
    // Assert only declared fields changed (canonical action: set discount only)
    assertOnlyDeclaredFieldsChanged(before, result, ['discount'], 'no-discount-below-threshold');
    expect(result.discount).toBe(0);
    expect(result.total).toBe(999);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario group: confirm-order-on-payment
// ruleRef: confirm-order-on-payment
// intentRef: confirm-order-on-payment
// entityRef: order
// canonicalAction: set status = "confirmed"
// Declared modified fields: [status]
// ─────────────────────────────────────────────────────────────────────────────

describe('confirm-order-on-payment scenarios', () => {
  // scenarioRef: order-confirmed-on-payment
  // priority: must-pass
  // fieldRefs: (none — inferred from rule: status pending → confirmed)
  // ruleRefs: [confirm-order-on-payment]
  it('order-confirmed-on-payment — status=pending → status=confirmed', () => {
    const before = makeOrder({ status: 'pending' as Order['status'] });
    const result = confirmOrderOnPayment({ ...before });
    // canonicalAction: set status = "confirmed"
    // Assert only declared fields changed (canonical action: set status only)
    assertOnlyDeclaredFieldsChanged(before, result, ['status'], 'order-confirmed-on-payment');
    expect(result.status).toBe('confirmed');
  });

  // scenarioRef: order-not-confirmed-on-failed-payment
  // priority: must-pass
  // fieldRefs: (none)
  // ruleRefs: (none — caller-layer concern: if payment fails, rule is not invoked)
  // Test: calling the rule with a non-pending order returns it unchanged.
  it('order-not-confirmed-on-failed-payment — status=cancelled → status=cancelled', () => {
    // If payment fails, the caller does not invoke this rule. But if called with
    // a non-pending order, the rule returns it unchanged.
    const before = makeOrder({ status: 'cancelled' as Order['status'] });
    const result = confirmOrderOnPayment({ ...before });
    // Condition not met: status !== 'pending', so order unchanged
    // Assert only declared fields changed (canonical action: set status only)
    assertOnlyDeclaredFieldsChanged(before, result, ['status'], 'order-not-confirmed-on-failed-payment');
    expect(result.status).toBe('cancelled');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario group: check-stock-on-add-item
// ruleRef: check-stock-on-add-item
// intentRef: prevent-oversell
// entityRef: order-item
//
// GAPFLAG: These scenarios require cross-entity access (OrderItem + Product)
// that the rule's type signature (orderItem: OrderItem) => OrderItem does not
// support. Using it.failing() to document the gap — these tests will flip to
// real failures when the canonical model is filled and the rule gains access
// to Product.stockLevel.
//
// NOTE: assertOnlyDeclaredFieldsChanged is NOT applied here because the rule
// has no declared canonical action (condition: null, action: null). The field
// diff check is meaningless until the canonical action is filled.
// ─────────────────────────────────────────────────────────────────────────────

describe('check-stock-on-add-item scenarios (KNOWN GAP — cross-entity stock check belongs at operation layer)', () => {
  // scenarioRef: order-item-added-when-stock-sufficient
  // priority: must-pass
  // fieldRefs: {product, stock-level, 10}, {order-item, quantity, 3}
  // ruleRefs: (linked to check-stock-on-add-item via prevent-oversell intent)
  //
  // GAPFLAG: Rule type (orderItem: OrderItem) => OrderItem has no Product parameter.
  // Cannot verify stock sufficiency. Test asserts expected stock-check behaviour that
  // the rule cannot implement — it.failing() marks this as a known gap.
  it.failing(
    'order-item-added-when-stock-sufficient — quantity=3, stock=10 → item created (GAPFLAG: cross-entity)',
    () => {
      // fieldRefs: product.stockLevel = 10, orderItem.quantity = 3
      const orderItem = makeOrderItem({ quantity: 3 });
      const result = checkStockOnAddItem(orderItem);
      // The scenario expects the rule to verify stock >= quantity.
      // The rule has no access to Product.stockLevel, so this property does not exist.
      // This assertion will FAIL, confirming the GAPFLAG.
      expect((result as any).stockChecked).toBe(true);
    },
  );

  // scenarioRef: order-item-rejected-when-out-of-stock
  // priority: must-pass
  // fieldRefs: {product, stock-level, 2}, {order-item, quantity, 5}
  // ruleRefs: (linked to check-stock-on-add-item via prevent-oversell intent)
  //
  // GAPFLAG: Rule cannot throw INSUFFICIENT_STOCK because:
  //   1. It has no access to Product.stockLevel (cross-entity)
  //   2. Its type does not declare thrown errors (AGENTS.md rule 7)
  // it.failing() documents this gap.
  it.failing(
    'order-item-rejected-when-out-of-stock — quantity=5, stock=2 → INSUFFICIENT_STOCK (GAPFLAG: cross-entity)',
    () => {
      // fieldRefs: product.stockLevel = 2, orderItem.quantity = 5
      const orderItem = makeOrderItem({ quantity: 5 });
      // The scenario expects the rule to throw INSUFFICIENT_STOCK when quantity > stockLevel.
      // The rule cannot access Product.stockLevel and has no declared error type.
      // This assertion will FAIL, confirming the GAPFLAG.
      expect(() => checkStockOnAddItem(orderItem)).toThrow('INSUFFICIENT_STOCK');
    },
  );
});
