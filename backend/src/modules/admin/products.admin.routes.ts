import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client';
import { deleteImage, imageUpload, uploadImage } from '../../lib/cloudinary';
import { badRequest, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { shopOf } from '../../middleware/tenant';
import { body, httpUrl, idParam, query } from '../../middleware/validate';
import {
  productInclude,
  serializeProduct,
  uniqueCategorySlug,
  uniqueProductSlug,
} from '../products/product.service';

const router = Router();

// ─── Categories ──────────────────────────────────────────────

router.get('/categories', async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { shopId: shopOf(req).id },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: true } } },
  });
  res.json({
    categories: categories.map(({ _count, ...c }) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      position: c.position,
      productCount: _count.products,
    })),
  });
});

const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  position: z.number().int().min(0).max(10000).optional(),
});

router.post('/categories', async (req, res) => {
  const shop = shopOf(req);
  const data = body(req, categorySchema);
  const category = await prisma.category.create({
    data: { ...data, shopId: shop.id, slug: await uniqueCategorySlug(shop.id, data.name) },
  });
  res.status(201).json({ category });
});

router.put('/categories/:id', async (req, res) => {
  const shop = shopOf(req);
  const id = idParam(req);
  const data = body(req, categorySchema.partial());
  const existing = await prisma.category.findFirst({ where: { id, shopId: shop.id } });
  if (!existing) throw notFound('Category not found');
  const category = await prisma.category.update({
    where: { id },
    data: {
      ...data,
      ...(data.name && data.name !== existing.name ? { slug: await uniqueCategorySlug(shop.id, data.name, id) } : {}),
    },
  });
  res.json({ category });
});

router.delete('/categories/:id', async (req, res) => {
  const { count } = await prisma.category.deleteMany({ where: { id: idParam(req), shopId: shopOf(req).id } });
  if (!count) throw notFound('Category not found');
  res.json({ ok: true }); // products keep existing with categoryId = null
});

// ─── Products ────────────────────────────────────────────────

const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  status: z.enum(['all', 'active', 'inactive', 'low_stock', 'out_of_stock']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const LOW_STOCK = 5;

router.get('/products', async (req, res) => {
  const shop = shopOf(req);
  const q = query(req, listQuery);
  const where: Prisma.ProductWhereInput = {
    shopId: shop.id,
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.search ? { name: { contains: q.search } } : {}),
    ...(q.status === 'active' ? { isActive: true } : {}),
    ...(q.status === 'inactive' ? { isActive: false } : {}),
    ...(q.status === 'low_stock' ? { stock: { gt: 0, lte: LOW_STOCK } } : {}),
    ...(q.status === 'out_of_stock' ? { stock: { lte: 0 } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ]);
  res.json({ items: items.map(serializeProduct), total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)) });
});

router.get('/products/:id', async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { id: idParam(req), shopId: shopOf(req).id },
    include: productInclude,
  });
  if (!product) throw notFound('Product not found');
  res.json({ product: serializeProduct(product) });
});

const productSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().max(20000).default(''),
  price: z.number().int().min(0).max(1_000_000_000), // minor units
  stock: z.number().int().min(0).max(1_000_000).default(0),
  isActive: z.boolean().default(true),
  categoryId: z.number().int().positive().nullable().optional(),
});

async function assertCategory(shopId: number, categoryId: number | null | undefined) {
  if (!categoryId) return;
  const c = await prisma.category.findFirst({ where: { id: categoryId, shopId } });
  if (!c) throw badRequest('Category does not exist');
}

router.post('/products', async (req, res) => {
  const shop = shopOf(req);
  const data = body(req, productSchema);
  await assertCategory(shop.id, data.categoryId);
  const product = await prisma.product.create({
    data: { ...data, shopId: shop.id, slug: await uniqueProductSlug(shop.id, data.name) },
    include: productInclude,
  });
  res.status(201).json({ product: serializeProduct(product) });
});

