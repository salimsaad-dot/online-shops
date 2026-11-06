import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { userOf } from '../../middleware/auth';
import { shopOf } from '../../middleware/tenant';
import { body, idParam, query } from '../../middleware/validate';
import { serializeMessage } from '../messages/messages.public.routes';

const router = Router();
const repliesInclude = { replies: { orderBy: { createdAt: 'asc' as const } } };

router.get('/messages', async (req, res) => {
  const shop = shopOf(req);
  const q = query(
    req,
    z.object({
      status: z.enum(['NEW', 'READ', 'REPLIED']).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    }),
  );
  const where = { shopId: shop.id, ...(q.status ? { status: q.status } : {}) };
  const [total, items, unread] = await Promise.all([
    prisma.message.count({ where }),
    prisma.message.findMany({
      where,
      include: repliesInclude,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.message.count({ where: { shopId: shop.id, status: 'NEW' } }),
  ]);
  res.json({
    items: items.map(serializeMessage),
    total,
    unread,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / q.limit)),
  });
});

async function owned(shopId: number, id: number) {
  const m = await prisma.message.findFirst({ where: { id, shopId } });
  if (!m) throw notFound('Message not found');
  return m;
}

router.patch('/messages/:id/read', async (req, res) => {
  const m = await owned(shopOf(req).id, idParam(req));
  const message = await prisma.message.update({
    where: { id: m.id },
    data: m.status === 'NEW' ? { status: 'READ' } : {},
    include: repliesInclude,
  });
  res.json({ message: serializeMessage(message) });
});

router.post('/messages/:id/reply', async (req, res) => {
  const m = await owned(shopOf(req).id, idParam(req));
  const { body: text } = body(req, z.object({ body: z.string().trim().min(1).max(5000) }));
  const message = await prisma.message.update({
    where: { id: m.id },
    data: { status: 'REPLIED', replies: { create: { body: text, userId: userOf(req).id } } },
    include: repliesInclude,
  });
  res.json({ message: serializeMessage(message) });
});

router.delete('/messages/:id', async (req, res) => {
  const m = await owned(shopOf(req).id, idParam(req));
  await prisma.message.delete({ where: { id: m.id } });
  res.json({ ok: true });
});

export default router;
