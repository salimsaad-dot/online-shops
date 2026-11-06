import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { badRequest, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireSuperAdmin } from '../../middleware/auth';
import { invalidateShopCache } from '../../middleware/tenant';
import { body, emailSchema, idParam, query } from '../../middleware/validate';
import { passwordSchema } from '../auth/auth.routes';
import { createShopWithOwner } from './shop.provisioning';

const router = Router();
router.use(requireSuperAdmin);

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/, 'Lowercase letters, digits and hyphens only')
  .refine((s) => !['www', 'app', 'api', 'admin', 'platform', 'mail'].includes(s), 'This slug is reserved');

const hostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{1,190}$)([a-z0-9-]+\.)+[a-z0-9-]+(:\d+)?$/, 'Enter a host like shop.com or www.shop.com');

router.get('/stats', async (_req, res) => {
  const [shops, activeShops, orders, revenue] = await Promise.all([
    prisma.shop.count(),
    prisma.shop.count({ where: { isActive: true } }),
    prisma.order.count({ where: { status: { not: 'CANCELLED' } } }),
    prisma.order.groupBy({ by: ['currency'], where: { status: { not: 'CANCELLED' } }, _sum: { total: true } }),
  ]);
  res.json({
    shops,
    activeShops,
    orders,
    revenueByCurrency: Object.fromEntries(revenue.map((r) => [r.currency, r._sum.total ?? 0])),
  });
});

router.get('/shops', async (req, res) => {
  const q = query(req, z.object({ search: z.string().trim().max(100).optional() }));
  const shops = await prisma.shop.findMany({
    where: q.search ? { OR: [{ name: { contains: q.search } }, { slug: { contains: q.search } }] } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      domains: { select: { id: true, host: true } },
      _count: { select: { products: true, orders: true, users: true } },
    },
  });
  res.json({
    shops: shops.map(({ _count, ...s }) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      isActive: s.isActive,
      currency: s.currency,
      domains: s.domains,
      counts: _count,
      createdAt: s.createdAt,
    })),
  });
});

router.get('/shops/:id', async (req, res) => {
  const shop = await prisma.shop.findUnique({
    where: { id: idParam(req) },
    include: {
      domains: { select: { id: true, host: true } },
      users: { select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true } },
      _count: { select: { products: true, orders: true, messages: true } },
    },
  });
  if (!shop) throw notFound('Shop not found');
  res.json({ shop });
});

router.post('/shops', async (req, res) => {
  const data = body(
    req,
    z.object({
      name: z.string().trim().min(1).max(120),
      slug: slugSchema,
      currency: z.string().length(3).toUpperCase().default('GHS'),
      orderPrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,10}$/).default('ORD'),
      domains: z.array(hostSchema).max(10).default([]),
      owner: z.object({ name: z.string().trim().min(1).max(120), email: emailSchema, password: passwordSchema }),
    }),
  );
  const result = await createShopWithOwner(data);
  invalidateShopCache();
  res.status(201).json(result);
});

router.put('/shops/:id', async (req, res) => {
  const data = body(
    req,
    z
      .object({
        name: z.string().trim().min(1).max(120),
        slug: slugSchema,
        isActive: z.boolean(),
        currency: z.string().length(3).toUpperCase(),
      })
      .partial(),
  );
  const shop = await prisma.shop.update({ where: { id: idParam(req) }, data });
  invalidateShopCache();
  res.json({ shop });
});

router.post('/shops/:id/domains', async (req, res) => {
  const { host } = body(req, z.object({ host: hostSchema }));
  const shopId = idParam(req);
  const domain = await prisma.shopDomain.create({ data: { host, shopId } });
  invalidateShopCache();
  res.status(201).json({ domain });
});

router.delete('/shops/:id/domains/:domainId', async (req, res) => {
  const { count } = await prisma.shopDomain.deleteMany({
    where: { id: idParam(req, 'domainId'), shopId: idParam(req) },
  });
  if (!count) throw notFound('Domain not found');
  invalidateShopCache();
  res.json({ ok: true });
});

// Add a user (e.g. a second owner) or reset a shop user's password
router.post('/shops/:id/users', async (req, res) => {
  const shopId = idParam(req);
  const data = body(
    req,
    z.object({
      name: z.string().trim().min(1).max(120),
      email: emailSchema,
      password: passwordSchema,
      role: z.enum(['OWNER', 'STAFF']).default('OWNER'),
    }),
  );
  if (!(await prisma.shop.findUnique({ where: { id: shopId } }))) throw notFound('Shop not found');
  const user = await prisma.user.create({
    data: { shopId, name: data.name, email: data.email, role: data.role, passwordHash: await bcrypt.hash(data.password, 12) },
    select: { id: true, name: true, email: true, role: true },
  });
  res.status(201).json({ user });
});

router.put('/shops/:id/users/:userId/password', async (req, res) => {
  const { password } = body(req, z.object({ password: passwordSchema }));
  const user = await prisma.user.findFirst({ where: { id: idParam(req, 'userId'), shopId: idParam(req) } });
  if (!user) throw notFound('User not found');
  if (user.role === 'SUPER_ADMIN') throw badRequest('Not a shop user');
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12), tokenVersion: { increment: 1 } },
  });
  res.json({ ok: true });
});

export default router;
