import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { Shop } from '../generated/prisma/client';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      shop?: Shop;
    }
  }
}

// Small in-memory cache so every request doesn't hit the DB for the shop row.
const TTL_MS = 30_000;
const cache = new Map<string, { shop: Shop | null; expires: number }>();

export function invalidateShopCache() {
  cache.clear();
}

function normalizeHost(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.$/, '');
}

function stripPort(host: string): string {
  return host.replace(/:\d+$/, '');
}

export function isPlatformHost(rawHost: string): boolean {
  return normalizeHost(rawHost) === env.PLATFORM_HOST.toLowerCase();
}

async function lookup(host: string): Promise<Shop | null> {
  // The platform (super-admin) host never maps to a shop.
  if (isPlatformHost(host)) return null;
  const bare = stripPort(host);

  // 1. Exact custom-domain match (with or without port)
  const domain = await prisma.shopDomain.findFirst({
    where: { host: { in: [host, bare] } },
    include: { shop: true },
  });
  if (domain) return domain.shop;

  // 2. <slug>.<PLATFORM_DOMAIN>
  const suffix = '.' + env.PLATFORM_DOMAIN.toLowerCase();
  if (bare.endsWith(suffix)) {
    const slug = bare.slice(0, -suffix.length);
    if (slug && !slug.includes('.')) {
      const shop = await prisma.shop.findUnique({ where: { slug } });
      if (shop) return shop;
    }
  }

  // 3. Dev fallback
  if (env.NODE_ENV !== 'production' && env.DEFAULT_SHOP_SLUG) {
    return prisma.shop.findUnique({ where: { slug: env.DEFAULT_SHOP_SLUG } });
  }
  return null;
}

export async function resolveShopByHost(rawHost: string): Promise<Shop | null> {
  const host = normalizeHost(rawHost);
  const hit = cache.get(host);
  if (hit && hit.expires > Date.now()) return hit.shop;
  const shop = await lookup(host);
  cache.set(host, { shop, expires: Date.now() + TTL_MS });
  return shop;
}

/**
 * Resolves the shop for this request from the `x-shop-host` header (set by the Next.js proxy),
 * falling back to the Host header. Rejects unknown or inactive shops.
 */
export function requestHost(req: Request): string {
  return req.get('x-shop-host') || req.get('host') || '';
}

export async function requireShop(req: Request, _res: Response, next: NextFunction) {
  const shop = await resolveShopByHost(requestHost(req));
  if (!shop || !shop.isActive) throw notFound('Shop not found');
  req.shop = shop;
  next();
}

/** Sets req.shop when the host maps to an active shop; otherwise leaves it undefined. */
export async function optionalShop(req: Request, _res: Response, next: NextFunction) {
  const shop = await resolveShopByHost(requestHost(req));
  if (shop?.isActive) req.shop = shop;
  next();
}

/** Helper for handlers mounted behind requireShop. */
export function shopOf(req: Request): Shop {
  if (!req.shop) throw new Error('requireShop middleware missing');
  return req.shop;
}
