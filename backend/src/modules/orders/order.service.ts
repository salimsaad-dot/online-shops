import type { OrderStatus, Prisma, Shop } from '../../generated/prisma/client';
import { badRequest, conflict } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

export interface PlaceOrderInput {
  customer: { name: string; phone: string; email?: string };
  items: { productId: number; quantity: number }[];
  deliveryType: 'PICKUP' | 'DELIVERY';
  deliveryAddress?: string;
  note?: string;
}

export const orderInclude = { items: true } satisfies Prisma.OrderInclude;
export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/**
 * Places an order atomically:
 *  - prices and names come from the DB, never the client
 *  - stock is decremented with a conditional update (no overselling under concurrency)
 *  - order number comes from the shop's own counter (row-locked by the UPDATE)
 */
export async function placeOrder(shop: Shop, input: PlaceOrderInput): Promise<OrderWithItems> {
  if (input.deliveryType === 'DELIVERY' && !shop.deliveryEnabled) throw badRequest('Delivery is not available');
  if (input.deliveryType === 'PICKUP' && !shop.pickupEnabled) throw badRequest('Pickup is not available');
  if (input.deliveryType === 'DELIVERY' && !input.deliveryAddress?.trim()) {
    throw badRequest('Delivery address is required');
  }

  // Merge duplicate lines for the same product
  const qtyById = new Map<number, number>();
  for (const it of input.items) qtyById.set(it.productId, (qtyById.get(it.productId) ?? 0) + it.quantity);

  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: [...qtyById.keys()] }, shopId: shop.id, isActive: true },
      include: { images: { orderBy: { position: 'asc' }, take: 1 } },
    });
    if (products.length !== qtyById.size) {
      throw conflict('Some items in your cart are no longer available. Please review your cart.');
    }

    const unavailable: { productId: number; name: string; available: number }[] = [];
    for (const p of products) {
      const qty = qtyById.get(p.id)!;
      const res = await tx.product.updateMany({
        where: { id: p.id, shopId: shop.id, stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      });
      if (res.count === 0) unavailable.push({ productId: p.id, name: p.name, available: p.stock });
    }
    if (unavailable.length) {
      throw conflict('Not enough stock for some items', { unavailable });
    }

    const counter = await tx.shop.update({
      where: { id: shop.id },
      data: { nextOrderNumber: { increment: 1 } },
      select: { nextOrderNumber: true, orderPrefix: true },
    });
    const orderNumber = `${counter.orderPrefix}-${String(counter.nextOrderNumber - 1).padStart(4, '0')}`;

    const items = products.map((p) => {
      const quantity = qtyById.get(p.id)!;
      return {
        productId: p.id,
        name: p.name,
        imageUrl: p.images[0]?.url ?? null,
        unitPrice: p.price,
        quantity,
        lineTotal: p.price * quantity,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const deliveryFee = input.deliveryType === 'DELIVERY' ? shop.deliveryFee : 0;

    return tx.order.create({
      data: {
        shopId: shop.id,
        orderNumber,
        customerName: input.customer.name,
        customerPhone: input.customer.phone,
        customerEmail: input.customer.email || null,
        deliveryType: input.deliveryType,
        deliveryAddress: input.deliveryType === 'DELIVERY' ? input.deliveryAddress!.trim() : '',
        note: input.note?.trim() ?? '',
        currency: shop.currency,
        subtotal,
        deliveryFee,
        total: subtotal + deliveryFee,
        items: { create: items },
      },
      include: orderInclude,
    });
  });
}

/** Allowed status transitions. CANCELLED is final (stock has been returned). */
const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['READY', 'DELIVERED', 'PICKED_UP', 'CANCELLED'],
  READY: ['PENDING', 'DELIVERED', 'PICKED_UP', 'CANCELLED'],
  DELIVERED: ['READY'],
  PICKED_UP: ['READY'],
  CANCELLED: [],
};

export async function updateOrderStatus(shopId: number, orderId: number, status: OrderStatus) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, shopId }, include: orderInclude });
    if (!order) return null;
    if (order.status === status) return order;
    if (!transitions[order.status].includes(status)) {
      throw badRequest(`Cannot change status from ${order.status} to ${status}`);
    }
    if (status === 'DELIVERED' && order.deliveryType !== 'DELIVERY') throw badRequest('This is a pickup order');
    if (status === 'PICKED_UP' && order.deliveryType !== 'PICKUP') throw badRequest('This is a delivery order');

    if (status === 'CANCELLED') {
      for (const item of order.items) {
        if (item.productId) {
          await tx.product.updateMany({
            where: { id: item.productId, shopId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
    }
    return tx.order.update({ where: { id: order.id }, data: { status }, include: orderInclude });
  });
}

export function serializeOrder(o: OrderWithItems) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    customer: { name: o.customerName, phone: o.customerPhone, email: o.customerEmail },
    deliveryType: o.deliveryType,
    deliveryAddress: o.deliveryAddress,
    note: o.note,
    currency: o.currency,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.name,
      imageUrl: i.imageUrl,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}
