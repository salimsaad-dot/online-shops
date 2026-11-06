"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import type { Product, Shop } from "@/lib/types";

export interface CartItem {
  productId: number;
  slug: string;
  name: string;
  price: number; // minor units, as last seen (server recalculates at checkout)
  imageUrl: string | null;
  stock: number;
  quantity: number;
}

interface ShopContextValue {
  shop: Shop;
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (product: Product, quantity?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
  /** Replace prices/stock with fresh data from the server; drops products that no longer exist. */
  refresh: (products: Product[]) => void;
  toast: (message: string, kind?: "success" | "error") => void;
}

const ShopContext = createContext<ShopContextValue | null>(null);

// ── localStorage-backed cart store (one cart per shop) ──
function storeFor(key: string) {
  const listeners = new Set<() => void>();
  let cached: { raw: string | null; items: CartItem[] } = { raw: null, items: [] };
  const read = (): CartItem[] => {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(key);
    if (raw !== cached.raw) {
      try {
        cached = { raw, items: raw ? (JSON.parse(raw) as CartItem[]) : [] };
      } catch {
        cached = { raw, items: [] };
      }
    }
    return cached.items;
  };
  return {
    subscribe(cb: () => void) {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => e.key === key && cb();
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    get: read,
    set(items: CartItem[]) {
      window.localStorage.setItem(key, JSON.stringify(items));
      listeners.forEach((l) => l());
    },
  };
}
const EMPTY: CartItem[] = [];

export function ShopProvider({ shop, children }: { shop: Shop; children: React.ReactNode }) {
  const store = useMemo(() => storeFor(`cart:${shop.slug}`), [shop.slug]);
  const items = useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
  const [toasts, setToasts] = useState<{ id: number; message: string; kind: "success" | "error" }[]>([]);

  const toast = useCallback((message: string, kind: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  const value = useMemo<ShopContextValue>(() => {
    const save = (next: CartItem[]) => store.set(next);
    return {
      shop,
      items,
      count: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: items.reduce((s, i) => s + i.price * i.quantity, 0),
      add(product, quantity = 1) {
        const current = store.get();
        const existing = current.find((i) => i.productId === product.id);
        const wanted = (existing?.quantity ?? 0) + quantity;
        const qty = Math.min(wanted, product.stock);
        if (qty <= 0) {
          toast("Sorry, this item is out of stock", "error");
          return;
        }
        const line: CartItem = {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
          stock: product.stock,
          quantity: qty,
        };
        save(existing ? current.map((i) => (i.productId === product.id ? line : i)) : [...current, line]);
        toast(qty < wanted ? `Only ${product.stock} available — added the maximum` : `${product.name} added to cart`);
      },
      setQuantity(productId, quantity) {
        const current = store.get();
        if (quantity <= 0) save(current.filter((i) => i.productId !== productId));
        else save(current.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(quantity, i.stock) } : i)));
      },
      remove(productId) {
        save(store.get().filter((i) => i.productId !== productId));
      },
      clear() {
        save([]);
      },
      refresh(products) {
        const byId = new Map(products.map((p) => [p.id, p]));
        const next = store
          .get()
          .filter((i) => byId.has(i.productId))
          .map((i) => {
            const p = byId.get(i.productId)!;
            return { ...i, name: p.name, slug: p.slug, price: p.price, stock: p.stock, imageUrl: p.imageUrl, quantity: Math.min(i.quantity, p.stock) };
          })
          .filter((i) => i.quantity > 0);
        if (JSON.stringify(next) !== JSON.stringify(store.get())) save(next);
      },
      toast,
    };
  }, [shop, items, store, toast]);

  return (
    <ShopContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
              t.kind === "error" ? "bg-red-600" : "bg-ink"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ShopContext.Provider>
  );
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside <ShopProvider>");
  return ctx;
}

/** True after hydration — use to avoid rendering localStorage values on the server. */
const noopSubscribe = () => () => {};
export function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
