import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // Shops are reachable at <slug>.<PLATFORM_DOMAIN> (e.g. baabahanson.localhost)
  PLATFORM_DOMAIN: z.string().default('localhost'),
  // Host that serves the super-admin platform panel (e.g. localhost:3001, app.yourplatform.com)
  PLATFORM_HOST: z.string().default('localhost:3001'),
  // Comma-separated extra origins allowed by CORS (the Next.js proxy is same-origin, so this is mostly for tools)
  CORS_ORIGINS: z.string().default(''),
  // Shared secret between the Next.js proxy and this API (same value in both). Lets the API trust
  // the client IP the proxy forwards. Required in production.
  INTERNAL_PROXY_SECRET: z.string().min(24).optional(),
  // Dev convenience: shop used when no host matches
  DEFAULT_SHOP_SLUG: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
if (env.NODE_ENV === 'production' && !env.INTERNAL_PROXY_SECRET) {
  console.error('❌ INTERNAL_PROXY_SECRET is required in production');
  process.exit(1);
}
export const isProd = env.NODE_ENV === 'production';
export const cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);
