"use client";

import { Check, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, ProductImg } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useShop } from "./ShopProvider";

export function QuantityStepper({
  value,
  max,
  onChange,
  size = "md",
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  size?: "md" | "lg";
}) {
  const btn = `flex items-center justify-center text-lg leading-none transition-colors hover:bg-raised disabled:opacity-30 ${size === "lg" ? "h-12 w-12" : "h-10 w-10"}`;
  return (
    <div className="inline-flex items-center overflow-hidden rounded-[var(--radius-btn)] border border-line-strong bg-surface">
      <button onClick={() => onChange(value - 1)} disabled={value <= 1} className={btn} aria-label="Decrease quantity">
        −
      </button>
      <span className="min-w-8 text-center text-sm font-medium tabular-nums" aria-live="polite">{value}</span>
      <button onClick={() => onChange(value + 1)} disabled={value >= max} className={btn} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}

export function ProductPurchase({ product }: { product: Product }) {
  const { shop, add } = useShop();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  // Phones: once the main buttons scroll out of view (upwards), offer a sticky "Add to cart" bar
  useEffect(() => {
    const el = anchor.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (product.stock <= 0) {
    return (
      <Button disabled className="mt-8 h-12 w-full" size="lg">
        Sold out
      </Button>
    );
  }

  const addNow = () => {
    add(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  return (
    <>
      <div ref={anchor} className="mt-8 space-y-3">
        <div className="flex gap-3">
          <QuantityStepper size="lg" value={qty} max={product.stock} onChange={(n) => setQty(Math.max(1, Math.min(n, product.stock)))} />
          <Button size="lg" className="h-12 flex-1" onClick={addNow}>
            {added ? <Check size={18} strokeWidth={2} aria-hidden /> : <ShoppingBag size={18} strokeWidth={1.5} aria-hidden />}
            {added ? "Added to cart" : "Add to cart"}
          </Button>
        </div>
        <Button
          size="lg"
          variant="secondary"
          className="h-12 w-full"
          onClick={() => {
            add(product, qty);
            router.push("/cart");
          }}
        >
          Buy now
        </Button>
      </div>

      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/85 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl transition-transform duration-300 ease-out lg:hidden ${
          showBar ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!showBar}
      >
        <div className="flex items-center gap-3">
          <ProductImg src={product.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="text-sm tabular-nums text-ink-2">{formatMoney(product.price, shop.currency)}</p>
          </div>
          <Button size="md" className="h-11 px-5" onClick={addNow} tabIndex={showBar ? 0 : -1}>
            {added ? "Added" : "Add to cart"}
          </Button>
        </div>
      </div>
    </>
  );
}
