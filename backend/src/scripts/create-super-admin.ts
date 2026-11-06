/**
 * Creates (or resets the password of) the platform super admin.
 *   npm run create-super-admin -- --email you@example.com --name "Your Name" --password "s3cret-pass"
 */
import bcrypt from 'bcryptjs';
import { parseArgs } from 'node:util';
import { prisma } from '../lib/prisma';

async function main() {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, name: { type: 'string' }, password: { type: 'string' } },
  });
  const email = values.email?.trim().toLowerCase();
  const password = values.password;
  if (!email || !password || password.length < 8) {
    throw new Error('Usage: --email <email> --password <min 8 chars> [--name <name>]');
  }
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== 'SUPER_ADMIN') throw new Error(`${email} already belongs to a shop user`);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: values.name ?? 'Super Admin', passwordHash, role: 'SUPER_ADMIN' },
    update: { passwordHash, tokenVersion: { increment: 1 }, ...(values.name ? { name: values.name } : {}) },
  });
  console.log(`✅ Super admin ${existing ? 'updated' : 'created'}: ${user.email}`);
}

main()
  .catch((e) => {
    console.error('❌', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
