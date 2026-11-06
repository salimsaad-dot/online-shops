"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";

const SLIDE_MS = 7000;

/**
 * Full-bleed dark hero. Each slide shows one product large, over an ambient glow made from a
 * blurred copy of its own photo — so lifestyle shots and plain packshots on white both look
 * cinematic. Crossfades between up to 4 products; pauses on hover/focus and when the tab is hidden;
 * never auto-advances for reduced motion.
 */
export function CinemaHero({ products, shopName, currency }: { products: Product[]; shopName: string; currency: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (products.length < 2 || paused || reduced) return;
    const t = setTimeout(() => {
      if (document.visibilityState === "visible") setIndex((i) => (i + 1) % products.length);
    }, SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, paused, reduced, products.length]);

  const current = products[index];

  return (
    <section
      className="relative isolate -mt-16 overflow-hidden bg-night pt-16 text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured products"
    >
      {/* Ambient glow: every slide's photo, blurred, crossfading with the active slide */}
      {products.map((p, i) => (
        <div key={p.id} aria-hidden className={`absolute inset-0 -z-10 transition-opacity duration-[1200ms] ${i === index ? "opacity-100" : "opacity-0"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imageUrl ?? ""} alt="" className="h-full w-full scale-125 object-cover opacity-55 blur-3xl saturate-150" />
        </div>
      ))}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-night/50 via-night/40 to-night" />

      <div className="mx-auto grid min-h-[min(86svh,860px)] max-w-7xl items-center gap-8 px-4 pb-10 pt-6 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:py-16">
        {/* Copy — text changes per slide; the live region announces it politely */}
        <div className="order-2 lg:order-1" aria-live={paused ? "polite" : "off"}>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/60">
            {shopName}
            {current.category && <> · {current.category.name}</>}
          </p>
          <h2 key={current.id} className="display mt-4 animate-[fade-in_700ms_ease-out] text-5xl sm:text-6xl lg:text-7xl xl:text-8xl">
            {current.name}
          </h2>
          <p className="mt-5 text-xl tabular-nums text-white/80">{formatMoney(current.price, currency)}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/products/${current.slug}`}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-night transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Shop this <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
            </Link>
            <Link
              href="/products"
              className="inline-flex h-12 items-center rounded-full border border-white/25 px-6 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Browse everything
            </Link>
          </div>

          {products.length > 1 && (
            <div className="mt-12 flex gap-3" role="group" aria-label="Choose a featured product">
              {products.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Show ${p.name}`}
                  aria-current={i === index}
                  className="group/thumb flex w-16 flex-col gap-2 sm:w-20"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl ?? ""}
                    alt=""
                    className={`aspect-square w-full rounded-lg object-cover ring-1 transition-opacity duration-300 ${i === index ? "opacity-100 ring-white/60" : "opacity-45 ring-white/10 group-hover/thumb:opacity-80"}`}
                  />
                  {/* Progress bar: fills over the slide's duration while it's the active, playing slide */}
                  <span className="h-0.5 w-full overflow-hidden rounded-full bg-white/20">
                    <span
                      key={`${index}-${paused}-${reduced}`}
                      className="block h-full bg-white"
                      style={
                        i === index
                          ? paused || reduced
                            ? { width: "100%" }
                            : { width: "100%", animation: `hero-progress ${SLIDE_MS}ms linear both` }
                          : { width: 0 }
                      }
                    />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* The product, large */}
        <Link href={`/products/${current.slug}`} className="order-1 block lg:order-2" tabIndex={-1} aria-hidden>
          <div className="relative mx-auto aspect-[4/5] max-h-[52svh] overflow-hidden rounded-[28px] bg-white/5 shadow-2xl shadow-black/50 ring-1 ring-white/10 lg:max-h-[72svh]">
            {products.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i === index ? `${p.id}-active-${index}` : p.id}
                src={p.imageUrl ?? ""}
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ${i === index ? "drift opacity-100" : "opacity-0"}`}
              />
            ))}
          </div>
        </Link>
      </div>
    </section>
  );
}
