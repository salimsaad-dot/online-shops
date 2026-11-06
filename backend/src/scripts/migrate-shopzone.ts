/**
 * Imports a ShopZone (old Express + MongoDB system) store into a shop on this platform.
 * Reads MongoDB only — never writes to it.
 *
 *   npm run migrate:shopzone -- --mongo-env ../../shopzone-main/backend/.env \
 *     --slug baabahanson --name "Baaba Hanson" --prefix ORD \
 *     --owner-email owner@baabahanson.com --owner-password "temp-pass-123" \
 *     [--domain baabahanson.com --domain www.baabahanson.com] [--dry-run] [--replace]
 *
 *   --mongo-uri <uri>    MongoDB connection string (or use --mongo-env <path to .env with MONGO_URI>)
 *   --dry-run            Print what would be imported; change nothing
 *   --replace            If the shop already has data, delete its products/categories/orders/messages first
 *
 * Mapping notes:
 *  - prices: major units (110 = GH₵110.00) → minor units (11000)
 *  - product images: `images[]` + `imagePublicIds[]` (newer ShopZone) or `image` + `imagePublicId` (older)
 *  - categories: free-text product.category → Category rows
 *  - orders keep their original orderNumber and dates; shop.nextOrderNumber continues after the highest
 *  - order items link to the new product when it still exists (else just the name/price snapshot)
 *  - completed orders get the completion status matching their delivery type (ShopZone mixed them up)
 *  - messages get a new random reference code (ShopZone had none)
 */
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { MongoClient, type Document, type ObjectId } from 'mongodb';
import type { OrderStatus } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';
import { randomCode, slugify } from '../lib/util';
import { createShopWithOwner } from '../modules/platform/shop.provisioning';

const toMinor = (n: unknown) => Math.round(Number(n ?? 0) * 100);
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const date = (v: unknown) => (v instanceof Date ? v : v ? new Date(String(v)) : new Date());

const STATUS: Record<string, OrderStatus> = {
  pending: 'PENDING',
  ready: 'READY',
  delivered: 'DELIVERED',
  pickedup: 'PICKED_UP',
  cancelled: 'CANCELLED',
};
const MSG_STATUS = { new: 'NEW', read: 'READ', replied: 'REPLIED' } as const;

