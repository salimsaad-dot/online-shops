// Shapes returned by the backend API (see backend/src/modules/*). Money is in minor units.

export interface Shop {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  primaryColor: string;
  contactPhone: string | null;
  contactEmail: string | null;
  whatsapp: string | null;
  address: string | null;
  currency: string;
  pickupEnabled: boolean;
  pickupAddress: string | null;
  deliveryEnabled: boolean;
  deliveryFee: number;
}

export interface AdminShop extends Shop {
  orderPrefix: string;
  isActive: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  productCount: number;
  position?: number;
  /** Cover photo for category tiles (storefront only) */
  imageUrl?: string | null;
}

export interface ProductImage {
  id: number;
  url: string;
  position: number;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  isActive: boolean;
  category: { id: number; name: string; slug: string } | null;
  images: ProductImage[];
  imageUrl: string | null;
  totalSold?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export type OrderStatus = "PENDING" | "READY" | "DELIVERED" | "PICKED_UP" | "CANCELLED";
export type DeliveryType = "PICKUP" | "DELIVERY";

export interface OrderItem {
  id: number;
  productId: number | null;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  customer: { name: string; phone: string; email: string | null };
  deliveryType: DeliveryType;
  deliveryAddress: string;
  note: string;
  currency: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export type MessageStatus = "NEW" | "READ" | "REPLIED";

export interface Message {
  id: number;
  reference: string;
  name: string;
  phone: string;
  email: string | null;
  orderNumber: string | null;
  body: string;
  status: MessageStatus;
  createdAt: string;
  replies: { id: number; body: string; createdAt: string }[];
}

export type UserRole = "SUPER_ADMIN" | "OWNER" | "STAFF";

export interface SessionUser {
  id: number;
  shopId: number | null;
  role: UserRole;
  email: string;
  name: string;
}
