import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { imageUpload, uploadImage } from '../../lib/cloudinary';
import { badRequest, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireShopUser, userOf } from '../../middleware/auth';
import { invalidateShopCache, shopOf } from '../../middleware/tenant';
import { body, emailSchema, httpUrl, idParam } from '../../middleware/validate';
import { passwordSchema } from '../auth/auth.routes';
import { adminShop } from '../shop/shop.serializer';
import { LOW_STOCK } from './products.admin.routes';

const router = Router();
const ownerOnly = requireShopUser('OWNER');

// ─── Dashboard ───────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  const shop = shopOf(req);
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const notCancelled = { shopId: shop.id, status: { not: 'CANCELLED' as const } };

  const [productCount, lowStock, outOfStock, byStatus, revenueAll, revenue30, orders30, unreadMessages, recent] =
    await Promise.all([
      prisma.product.count({ where: { shopId: shop.id } }),
      prisma.product.count({ where: { shopId: shop.id, stock: { gt: 0, lte: LOW_STOCK } } }),
      prisma.product.count({ where: { shopId: shop.id, stock: { lte: 0 } } }),
      prisma.order.groupBy({ by: ['status'], where: { shopId: shop.id }, _count: { _all: true } }),
      prisma.order.aggregate({ where: notCancelled, _sum: { total: true } }),
      prisma.order.aggregate({ where: { ...notCancelled, createdAt: { gte: since30 } }, _sum: { total: true } }),
      prisma.order.count({ where: { ...notCancelled, createdAt: { gte: since30 } } }),
      prisma.message.count({ where: { shopId: shop.id, status: 'NEW' } }),
      prisma.order.findMany({
        where: { shopId: shop.id },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerPhone: true,
          total: true,
          status: true,
          deliveryType: true,
          createdAt: true,
        },
      }),
    ]);

  res.json({
    currency: shop.currency,
    products: { total: productCount, lowStock, outOfStock },
    orders: {
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      last30Days: orders30,
    },
    revenue: { allTime: revenueAll._sum.total ?? 0, last30Days: revenue30._sum.total ?? 0 },
    unreadMessages,
    recentOrders: recent,
  });
});

// ─── Settings (owner only) ───────────────────────────────────

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #4f46e5');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

const settingsSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    tagline: optionalText(200),
    logoUrl: z.union([httpUrl, z.literal('')]).transform((v) => v || null).nullable(),
    primaryColor: hexColor,
    contactPhone: optionalText(40),
    contactEmail: z.union([emailSchema, z.literal('')]).transform((v) => v || null).nullable(),
    whatsapp: optionalText(40),
    address: optionalText(300),
    currency: z.string().length(3).toUpperCase(),
    pickupEnabled: z.boolean(),
    pickupAddress: optionalText(300),
    deliveryEnabled: z.boolean(),
    deliveryFee: z.number().int().min(0).max(100_000_000),
    orderPrefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,10}$/, 'Letters and digits only, up to 10'),
  })
  .partial();

router.get('/settings', ownerOnly, (req, res) => {
  res.json({ shop: adminShop(shopOf(req)) });
});

router.put('/settings', ownerOnly, async (req, res) => {
  const data = body(req, settingsSchema);
  const current = shopOf(req);
  const pickup = data.pickupEnabled ?? current.pickupEnabled;
  const delivery = data.deliveryEnabled ?? current.deliveryEnabled;
  if (!pickup && !delivery) throw badRequest('Enable at least one of pickup or delivery');
  const shop = await prisma.shop.update({ where: { id: current.id }, data });
  invalidateShopCache();
  res.json({ shop: adminShop(shop) });
});

router.post('/settings/logo', ownerOnly, imageUpload.single('logo'), async (req, res) => {
  const current = shopOf(req);
  if (!req.file) throw badRequest('No logo uploaded');
  const { url } = await uploadImage(req.file.buffer, `${current.slug}/branding`);
  const shop = await prisma.shop.update({ where: { id: current.id }, data: { logoUrl: url } });
  invalidateShopCache();
  res.json({ shop: adminShop(shop) });
});

// ─── Staff (owner only) ──────────────────────────────────────

const staffSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

router.get('/staff', ownerOnly, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { shopId: shopOf(req).id },
    select: staffSelect,
    orderBy: { createdAt: 'asc' },
  });
  res.json({ users });
});

router.post('/staff', ownerOnly, async (req, res) => {
  const data = body(
    req,
    z.object({
      name: z.string().trim().min(1).max(120),
      email: emailSchema,
      password: passwordSchema,
      role: z.enum(['OWNER', 'STAFF']).default('STAFF'),
    }),
  );
  const user = await prisma.user.create({
    data: {
      shopId: shopOf(req).id,
      name: data.name,
      email: data.email,
      role: data.role,
      passwordHash: await bcrypt.hash(data.password, 12),
    },
    select: staffSelect,
  });
  res.status(201).json({ user });
});

router.put('/staff/:id', ownerOnly, async (req, res) => {
  const shop = shopOf(req);
  const id = idParam(req);
  if (id === userOf(req).id) throw badRequest('Use your profile page to change your own account');
  const data = body(
    req,
    z.object({
      name: z.string().trim().min(1).max(120).optional(),
      role: z.enum(['OWNER', 'STAFF']).optional(),
      isActive: z.boolean().optional(),
      password: passwordSchema.optional(),
    }),
  );
  const existing = await prisma.user.findFirst({ where: { id, shopId: shop.id } });
  if (!existing) throw notFound('User not found');
  const { password, ...rest } = data;
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      // Any security-relevant change signs the user out everywhere
      ...(password || rest.isActive === false || rest.role
        ? { tokenVersion: { increment: 1 } }
        : {}),
      ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
    },
    select: staffSelect,
  });
  res.json({ user });
});

router.delete('/staff/:id', ownerOnly, async (req, res) => {
  const id = idParam(req);
  if (id === userOf(req).id) throw badRequest('You cannot delete your own account');
  const { count } = await prisma.user.deleteMany({ where: { id, shopId: shopOf(req).id } });
  if (!count) throw notFound('User not found');
  res.json({ ok: true });
});

export default router;