function readMongoUri(values: { 'mongo-uri'?: string; 'mongo-env'?: string }): string {
  if (values['mongo-uri']) return values['mongo-uri'];
  if (values['mongo-env']) {
    const m = fs.readFileSync(values['mongo-env'], 'utf8').match(/^MONGO_URI=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('Provide --mongo-uri or --mongo-env <path to .env containing MONGO_URI>');
}

function productImages(p: Document): { url: string; publicId: string | null }[] {
  const urls: string[] = Array.isArray(p.images) && p.images.length ? p.images : p.image ? [p.image] : [];
  const ids: string[] = Array.isArray(p.imagePublicIds) ? p.imagePublicIds : p.imagePublicId ? [p.imagePublicId] : [];
  return urls
    .filter((u) => typeof u === 'string' && u.trim())
    .slice(0, 8)
    .map((url, i) => ({ url: url.trim().slice(0, 500), publicId: ids[i] ? String(ids[i]).slice(0, 200) : null }));
}

async function main() {
  const { values } = parseArgs({
    options: {
      'mongo-uri': { type: 'string' },
      'mongo-env': { type: 'string' },
      slug: { type: 'string' },
      name: { type: 'string' },
      prefix: { type: 'string', default: 'ORD' },
      domain: { type: 'string', multiple: true, default: [] },
      'owner-name': { type: 'string', default: 'Shop Owner' },
      'owner-email': { type: 'string' },
      'owner-password': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      replace: { type: 'boolean', default: false },
    },
  });
  if (!values.slug) throw new Error('--slug is required');
  const dryRun = values['dry-run'];

  // ── Read everything from MongoDB ──
  const mongo = new MongoClient(readMongoUri(values), { readPreference: 'secondaryPreferred', serverSelectionTimeoutMS: 20000 });
  await mongo.connect();
  const db = mongo.db();
  const [products, orders, messages, settingsDocs] = await Promise.all([
    db.collection('products').find().sort({ createdAt: 1 }).toArray(),
    db.collection('orders').find().sort({ createdAt: 1 }).toArray(),
    db.collection('messages').find().sort({ createdAt: 1 }).toArray(),
    db.collection('settings').find().limit(1).toArray(),
  ]);
  await mongo.close();
  const settings = settingsDocs[0] ?? {};
  const currency = str(settings.currencyCode || 'GHS', 3).toUpperCase();
  const categories = [...new Set(products.map((p) => str(p.category, 80)).filter(Boolean))];

  console.log(`MongoDB "${db.databaseName}": ${products.length} products, ${categories.length} categories, ${orders.length} orders, ${messages.length} messages`);
  console.log(`Settings: currency ${currency}, delivery ${settings.deliveryEnabled ? 'on' : 'off'} (fee ${settings.deliveryFee ?? 0}), pickup ${settings.pickupEnabled ? 'on' : 'off'}`);
  if (dryRun) {
    for (const p of products) console.log(`  product: ${p.name} — ${p.price} ${currency}, stock ${p.stock ?? 0}, ${productImages(p).length} image(s), [${p.category}]`);
    for (const o of orders) console.log(`  order: ${o.orderNumber} ${o.status} ${o.deliveryType} total ${o.total} (${(o.items ?? []).length} lines) ${date(o.createdAt).toISOString().slice(0, 10)}`);
    console.log('\nDry run — nothing written.');
    return;
  }

  // ── Find or create the shop ──
  let shop = await prisma.shop.findUnique({ where: { slug: values.slug } });
  if (!shop) {
    if (!values.name || !values['owner-email'] || !values['owner-password']) {
      throw new Error('Shop does not exist yet: --name, --owner-email and --owner-password are required');
    }
    ({ shop } = await createShopWithOwner({
      name: values.name,
      slug: values.slug,
      currency,
      orderPrefix: values.prefix.toUpperCase(),
      domains: values.domain,
      owner: { name: values['owner-name'], email: values['owner-email'], password: values['owner-password'] },
    }));
    console.log(`Created shop "${shop.name}" (#${shop.id}) with owner ${values['owner-email']}`);
  }
  const shopId = shop.id;

  const existing = await prisma.product.count({ where: { shopId } }) + (await prisma.order.count({ where: { shopId } }));
  if (existing && !values.replace) {
    throw new Error(`Shop "${shop.slug}" already has data. Re-run with --replace to wipe and re-import it.`);
  }

  await prisma.$transaction(
    async (tx) => {
      if (values.replace) {
        await tx.order.deleteMany({ where: { shopId } });
        await tx.message.deleteMany({ where: { shopId } });
        await tx.product.deleteMany({ where: { shopId } });
        await tx.category.deleteMany({ where: { shopId } });
      }

      // Settings
      await tx.shop.update({
        where: { id: shopId },
        data: {
          currency,
          deliveryEnabled: settings.deliveryEnabled ?? true,
          deliveryFee: toMinor(settings.deliveryFee),
          pickupEnabled: settings.pickupEnabled ?? true,
          ...(settings.deliveryEnabled === false && settings.pickupEnabled === false ? { pickupEnabled: true } : {}),
        },
      });

      // Categories
      const categoryIds = new Map<string, number>();
      for (const [position, name] of categories.entries()) {
        const c = await tx.category.create({ data: { shopId, name, slug: slugify(name), position } });
        categoryIds.set(name, c.id);
      }

      // Products
      const productIds = new Map<string, number>(); // mongo _id → new id
      const usedSlugs = new Set<string>();
      for (const p of products) {
        const name = str(p.name, 160) || 'Untitled product';
        let slug = slugify(name);
        for (let i = 2; usedSlugs.has(slug); i++) slug = `${slugify(name)}-${i}`;
        usedSlugs.add(slug);
        const created = await tx.product.create({
          data: {
            shopId,
            categoryId: categoryIds.get(str(p.category, 80)) ?? null,
            name,
            slug,
            description: String(p.description ?? ''),
            price: toMinor(p.price),
            stock: Math.max(0, Math.floor(Number(p.stock ?? 0))),
            createdAt: date(p.createdAt),
            images: { create: productImages(p).map((img, position) => ({ ...img, position })) },
          },
          include: { images: { take: 1, orderBy: { position: 'asc' } } },
        });
        productIds.set(String(p._id), created.id);
      }

      // Orders
      let maxNumber = 0;
      for (const o of orders) {
        const items = (o.items ?? []).map((it: Document) => {
          const unitPrice = toMinor(it.price);
          const quantity = Math.max(1, Math.floor(Number(it.quantity ?? 1)));
          return {
            productId: it.product ? productIds.get(String(it.product as ObjectId)) ?? null : null,
            name: str(it.name, 160) || 'Item',
            unitPrice,
            quantity,
            lineTotal: unitPrice * quantity,
          };
        });
        const subtotal = toMinor(o.subtotal);
        const deliveryFee = toMinor(o.deliveryFee);
        const orderNumber = str(o.orderNumber, 30) || `${values.prefix.toUpperCase()}-M${String(o._id).slice(-6)}`;
        const n = Number(/(\d+)$/.exec(orderNumber)?.[1] ?? 0);
        if (n > maxNumber) maxNumber = n;
        await tx.order.create({
          data: {
            shopId,
            orderNumber,
            customerName: str(o.customer?.name, 120),
            customerPhone: str(o.customer?.phone, 40) || 'unknown',
            deliveryType: o.deliveryType === 'delivery' ? 'DELIVERY' : 'PICKUP',
            deliveryAddress: str(o.deliveryAddress, 300),
            note: str(o.note, 1000),
            currency,
            subtotal,
            deliveryFee,
            total: toMinor(o.total) || subtotal + deliveryFee,
            // ShopZone didn't validate this: a completed order may say "pickedup" on a delivery
            // order (or vice versa). Normalise completed orders to match their delivery type.
            status: ((s: OrderStatus): OrderStatus =>
              s === 'DELIVERED' || s === 'PICKED_UP' ? (o.deliveryType === 'delivery' ? 'DELIVERED' : 'PICKED_UP') : s)(
              STATUS[String(o.status)] ?? 'PENDING',
            ),
            createdAt: date(o.createdAt),
            items: { create: items },
          },
        });
      }
      await tx.shop.update({ where: { id: shopId }, data: { nextOrderNumber: maxNumber + 1 } });

      // Messages
      for (const m of messages) {
        await tx.message.create({
          data: {
            shopId,
            reference: randomCode(8),
            name: str(m.name, 120) || 'Customer',
            phone: str(m.phone, 40) || 'unknown',
            email: str(m.email, 160) || null,
            orderNumber: str(m.orderNumber, 30) || null,
            body: String(m.message ?? ''),
            status: MSG_STATUS[String(m.status) as keyof typeof MSG_STATUS] ?? 'NEW',
            createdAt: date(m.createdAt),
            replies: {
              create: (m.replies ?? []).map((r: Document) => ({ body: String(r.text ?? ''), createdAt: date(r.sentAt) })),
            },
          },
        });
      }
      console.log(`Next new order number: ${shop.orderPrefix}-${String(maxNumber + 1).padStart(4, '0')}`);
    },
    { timeout: 120_000 },
  );

  // Verify
  const [p, c, o, m, linked] = await Promise.all([
    prisma.product.count({ where: { shopId } }),
    prisma.category.count({ where: { shopId } }),
    prisma.order.count({ where: { shopId } }),
    prisma.message.count({ where: { shopId } }),
    prisma.orderItem.count({ where: { order: { shopId }, productId: { not: null } } }),
  ]);
  console.log(`✅ Imported: ${p} products, ${c} categories, ${o} orders (${linked} order lines linked to products), ${m} messages`);
}

main()
  .catch((e) => {
    console.error('❌', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
