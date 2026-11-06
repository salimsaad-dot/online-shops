import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { samePhone } from '../../lib/util';
import { limiter } from '../../middleware/security';
import { requireShop, shopOf } from '../../middleware/tenant';
import { body, emailSchema, phoneSchema, query } from '../../middleware/validate';
import { orderInclude, placeOrder, serializeOrder } from './order.service';

const router = Router();
router.use(requireShop);

const orderLimiter = limiter({
  windowMinutes: 10,
  limit: 20,
  message: 'Too many orders from this device. Please wait a few minutes.',
});
// Tracking reveals customer details, so guessing order numbers + phones must be slow.
const trackLimiter = limiter({
  windowMinutes: 10,
  limit: 30,
  message: 'Too many tracking attempts. Please wait a few minutes.',
});

const placeOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    phone: phoneSchema,
    email: z.union([emailSchema, z.literal('')]).optional(),
  }),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1, 'Your cart is empty')
    .max(100),
  deliveryType: z.enum(['PICKUP', 'DELIVERY']),
  deliveryAddress: z.string().trim().max(300).optional(),
  note: z.string().trim().max(1000).optional(),
});

router.post('/', orderLimiter, async (req, res) => {
  const input = body(req, placeOrderSchema);
  const order = await placeOrder(shopOf(req), input);
  res.status(201).json({ order: serializeOrder(order) });
});

// Customers track an order with order number + the phone used at checkout.
router.get('/track', trackLimiter, async (req, res) => {
  const q = query(req, z.object({ orderNumber: z.string().trim().min(1).max(30), phone: phoneSchema }));
  const order = await prisma.order.findFirst({
    where: { shopId: shopOf(req).id, orderNumber: q.orderNumber.toUpperCase() },
    include: orderInclude,
  });
  if (!order || !samePhone(order.customerPhone, q.phone)) {
    throw notFound('No order found with that number and phone');
  }
  res.json({ order: serializeOrder(order) });
});

export default router;
