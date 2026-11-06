import type { CookieOptions, NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env, isProd } from '../config/env';
import { forbidden, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { UserRole } from '../generated/prisma/client';

export const AUTH_COOKIE = 'os_token';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface AuthUser {
  id: number;
  shopId: number | null;
  role: UserRole;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface TokenPayload {
  sub: string;
  v: number; // tokenVersion
}

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
};

export function setAuthCookie(res: Response, user: { id: number; tokenVersion: number }) {
  const payload: TokenPayload = { sub: String(user.id), v: user.tokenVersion };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions, maxAge: TOKEN_TTL_SECONDS * 1000 });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, cookieOptions);
}

async function loadUser(req: Request): Promise<AuthUser | null> {
  const token: string | undefined = req.cookies?.[AUTH_COOKIE];
  if (!token) return null;
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as unknown as TokenPayload;
  } catch {
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
  if (!user || !user.isActive || user.tokenVersion !== payload.v) return null;
  return { id: user.id, shopId: user.shopId, role: user.role, email: user.email, name: user.name };
}

/** Any signed-in user (shop scope is checked by requireShopUser / requireSuperAdmin). */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await loadUser(req);
  if (!user) throw unauthorized();
  req.user = user;
  next();
}

/** Signed-in OWNER/STAFF of the shop resolved for this request. Use after requireShop. */
export function requireShopUser(...roles: UserRole[]) {
  const allowed = roles.length ? roles : (['OWNER', 'STAFF'] as UserRole[]);
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await loadUser(req);
    if (!user) throw unauthorized();
    if (user.shopId === null || user.shopId !== req.shop?.id) throw forbidden('Not a member of this shop');
    if (!allowed.includes(user.role)) throw forbidden();
    req.user = user;
    next();
  };
}

export async function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  const user = await loadUser(req);
  if (!user) throw unauthorized();
  if (user.role !== 'SUPER_ADMIN') throw forbidden();
  req.user = user;
  next();
}

export function userOf(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
