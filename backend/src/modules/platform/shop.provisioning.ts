import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';

export interface CreateShopInput {
  name: string;
  slug: string;
  currency?: string;
  orderPrefix?: string;
  domains?: string[];
  owner: { name: string; email: string; password: string };
}

/** Creates a shop, its custom domains and its first OWNER account in one transaction. */
export async function createShopWithOwner(input: CreateShopInput) {
  const passwordHash = await bcrypt.hash(input.owner.password, 12);
  return prisma.$transaction(async (tx) => {
    const shop = await tx.shop.create({
      data: {
        name: input.name,
        slug: input.slug,
        currency: input.currency ?? 'GHS',
        orderPrefix: input.orderPrefix ?? 'ORD',
        domains: { create: (input.domains ?? []).map((host) => ({ host: host.toLowerCase() })) },
      },
      include: { domains: true },
    });
    const owner = await tx.user.create({
      data: {
        shopId: shop.id,
        role: 'OWNER',
        name: input.owner.name,
        email: input.owner.email.toLowerCase(),
        passwordHash,
      },
      select: { id: true, name: true, email: true, role: true },
    });
    return { shop, owner };
  });
}
