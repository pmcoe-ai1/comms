import type { Order } from '@generated/interfaces/Order';
import type { OrderItem } from '@generated/interfaces/OrderItem';

describe('Generated types are importable', () => {
  it('Order interface is accessible', () => {
    const order: Partial<Order> = { total: 1000, discount: 0 };
    expect(order.total).toBe(1000);
  });

  it('OrderItem interface is accessible', () => {
    const item: Partial<OrderItem> = { quantity: 3 };
    expect(item.quantity).toBe(3);
  });
});
