import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { slugify } from '../../lib/util';

export const productInclude = {
  images: { orderBy: { position: 'asc' } },
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export function serializeProduct(p: ProductWithRelations) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    stock: p.stock,
    isActive: p.isActive,
    category: p.category,
    images: p.images.map((i) => ({ id: i.id, url: i.url, position: i.position })),
    imageUrl: p.images[0]?.url ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Returns a slug unique within the shop (appends -2, -3 ... on collision). */
export async function uniqueProductSlug(shopId: number, name: string, excludeId?: number): Promise<string> {
  const base = slugify(name);
  const taken = await prisma.product.findMany({
    where: { shopId, slug: { startsWith: base }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { slug: true },
  });
  const set = new Set(taken.map((t) => t.slug));
  if (!set.has(base)) return base;
  for (let i = 2; ; i++) if (!set.has(`${base}-${i}`)) return `${base}-${i}`;
}

export async function uniqueCategorySlug(shopId: number, name: string, excludeId?: number): Promise<string> {
  const base = slugify(name);
  const taken = await prisma.category.findMany({
    where: { shopId, slug: { startsWith: base }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { slug: true },
  });
  const set = new Set(taken.map((t) => t.slug));
  if (!set.has(base)) return base;
  for (let i = 2; ; i++) if (!set.has(`${base}-${i}`)) return `${base}-${i}`;
}
