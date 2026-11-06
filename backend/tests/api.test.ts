/**
 * End-to-end API tests: storefront, ordering, messages, admin, auth, platform, tenant isolation
 * and the security fixes over ShopZone. Runs against the reset test DB with the demo seed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { client, DEMO, OWNER, PLATFORM, startServer, stopServer, SUPER } from './helpers';

beforeAll(startServer);
afterAll(async () => {
  await stopServer();
  await prisma.$disconnect();
});

const shopper = () => client(DEMO);
async function ownerClient() {
  const c = client(DEMO);
  expect((await c.login(OWNER.email, OWNER.password)).status).toBe(200);
  return c;
}
async function firstProduct(minStock = 1) {
  const r = await shopper().get('/products?limit=100');
  return r.data.items.find((p: any) => p.stock >= minStock);
}
const order = (productId: number, quantity = 1, extra: object = {}) => ({
  customer: { name: 'Ama', phone: '+233 24 111 2222' },
  items: [{ productId, quantity }],
  deliveryType: 'PICKUP',
  ...extra,
});

describe('storefront', () => {
  it('resolves the shop from the host and hides internal fields', async () => {
    const r = await shopper().get('/shop');
    expect(r.status).toBe(200);
    expect(r.data.shop.slug).toBe('demo');
    expect(r.data.shop).not.toHaveProperty('nextOrderNumber');
  });
  it('returns 404 for unknown hosts and for the platform host', async () => {
    expect((await client('nope.localhost:3001').get('/shop')).status).toBe(404);
    expect((await client(PLATFORM).get('/shop')).status).toBe(404);
  });
  it('lists, filters, searches and paginates products', async () => {
    const c = shopper();
    const r = await c.get('/products?limit=5&category=electronics');
    expect(r.data.items).toHaveLength(5);
    expect(r.data.items.every((p: any) => p.category.slug === 'electronics')).toBe(true);
    const s = await c.get('/products?search=watch');
    expect(s.data.items.some((p: any) => /watch/i.test(p.name))).toBe(true);
    const ids = r.data.items.slice(0, 2).map((p: any) => p.id);
    const byIds = await c.get(`/products?ids=${ids.join(',')}`);
    expect(byIds.data.items.map((p: any) => p.id).sort()).toEqual([...ids].sort());
    expect((await c.get('/products?ids=1,abc')).status).toBe(400);
  });
  it('lists in-stock products before sold-out ones, across pages', async () => {
    const owner = await ownerClient();
    const all = (await shopper().get('/products?limit=100&sort=name')).data.items;
    const victim = all[0]; // alphabetically first → would normally lead page 1
    await owner.put(`/admin/products/${victim.id}`, { stock: 0 });
    const page1 = await shopper().get('/products?limit=10&sort=name');
    expect(page1.data.items[0].id).not.toBe(victim.id);
    expect(page1.data.items.every((p: any) => p.stock > 0)).toBe(true);
    const last = await shopper().get(`/products?limit=10&sort=name&page=${page1.data.pages}`);
    expect(last.data.items.at(-1).stock).toBe(0);
    const ids = new Set<number>();
    for (let page = 1; page <= page1.data.pages; page++) {
      for (const p of (await shopper().get(`/products?limit=10&sort=name&page=${page}`)).data.items) ids.add(p.id);
    }
    expect(ids.size).toBe(page1.data.total); // no duplicates or gaps across the boundary
    await owner.put(`/admin/products/${victim.id}`, { stock: victim.stock });
  });
  it('leaves sold-out products out of best sellers', async () => {
    const owner = await ownerClient();
    const p = await firstProduct(3);
    const placed = await shopper().post('/orders', order(p.id, 2)); // makes p a best seller
    expect((await shopper().get('/products/best-sellers')).data.items.some((b: any) => b.id === p.id)).toBe(true);
    await owner.put(`/admin/products/${p.id}`, { stock: 0 });
    const r = await shopper().get('/products/best-sellers');
    expect(r.data.items.some((b: any) => b.id === p.id)).toBe(false);
    expect(r.data.items.every((b: any) => b.stock > 0)).toBe(true);
    await owner.patch(`/admin/orders/${placed.data.order.id}/status`, { status: 'CANCELLED' });
    await owner.put(`/admin/products/${p.id}`, { stock: p.stock });
  });
  it('serves a product by slug and 404s unknown slugs', async () => {
    const p = await firstProduct();
    const r = await shopper().get(`/products/${p.slug}`);
    expect(r.data.product.id).toBe(p.id);
    expect((await shopper().get('/products/does-not-exist')).status).toBe(404);
  });
});

describe('ordering (ShopZone bugs #2 #3 #4)', () => {
  it('takes prices from the database, never from the client', async () => {
    const p = await firstProduct();
    const r = await shopper().post('/orders', {
      ...order(p.id, 2, { deliveryType: 'DELIVERY', deliveryAddress: 'East Legon' }),
      items: [{ productId: p.id, quantity: 2, price: 1, unitPrice: 1 }],
      subtotal: 1,
      total: 1,
    });
    expect(r.status).toBe(201);
    expect(r.data.order.subtotal).toBe(p.price * 2);
    expect(r.data.order.deliveryFee).toBe(2000);
    expect(r.data.order.total).toBe(p.price * 2 + 2000);
    expect(r.data.order.orderNumber).toMatch(/^DEMO-\d{4}$/);
  });
  it('decrements stock, rejects overselling and restores stock on cancel', async () => {
    const p = await firstProduct(3);
    const owner = await ownerClient();
    const placed = await shopper().post('/orders', order(p.id, 2));
    expect((await shopper().get(`/products/${p.slug}`)).data.product.stock).toBe(p.stock - 2);
    const over = await shopper().post('/orders', order(p.id, 999));
    expect(over.status).toBe(409);
    expect(over.data.details.unavailable[0].productId).toBe(p.id);
    await owner.patch(`/admin/orders/${placed.data.order.id}/status`, { status: 'CANCELLED' });
    expect((await shopper().get(`/products/${p.slug}`)).data.product.stock).toBe(p.stock);
  });
  it('never oversells under concurrency and numbers orders uniquely', async () => {
    const p = await firstProduct(3);
    const owner = await ownerClient();
    await owner.put(`/admin/products/${p.id}`, { stock: 3 });
    const results = await Promise.all(Array.from({ length: 6 }, () => shopper().post('/orders', order(p.id, 1))));
    const ok = results.filter((r) => r.status === 201);
    expect(ok).toHaveLength(3);
    expect(new Set(ok.map((r) => r.data.order.orderNumber)).size).toBe(3);
    expect((await shopper().get(`/products/${p.slug}`)).data.product.stock).toBe(0);
  });
  it('validates delivery choices', async () => {
    const p = await firstProduct();
    expect((await shopper().post('/orders', order(p.id, 1, { deliveryType: 'DELIVERY' }))).status).toBe(400);
    expect((await shopper().post('/orders', { ...order(p.id), items: [] })).status).toBe(400);
  });
  it('tracks an order only with the matching phone (any format)', async () => {
    const p = await firstProduct();
    const { data } = await shopper().post('/orders', order(p.id));
    const num = data.order.orderNumber;
    expect((await shopper().get(`/orders/track?orderNumber=${num}&phone=0241112222`)).status).toBe(200);
    expect((await shopper().get(`/orders/track?orderNumber=${num.toLowerCase()}&phone=%2B233241112222`)).status).toBe(200);
    expect((await shopper().get(`/orders/track?orderNumber=${num}&phone=0209999999`)).status).toBe(404);
  });
});

describe('messages (ShopZone bug #5)', () => {
  it('needs both reference and phone to read replies', async () => {
    const sent = await shopper().post('/messages', { name: 'Kofi', phone: '0201234567', body: 'Where is my order?' });
    expect(sent.status).toBe(201);
    const ref = sent.data.message.reference;
    expect(ref).toMatch(/^[A-Z2-9]{8}$/);
    expect((await shopper().get('/messages/lookup?phone=0201234567&reference=WRONG234')).status).toBe(404);
    expect((await shopper().get(`/messages/lookup?phone=0551234000&reference=${ref}`)).status).toBe(404);

    const owner = await ownerClient();
    const list = await owner.get('/admin/messages');
    const msg = list.data.items.find((m: any) => m.reference === ref);
    expect(list.data.unread).toBeGreaterThan(0);
    await owner.post(`/admin/messages/${msg.id}/reply`, { body: 'On the way!' });
    const seen = await shopper().get(`/messages/lookup?phone=%2B233201234567&reference=${ref.toLowerCase()}`);
    expect(seen.data.message.status).toBe('REPLIED');
    expect(seen.data.message.replies[0].body).toBe('On the way!');
  });
});

describe('shop admin', () => {
  it('requires a signed-in member of the shop', async () => {
    expect((await shopper().get('/admin/orders')).status).toBe(401);
  });
  it('enforces order status rules', async () => {
    const p = await firstProduct();
    const owner = await ownerClient();
    const { data } = await shopper().post('/orders', order(p.id, 1, { deliveryType: 'DELIVERY', deliveryAddress: 'Osu' }));
    const id = data.order.id;
    expect((await owner.patch(`/admin/orders/${id}/status`, { status: 'PICKED_UP' })).status).toBe(400);
    expect((await owner.patch(`/admin/orders/${id}/status`, { status: 'DELIVERED' })).status).toBe(200);
    expect((await owner.patch(`/admin/orders/${id}/status`, { status: 'CANCELLED' })).status).toBe(400);
  });
  it('manages products and categories with validation', async () => {
    const owner = await ownerClient();
    const cat = await owner.post('/admin/categories', { name: 'Test Cat' });
    expect(cat.status).toBe(201);
    const created = await owner.post('/admin/products', { name: 'Test Item', price: 1250, stock: 4, categoryId: cat.data.category.id });
    expect(created.status).toBe(201);
    expect(created.data.product.slug).toBe('test-item');
    const dup = await owner.post('/admin/products', { name: 'Test Item', price: 100 });
    expect(dup.data.product.slug).toBe('test-item-2');
    expect((await owner.post('/admin/products', { name: 'Bad', price: 12.5 })).status).toBe(400);
    expect((await owner.post('/admin/products', { name: 'Bad', price: 100, categoryId: 999999 })).status).toBe(400);
    const pid = created.data.product.id;
    expect((await owner.post(`/admin/products/${pid}/images/url`, { url: 'javascript:alert(1)' })).status).toBe(400);
    const img = await owner.post(`/admin/products/${pid}/images/url`, { url: 'https://example.com/a.jpg' });
    expect(img.data.product.images).toHaveLength(1);
    expect((await owner.post(`/admin/products/${pid}/images`)).status).toBe(400); // no files
    expect((await owner.del(`/admin/products/${pid}`)).status).toBe(200);
    expect((await owner.del(`/admin/products/${dup.data.product.id}`)).status).toBe(200);
  });
  it('validates and whitelists settings (ShopZone bug #8)', async () => {
    const owner = await ownerClient();
    expect((await owner.put('/admin/settings', { deliveryFee: 'free' })).status).toBe(400);
    expect((await owner.put('/admin/settings', { logoUrl: 'javascript:alert(1)' })).status).toBe(400);
    expect((await owner.put('/admin/settings', { pickupEnabled: false, deliveryEnabled: false })).status).toBe(400);
    const ok = await owner.put('/admin/settings', { deliveryFee: 2500, nextOrderNumber: 1, isActive: false });
    expect(ok.data.shop.deliveryFee).toBe(2500);
    expect(ok.data.shop.isActive).toBe(true);
    await owner.put('/admin/settings', { deliveryFee: 2000 });
  });
  it('lets only owners manage settings and staff', async () => {
    const owner = await ownerClient();
    const staff = await owner.post('/admin/staff', { name: 'Sam', email: 'sam@demo.local', password: 'sampass123' });
    expect(staff.status).toBe(201);
    const sam = client(DEMO);
    expect((await sam.login('sam@demo.local', 'sampass123')).status).toBe(200);
    expect((await sam.get('/admin/orders')).status).toBe(200);
    expect((await sam.get('/admin/settings')).status).toBe(403);
    expect((await sam.get('/admin/staff')).status).toBe(403);
    // disabling signs the user out immediately
    await owner.put(`/admin/staff/${staff.data.user.id}`, { isActive: false });
    expect((await sam.get('/admin/orders')).status).toBe(401);
    expect((await owner.del(`/admin/staff/${staff.data.user.id}`)).status).toBe(200);
  });
});

describe('auth (ShopZone bugs #1 #6)', () => {
  it('changes password, signs out other sessions, keeps the current one', async () => {
    const a = await ownerClient();
    const b = await ownerClient();
    expect((await a.put('/auth/password', { currentPassword: 'wrong', newPassword: 'newpass123' })).status).toBe(400);
    expect((await a.put('/auth/password', { currentPassword: OWNER.password, newPassword: 'newpass123' })).status).toBe(200);
    expect((await b.get('/auth/me')).status).toBe(401);
    expect((await a.get('/auth/me')).status).toBe(200);
    await a.put('/auth/password', { currentPassword: 'newpass123', newPassword: OWNER.password });
  });
  it('has no open setup route', async () => {
    expect((await client(PLATFORM).post('/auth/setup', { username: 'x', password: 'y' })).status).toBe(404);
  });
  it('logs out', async () => {
    const a = await ownerClient();
    await a.post('/auth/logout');
    expect((await a.get('/auth/me')).status).toBe(401);
  });
});

describe('platform and tenant isolation', () => {
  let other: ReturnType<typeof client>;
  let demoOrderId: number;
  let demoProduct: any;

  beforeAll(async () => {
    const platform = client(PLATFORM);
    await platform.login(SUPER.email, SUPER.password);
    const r = await platform.post('/platform/shops', {
      name: 'Other Shop',
      slug: 'othershop',
      domains: ['othershop.example.com'],
      owner: { name: 'O', email: 'owner@other.local', password: 'otherpass123' },
    });
    expect(r.status).toBe(201);
    other = client('othershop.example.com');
    demoProduct = await firstProduct();
    demoOrderId = (await shopper().post('/orders', order(demoProduct.id))).data.order.id;
  });

  it('scopes logins to the right host', async () => {
    expect((await client(PLATFORM).login(OWNER.email, OWNER.password)).status).toBe(401);
    expect((await client(DEMO).login(SUPER.email, SUPER.password)).status).toBe(401);
    expect((await client(DEMO).login('owner@other.local', 'otherpass123')).status).toBe(401);
    expect((await other.login('owner@other.local', 'otherpass123')).status).toBe(200);
  });
  it('resolves custom domains and keeps catalogues apart', async () => {
    expect((await other.get('/shop')).data.shop.slug).toBe('othershop');
    expect((await other.get(`/products/${demoProduct.slug}`)).status).toBe(404);
    expect((await other.post('/orders', order(demoProduct.id))).status).toBe(409);
  });
  it("keeps one shop's admin out of another's data", async () => {
    expect((await other.get(`/admin/orders/${demoOrderId}`)).status).toBe(404);
    expect((await other.patch(`/admin/orders/${demoOrderId}/status`, { status: 'CANCELLED' })).status).toBe(404);
    expect((await other.put(`/admin/products/${demoProduct.id}`, { price: 1 })).status).toBe(404);
    expect((await other.del(`/admin/products/${demoProduct.id}`)).status).toBe(404);
    const otherOrders = await other.get('/admin/orders');
    expect(otherOrders.data.total).toBe(0);
  });
  it('blocks shop users from the platform API', async () => {
    const owner = await ownerClient();
    expect((await owner.get('/platform/shops')).status).toBe(403);
  });
  it('rejects duplicate slugs and reserved names', async () => {
    const platform = client(PLATFORM);
    await platform.login(SUPER.email, SUPER.password);
    const dup = await platform.post('/platform/shops', { name: 'Dup', slug: 'othershop', owner: { name: 'x', email: 'x@x.local', password: 'xxxxxxxx' } });
    expect(dup.status).toBe(409);
    const reserved = await platform.post('/platform/shops', { name: 'Admin', slug: 'admin', owner: { name: 'x', email: 'y@x.local', password: 'xxxxxxxx' } });
    expect(reserved.status).toBe(400);
  });
  it('takes a deactivated shop offline, including its admin', async () => {
    const platform = client(PLATFORM);
    await platform.login(SUPER.email, SUPER.password);
    const shop = await prisma.shop.findUniqueOrThrow({ where: { slug: 'othershop' } });
    await platform.put(`/platform/shops/${shop.id}`, { isActive: false });
    expect((await other.get('/shop')).status).toBe(404);
    expect((await other.get('/admin/orders')).status).toBe(404);
  });
});

describe('request security', () => {
  it('blocks cross-site state-changing requests', async () => {
    const evil = client(DEMO, { origin: 'https://evil.example' });
    expect((await evil.post('/auth/login', OWNER)).status).toBe(403);
    const same = client(DEMO, { origin: `http://${DEMO}` });
    expect((await same.post('/auth/login', OWNER)).status).toBe(200);
  });
  it('only trusts the forwarded client IP with the proxy secret', async () => {
    const { clientIp } = await import('../src/middleware/security');
    const fake = (headers: Record<string, string>) =>
      ({ ip: '10.0.0.1', get: (h: string) => headers[h.toLowerCase()] }) as any;
    expect(clientIp(fake({ 'x-client-ip': '1.2.3.4' }))).toBe('10.0.0.1');
    expect(clientIp(fake({ 'x-client-ip': '1.2.3.4', 'x-internal-proxy-secret': 'wrong-secret-0123456789abcdef' }))).toBe('10.0.0.1');
    expect(clientIp(fake({ 'x-client-ip': '1.2.3.4', 'x-internal-proxy-secret': 'test-proxy-secret-0123456789abcdef' }))).toBe('1.2.3.4');
  });
  it('returns generic 500s and JSON 404s', async () => {
    const r = await shopper().get('/no-such-route');
    expect(r.status).toBe(404);
    expect(r.data.message).toBeTruthy();
  });
});
