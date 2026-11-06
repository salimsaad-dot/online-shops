import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { checkOrigin } from './middleware/security';
import admin from './modules/admin';
import auth from './modules/auth/auth.routes';
import messages from './modules/messages/messages.public.routes';
import orders from './modules/orders/orders.public.routes';
import platform from './modules/platform/platform.routes';
import storefront from './modules/storefront/storefront.routes';

export function createApp() {
  const app = express();

  // Trust only the hosting platform's load balancer (Render) for req.ip. The real browser IP
  // comes from our Next.js proxy via x-client-ip + shared secret (see middleware/security.ts).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  // The browser normally talks to the Next.js app (same origin) which proxies to us,
  // so CORS is only needed for extra origins listed in CORS_ORIGINS.
  const origins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (origins.length) app.use(cors({ origin: origins, credentials: true }));

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api', checkOrigin);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', auth);
  app.use('/api/platform', platform);
  app.use('/api/admin', admin);
  app.use('/api/orders', orders);
  app.use('/api/messages', messages);
  app.use('/api', storefront); // /shop, /categories, /products

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
