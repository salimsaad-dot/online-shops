import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireShop, shopOf } from '../../middleware/tenant';
import { query } from '../../middleware/validate';
import { productInclude, serializeProduct } from '../products/product.service';
import { publicShop } from '../shop/shop.serializer';

const router = Router();
router.use(requireShop);

router.get('/shop', (req, res) => {
  res.json({ shop: publicShop(shopOf(req)) });
});

router.get('/categories', async (req, res) => {
  const shop = shopOf(req);
  const categories = await prisma.category.findMany({
    where: { shopId: shop.id },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { products: { where: { isActive: true } } } },
      // Cover photo for the category tile: the newest in-stock product that has a photo
      products: {
        where: { isActive: true, stock: { gt: 0 }, images: { some: {} } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } } },
      },
    },
  });
  res.json({
    categories: categories.map(({ _count, products, ...c }) => ({
      ...c,
      productCount: _count.products,
      imageUrl: products[0]?.images[0]?.url ?? null,
    })),
  });
});

const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(90).optional(), // category slug
  // Comma-separated product ids (used by the cart to refresh prices/stock)
  ids: z
    .string()
    .regex(/^\d+(,\d+){0,99}$/)
    .transform((s) => s.split(',').map(Number))
    .optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'name']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

const sortMap: Record<z.infer<typeof listQuery>['sort'], Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
  name: { name: 'asc' },
};

router.get('/products', async (req, res) => {
  const shop = shopOf(req);
  const q = query(req, listQuery);
  const where: Prisma.ProductWhereInput = {
    shopId: shop.id,
    isActive: true,
    ...(q.category ? { category: { slug: q.category } } : {}),
    ...(q.ids ? { id: { in: q.ids } } : {}),
    ...(q.search
      ? { OR: [{ name: { contains: q.search } }, { description: { contains: q.search } }] }
      : {}),
  };
  // In-stock products come first, sold-out ones after them, each group in the chosen sort.
  // Paginate across the two groups as if they were one list.
  const inStock: Prisma.ProductWhereInput = { AND: [where, { stock: { gt: 0 } }] };
  const soldOut: Prisma.ProductWhereInput = { AND: [where, { stock: { lte: 0 } }] };
  const orderBy = [sortMap[q.sort], { id: 'desc' as const }];
  const skip = (q.page - 1) * q.limit;

  const [inStockCount, soldOutCount] = await Promise.all([
    prisma.product.count({ where: inStock }),
    prisma.product.count({ where: soldOut }),
  ]);
  const total = inStockCount + soldOutCount;
  const products = [];
  if (skip < inStockCount) {
    products.push(
      ...(await prisma.product.findMany({ where: inStock, include: productInclude, orderBy, skip, take: q.limit })),
    );
  }
  const remaining = q.limit - products.length;
  if (remaining > 0) {
    products.push(
      ...(await prisma.product.findMany({
        where: soldOut,
        include: productInclude,
        orderBy,
        skip: Math.max(0, skip - inStockCount),
        take: remaining,
      })),
    );
  }
  res.json({
    items: products.map(serializeProduct),
    total,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / q.limit)),
  });
});

router.get('/products/best-sellers', async (req, res) => {
  const shop = shopOf(req);
  const limit = 8;
  const grouped = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: { productId: { not: null }, order: { is: { shopId: shop.id, status: { not: 'CANCELLED' } } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit * 3, // over-fetch: some may be inactive, deleted or sold out
  });
  const ids = grouped.map((g) => g.productId!).filter(Boolean);
  const products = await prisma.product.findMany({
    // Sold-out items are left out — a best-sellers row of "Sold out" cards tells shoppers nothing is buyable
    where: { id: { in: ids }, shopId: shop.id, isActive: true, stock: { gt: 0 } },
    include: productInclude,
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = grouped
    .filter((g) => byId.has(g.productId!))
    .slice(0, limit)
    .map((g) => ({ ...serializeProduct(byId.get(g.productId!)!), totalSold: g._sum.quantity ?? 0 }));
  res.json({ items });
});

router.get('/products/:slug', async (req, res) => {
  const shop = shopOf(req);
  const product = await prisma.product.findFirst({
    where: { shopId: shop.id, slug: String(req.params.slug), isActive: true },
    include: productInclude,
  });
  if (!product) throw notFound('Product not found');

  const related = await prisma.product.findMany({
    where: {
      shopId: shop.id,
      isActive: true,
      id: { not: product.id },
      stock: { gt: 0 }, // only suggest things people can buy
      ...(product.categoryId ? { categoryId: product.categoryId } : {}),
    },
    include: productInclude,
    orderBy: { createdAt: 'desc' },
    take: 4,
  });
  res.json({ product: serializeProduct(product), related: related.map(serializeProduct) });
});

export default router;
