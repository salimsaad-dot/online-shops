import { Router } from 'express';
import { requireShopUser } from '../../middleware/auth';
import { requireShop } from '../../middleware/tenant';
import messages from './messages.admin.routes';
import orders from './orders.admin.routes';
import products from './products.admin.routes';
import shop from './shop.admin.routes';

// Everything under /api/admin requires an OWNER or STAFF of the resolved shop.
const router = Router();
router.use(requireShop, requireShopUser());
router.use(products);
router.use(orders);
router.use(messages);
router.use(shop);

export default router;
