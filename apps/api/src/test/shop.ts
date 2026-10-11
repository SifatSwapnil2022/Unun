import type {
  KitchenDetail,
  MenuItemDto,
  OrderCreated,
  OrderRequest,
  QuoteDto,
} from '@unun/core/contracts';
import type { Client } from './harness';

let phoneCounter = 0;

/** A different customer each time, so first-order rules do not leak between tests. */
export const freshPhone = () => `0181${String(2000000 + (phoneCounter += 1))}`;

export async function menuOf(api: Client, slug: string): Promise<MenuItemDto[]> {
  const { body } = await api.get<KitchenDetail>(`/v1/kitchens/${slug}`);
  return body.sections.flatMap((section) => section.items);
}

/** Gets a quote, the way the checkout page does, then places the order. */
export async function placeOrder(
  api: Client,
  options: { kitchen: string; area: string } & Partial<OrderRequest>,
): Promise<OrderCreated & { total: number }> {
  const [dish] = await menuOf(api, options.kitchen);
  if (!dish) throw new Error(`${options.kitchen} has an empty menu`);

  const request: OrderRequest = {
    lines: [{ itemId: dish.id, quantity: 2 }],
    customer: { name: 'Salma Khatun', phone: freshPhone() },
    address: 'House 14, Nazira Bazar Lane',
    paymentMethod: 'cash',
    expectedTotal: 0,
    ...options,
  };

  const quote = await api.post<QuoteDto>('/v1/quotes', {
    kitchen: request.kitchen,
    area: request.area,
    lines: request.lines,
    phone: request.customer.phone,
  });
  const total = quote.body.breakdown.total;

  const created = await api.post<OrderCreated>('/v1/orders', {
    ...request,
    expectedTotal: total,
  });
  if (created.status !== 201) {
    throw new Error(`The order was refused: ${JSON.stringify(created.body)}`);
  }
  return { ...created.body, total };
}
