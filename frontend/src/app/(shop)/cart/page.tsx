"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { QuantityStepper } from "@/components/shop/ProductPurchase";
import { useMounted, useShop } from "@/components/shop/ShopProvider";
import { ButtonLink, EmptyState, ProductImg, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Paginated, Product } from "@/lib/types";

export default function CartPage() {
  const { shop, items, subtotal, setQuantity, remove, refresh } = useShop();
  const mounted = useMounted();
  const refreshed = useRef(false);

  // Refresh prices & stock once from the server (cart prices may be stale).
  useEffect(() => {
    if (!mounted || refreshed.current || !items.length) return;
    refreshed.current = true;
    api
      .get<Paginated<Product>>(`/products?limit=100&ids=${items.map((i) => i.productId).join(",")}`)
      .then((d) => refresh(d.items))
      .catch(() => {});
  }, [mounted, items, refresh]);

  if (!mounted) {
    return (
      <div className="flex justify-center py-24 text-ink-3">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:pt-14">
      <h1 className="display text-5xl sm:text-6xl">Your cart</h1>
      {!items.length ? (
        <div className="mt-6">
          <EmptyState title="Your cart is empty">
            <ButtonLink href="/products" className="mt-4">Start shopping</ButtonLink>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <ul className="card divide-y divide-line overflow-hidden lg:col-span-2">
            {items.map((item) => (
              <li key={item.productId} className="flex gap-4 p-4">
                <Link href={`/products/${item.slug}`} className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-raised">
                  <ProductImg src={item.imageUrl} alt={item.name} className="h-full w-full" />
                </Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex justify-between gap-2">
                    <Link href={`/products/${item.slug}`} className="text-sm font-medium hover:text-brand-ink">
                      {item.name}
                    </Link>
                    <span className="text-sm font-semibold tabular-nums">{formatMoney(item.price * item.quantity, shop.currency)}</span>
                  </div>
                  <span className="text-xs text-ink-3 tabular-nums">{formatMoney(item.price, shop.currency)} each</span>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <QuantityStepper value={item.quantity} max={item.stock} onChange={(n) => setQuantity(item.productId, n)} />
                    <button onClick={() => remove(item.productId)} className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="card h-fit space-y-3 p-5">
            <h2 className="font-semibold">Summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-ink-2">Subtotal</span>
              <span className="font-medium tabular-nums">{formatMoney(subtotal, shop.currency)}</span>
            </div>
            <p className="text-xs text-ink-3">Delivery options and fees are shown at checkout</p>
            <ButtonLink href="/checkout" size="lg" className="w-full">
              Checkout
            </ButtonLink>
            <Link href="/products" className="block text-center text-sm text-ink-2 hover:text-brand-ink">
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
