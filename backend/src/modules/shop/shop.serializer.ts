import type { Shop } from '../../generated/prisma/client';

/** Fields safe to expose publicly on the storefront. */
export function publicShop(shop: Shop) {
  return {
    id: shop.id,
    slug: shop.slug,
    name: shop.name,
    tagline: shop.tagline,
    logoUrl: shop.logoUrl,
    primaryColor: shop.primaryColor,
    contactPhone: shop.contactPhone,
    contactEmail: shop.contactEmail,
    whatsapp: shop.whatsapp,
    address: shop.address,
    currency: shop.currency,
    pickupEnabled: shop.pickupEnabled,
    pickupAddress: shop.pickupAddress,
    deliveryEnabled: shop.deliveryEnabled,
    deliveryFee: shop.deliveryFee,
  };
}

/** Full settings for the shop admin. */
export function adminShop(shop: Shop) {
  return { ...publicShop(shop), orderPrefix: shop.orderPrefix, isActive: shop.isActive };
}
