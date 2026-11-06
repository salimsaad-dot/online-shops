import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { randomCode, samePhone } from '../../lib/util';
import { limiter } from '../../middleware/security';
import { requireShop, shopOf } from '../../middleware/tenant';
import { body, emailSchema, phoneSchema, query } from '../../middleware/validate';

const router = Router();
router.use(requireShop);

const sendLimiter = limiter({
  windowMinutes: 10,
  limit: 10,
  message: 'Too many messages. Please wait a few minutes.',
});
const lookupLimiter = limiter({
  windowMinutes: 10,
  limit: 30,
  message: 'Too many attempts. Please wait a few minutes.',
});

export function serializeMessage(
  m: {
    id: number;
    reference: string;
    name: string;
    phone: string;
    email: string | null;
    orderNumber: string | null;
    body: string;
    status: string;
    createdAt: Date;
    replies: { id: number; body: string; createdAt: Date }[];
  },
) {
  return {
    id: m.id,
    reference: m.reference,
    name: m.name,
    phone: m.phone,
    email: m.email,
    orderNumber: m.orderNumber,
    body: m.body,
    status: m.status,
    createdAt: m.createdAt,
    replies: m.replies.map((r) => ({ id: r.id, body: r.body, createdAt: r.createdAt })),
  };
}

router.post('/', sendLimiter, async (req, res) => {
  const data = body(
    req,
    z.object({
      name: z.string().trim().min(1).max(120),
      phone: phoneSchema,
      email: z.union([emailSchema, z.literal('')]).optional(),
      orderNumber: z.string().trim().max(30).optional(),
      body: z.string().trim().min(1, 'Message is required').max(5000),
    }),
  );
  const message = await prisma.message.create({
    data: {
      shopId: shopOf(req).id,
      reference: randomCode(8),
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      orderNumber: data.orderNumber?.toUpperCase() || null,
      body: data.body,
    },
    include: { replies: true },
  });
  res.status(201).json({ message: serializeMessage(message) });
});

// Requires both the reference code (shown after sending) and the phone number.
router.get('/lookup', lookupLimiter, async (req, res) => {
  const q = query(req, z.object({ reference: z.string().trim().min(4).max(16), phone: phoneSchema }));
  const message = await prisma.message.findFirst({
    where: { shopId: shopOf(req).id, reference: q.reference.toUpperCase() },
    include: { replies: { orderBy: { createdAt: 'asc' } } },
  });
  if (!message || !samePhone(message.phone, q.phone)) {
    throw notFound('No message found with that reference and phone');
  }
  res.json({ message: serializeMessage(message) });
});

export default router;
