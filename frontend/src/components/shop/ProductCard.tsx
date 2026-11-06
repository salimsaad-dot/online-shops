"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProductImg } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useShop } from "./ShopProvider";

/** Round "+" that adds one to the cart and briefly confirms with a tick. */
function QuickAdd({ product }: { product: Product }) {
  const { add } = useShop();
  const [added, setAdded] = useState(false);
  return (
    <button
      onClick={() => {
        add(product);
        setAdded(true);
        setTimeout(() => setAdded(false), 1400);
      }}
      aria-label={`Add ${product.name} to cart`}
      // Always visible on touch screens; on mouse devices it rises in on hover/focus
      className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-night shadow-lg shadow-black/10 backdrop-blur transition-[opacity,transform,background-color] duration-300 ease-out hover:bg-white active:scale-95 [@media(hover:hover)]:translate-y-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:translate-y-0 [@media(hover:hover)]:focus-visible:opacity-100"
    >
      {added ? <Check size={18} strokeWidth={2} aria-hidden /> : <Plus size={18} strokeWidth={2} aria-hidden />}
    </button>
  );
}

export function ProductCard({ product, eager = false }: { product: Product; eager?: boolean }) {
  const { shop } = useShop();
  const outOfStock = product.stock <= 0;
  return (
    <div className="group flex flex-col">
      <div className="relative">
        <Link href={`/products/${product.slug}`} className="block aspect-[4/5] overflow-hidden rounded-2xl bg-raised">
          <ProductImg
            src={product.imageUrl}
            alt={product.name}
            eager={eager}
            className={`h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.04] ${outOfStock ? "opacity-60 grayscale-[30%]" : ""}`}
          />
        </Link>
        {outOfStock ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-ink backdrop-blur">Sold out</span>
        ) : (
          <QuickAdd product={product} />
        )}
      </div>
      <Link href={`/products/${product.slug}`} className="mt-3 flex items-start justify-between gap-3">
        <span className="min-w-0">
          {product.category && <span className="block text-xs text-ink-3">{product.category.name}</span>}
          <span className="mt-0.5 line-clamp-2 block text-sm font-medium text-ink">{product.name}</span>
        </span>
        <span className={`shrink-0 text-sm font-medium tabular-nums text-ink ${product.category ? "pt-[18px]" : "pt-0.5"}`}>{formatMoney(product.price, shop.currency)}</span>
      </Link>
    </div>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
