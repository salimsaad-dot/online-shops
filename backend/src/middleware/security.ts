import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env, isProd } from '../config/env';
import { forbidden } from '../lib/errors';

/**
 * True when the request came through our own Next.js proxy (it sends the shared secret).
 * Only then do we trust the `x-client-ip` it forwards; anyone calling the API directly could
 * otherwise fake their IP to dodge rate limits.
 */
export function fromTrustedProxy(req: Request): boolean {
  const secret = env.INTERNAL_PROXY_SECRET;
  const given = req.get('x-internal-proxy-secret');
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function clientIp(req: Request): string {
  const forwarded = fromTrustedProxy(req) ? req.get('x-client-ip') : undefined;
  return forwarded || req.ip || 'unknown';
}

/** Rate limiter keyed by the real client IP (see clientIp). */
export function limiter(opts: { windowMinutes: number; limit: number; devLimit?: number; message: string }) {
  return rateLimit({
    windowMs: opts.windowMinutes * 60 * 1000,
    limit: isProd ? opts.limit : (opts.devLimit ?? opts.limit * 20),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(clientIp(req)),
    message: { message: opts.message },
  });
}

/**
 * CSRF defence in depth (cookies are already SameSite=Lax): for state-changing requests that
 * carry an Origin header, the origin's host must be the host the request is for.
 */
export function checkOrigin(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next(); // non-browser clients (scripts, server-to-server)
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    throw forbidden('Bad origin');
  }
  const target = (req.get('x-shop-host') || req.get('host') || '').toLowerCase();
  if (originHost !== target) throw forbidden('Cross-site request blocked');
  next();
}
