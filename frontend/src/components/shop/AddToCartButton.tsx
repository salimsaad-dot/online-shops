"use client";

import { Check, ShoppingBag } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { useShop } from "./ShopProvider";

/** Pill "Add to cart" for dark sections (spotlight); confirms with a tick for a moment. */
export function AddToCartButton({ product }: { product: Product }) {
  const { add } = useShop();
  const [added, setAdded] = useState(false);
  if (product.stock <= 0) {
    return <span className="inline-flex h-12 items-center rounded-full border border-white/25 px-6 text-sm text-white/70">Sold out</span>;
  }
  return (
    <button
      onClick={() => {
        add(product);
        setAdded(true);
        setTimeout(() => setAdded(false), 1600);
      }}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-medium text-brand-fg transition-transform hover:scale-[1.02] active:scale-[0.98]"
    >
      {added ? <Check size={16} strokeWidth={2} aria-hidden /> : <ShoppingBag size={16} strokeWidth={1.5} aria-hidden />}
      {added ? "Added" : "Add to cart"}
    </button>
  );
}
