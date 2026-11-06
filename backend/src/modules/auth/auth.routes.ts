import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { badRequest, unauthorized } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { limiter } from '../../middleware/security';
import { clearAuthCookie, requireAuth, setAuthCookie, userOf } from '../../middleware/auth';
import { isPlatformHost, optionalShop, requestHost } from '../../middleware/tenant';
import { body, emailSchema } from '../../middleware/validate';

const router = Router();

const loginLimiter = limiter({
  windowMinutes: 15,
  limit: 10,
  devLimit: 200, // relaxed locally so testing doesn't lock you out
  message: 'Too many login attempts. Try again in 15 minutes.',
});

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(100);

// A real hash so failed lookups take the same time as wrong passwords.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy', 10);

router.post('/login', loginLimiter, optionalShop, async (req, res) => {
  const { email, password } = body(req, z.object({ email: emailSchema, password: z.string().min(1) }));

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) throw unauthorized('Invalid email or password');

  // Scope: shop staff sign in on their shop's host; the super admin on the platform host.
  const scopeOk =
    user.role === 'SUPER_ADMIN'
      ? isPlatformHost(requestHost(req))
      : req.shop !== undefined && user.shopId === req.shop.id;
  if (!scopeOk) throw unauthorized('Invalid email or password');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  setAuthCookie(res, user);
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, shopId: user.shopId } });
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: userOf(req) });
});

router.put('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = body(
    req,
    z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }),
  );
  const me = userOf(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw badRequest('Current password is incorrect');
  }
  // Bumping tokenVersion signs out every other session.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12), tokenVersion: { increment: 1 } },
  });
  setAuthCookie(res, updated);
  res.json({ ok: true });
});

router.put('/profile', requireAuth, async (req, res) => {
  const data = body(req, z.object({ name: z.string().trim().min(1).max(120) }));
  const user = await prisma.user.update({ where: { id: userOf(req).id }, data });
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, shopId: user.shopId } });
});

export default router;
export { passwordSchema };
