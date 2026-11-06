/**
 * Seeds a local demo shop ("demo") with the ShopZone sample catalogue and a super admin.
 * Safe to re-run: skips anything that already exists.
 *   npm run db:seed
 *
 * Logins created (local development only):
 *   Platform:  admin@platform.local / admin12345   at http://localhost:3001/platform
 *   Demo shop: owner@demo.local     / owner12345   at http://demo.localhost:3001/admin
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { slugify } from '../lib/util';
import { createShopWithOwner } from '../modules/platform/shop.provisioning';
import demoProducts from './data/demo-products.json';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data in production');

  if (!(await prisma.user.findUnique({ where: { email: 'admin@platform.local' } }))) {
    await prisma.user.create({
      data: {
        email: 'admin@platform.local',
        name: 'Platform Admin',
        role: 'SUPER_ADMIN',
        passwordHash: await bcrypt.hash('admin12345', 12),
      },
    });
    console.log('✅ Super admin admin@platform.local / admin12345');
  }

  let shop = await prisma.shop.findUnique({ where: { slug: 'demo' } });
  if (!shop) {
    ({ shop } = await createShopWithOwner({
      name: 'Demo Store',
      slug: 'demo',
      currency: 'GHS',
      orderPrefix: 'DEMO',
      owner: { name: 'Demo Owner', email: 'owner@demo.local', password: 'owner12345' },
    }));
    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        tagline: 'Quality products, fast delivery, great prices.',
        contactPhone: '+233 20 000 0000',
        whatsapp: '+233200000000',
        address: 'Accra, Ghana',
        pickupAddress: 'Shop 12, Accra Mall',
        deliveryFee: 2000,
      },
    });
    console.log('✅ Shop "demo" with owner owner@demo.local / owner12345');
  }

  const existing = await prisma.product.count({ where: { shopId: shop.id } });
  if (existing > 0) {
    console.log(`ℹ️  Demo shop already has ${existing} products, skipping catalogue`);
    return;
  }

  const categoryNames = [...new Set(demoProducts.map((p) => p.category))];
  const categoryIds = new Map<string, number>();
  for (const [position, name] of categoryNames.entries()) {
    const c = await prisma.category.create({ data: { shopId: shop.id, name, slug: slugify(name), position } });
    categoryIds.set(name, c.id);
  }

  const usedSlugs = new Set<string>();
  for (const p of demoProducts) {
    let slug = slugify(p.name);
    for (let i = 2; usedSlugs.has(slug); i++) slug = `${slugify(p.name)}-${i}`;
    usedSlugs.add(slug);
    await prisma.product.create({
      data: {
        shopId: shop.id,
        categoryId: categoryIds.get(p.category),
        name: p.name,
        slug,
        description: p.description,
        price: p.price,
        stock: p.stock,
        images: p.image ? { create: [{ url: p.image, position: 0 }] } : undefined,
      },
    });
  }
  console.log(`✅ ${demoProducts.length} products in ${categoryNames.length} categories`);
}

main()
  .catch((e) => {
    console.error('❌', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
