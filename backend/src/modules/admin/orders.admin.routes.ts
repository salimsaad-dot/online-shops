import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { shopOf } from '../../middleware/tenant';
import { body, idParam, query } from '../../middleware/validate';
import { orderInclude, serializeOrder, updateOrderStatus } from '../orders/order.service';

const router = Router();

const statusEnum = z.enum(['PENDING', 'READY', 'DELIVERED', 'PICKED_UP', 'CANCELLED']);

router.get('/orders', async (req, res) => {
  const shop = shopOf(req);
  const q = query(
    req,
    z.object({
      status: statusEnum.optional(),
      deliveryType: z.enum(['PICKUP', 'DELIVERY']).optional(),
      search: z.string().trim().max(100).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    }),
  );
  const where: Prisma.OrderWhereInput = {
    shopId: shop.id,
    ...(q.status ? { status: q.status } : {}),
    ...(q.deliveryType ? { deliveryType: q.deliveryType } : {}),
    ...(q.search
      ? {
          OR: [
            { orderNumber: { contains: q.search } },
            { customerPhone: { contains: q.search } },
            { customerName: { contains: q.search } },
          ],
        }
      : {}),
  };
  const [total, orders, counts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.order.groupBy({ by: ['status'], where: { shopId: shop.id }, _count: { _all: true } }),
  ]);
  res.json({
    items: orders.map(serializeOrder),
    total,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / q.limit)),
    statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  });
});

router.get('/orders/:id', async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: idParam(req), shopId: shopOf(req).id },
    include: orderInclude,
  });
  if (!order) throw notFound('Order not found');
  res.json({ order: serializeOrder(order) });
});

router.patch('/orders/:id/status', async (req, res) => {
  const { status } = body(req, z.object({ status: statusEnum }));
  const order = await updateOrderStatus(shopOf(req).id, idParam(req), status);
  if (!order) throw notFound('Order not found');
  res.json({ order: serializeOrder(order) });
});

export default router;