router.put('/products/:id', async (req, res) => {
  const shop = shopOf(req);
  const id = idParam(req);
  const data = body(req, productSchema.partial());
  const existing = await prisma.product.findFirst({ where: { id, shopId: shop.id } });
  if (!existing) throw notFound('Product not found');
  await assertCategory(shop.id, data.categoryId);
  const product = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      ...(data.name && data.name !== existing.name ? { slug: await uniqueProductSlug(shop.id, data.name, id) } : {}),
    },
    include: productInclude,
  });
  res.json({ product: serializeProduct(product) });
});

router.delete('/products/:id', async (req, res) => {
  const shop = shopOf(req);
  const product = await prisma.product.findFirst({
    where: { id: idParam(req), shopId: shop.id },
    include: { images: true },
  });
  if (!product) throw notFound('Product not found');
  await prisma.product.delete({ where: { id: product.id } }); // order items keep their snapshots
  await Promise.all(product.images.map((i) => deleteImage(i.publicId)));
  res.json({ ok: true });
});

// ─── Product images ──────────────────────────────────────────

const MAX_IMAGES = 8;

async function ownedProduct(shopId: number, productId: number) {
  const p = await prisma.product.findFirst({
    where: { id: productId, shopId },
    include: { _count: { select: { images: true } } },
  });
  if (!p) throw notFound('Product not found');
  return p;
}

// multipart/form-data with one or more "images" files
router.post('/products/:id/images', imageUpload.array('images', MAX_IMAGES), async (req, res) => {
  const shop = shopOf(req);
  const product = await ownedProduct(shop.id, idParam(req));
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) throw badRequest('No images uploaded');
  if (product._count.images + files.length > MAX_IMAGES) {
    throw badRequest(`A product can have at most ${MAX_IMAGES} images`);
  }
  const uploaded = await Promise.all(files.map((f) => uploadImage(f.buffer, shop.slug)));
  await prisma.productImage.createMany({
    data: uploaded.map((u, i) => ({
      productId: product.id,
      url: u.url,
      publicId: u.publicId,
      position: product._count.images + i,
    })),
  });
  const full = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, include: productInclude });
  res.status(201).json({ product: serializeProduct(full) });
});

// Add an image by external URL (used for migration/seeding or pasting a link)
router.post('/products/:id/images/url', async (req, res) => {
  const shop = shopOf(req);
  const product = await ownedProduct(shop.id, idParam(req));
  const { url } = body(req, z.object({ url: httpUrl }));
  if (product._count.images >= MAX_IMAGES) throw badRequest(`A product can have at most ${MAX_IMAGES} images`);
  await prisma.productImage.create({ data: { productId: product.id, url, position: product._count.images } });
  const full = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, include: productInclude });
  res.status(201).json({ product: serializeProduct(full) });
});

// Reorder: body { imageIds: [3, 1, 2] } — first is the main image
router.put('/products/:id/images/order', async (req, res) => {
  const shop = shopOf(req);
  const product = await ownedProduct(shop.id, idParam(req));
  const { imageIds } = body(req, z.object({ imageIds: z.array(z.number().int().positive()).max(MAX_IMAGES) }));
  const images = await prisma.productImage.findMany({ where: { productId: product.id } });
  const owned = new Set(images.map((i) => i.id));
  if (imageIds.length !== images.length || !imageIds.every((id) => owned.has(id))) {
    throw badRequest('imageIds must list every image of this product exactly once');
  }
  await prisma.$transaction(
    imageIds.map((id, position) => prisma.productImage.update({ where: { id }, data: { position } })),
  );
  const full = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, include: productInclude });
  res.json({ product: serializeProduct(full) });
});

router.delete('/products/:id/images/:imageId', async (req, res) => {
  const shop = shopOf(req);
  const product = await ownedProduct(shop.id, idParam(req));
  const image = await prisma.productImage.findFirst({
    where: { id: idParam(req, 'imageId'), productId: product.id },
  });
  if (!image) throw notFound('Image not found');
  await prisma.productImage.delete({ where: { id: image.id } });
  await deleteImage(image.publicId);
  const full = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, include: productInclude });
  res.json({ product: serializeProduct(full) });
});

export default router;
