import { ArrowRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { CinemaHero } from "@/components/shop/CinemaHero";
import { ProductCard, ProductGrid } from "@/components/shop/ProductCard";
import { Rail } from "@/components/shop/Rail";
import { Reveal } from "@/components/shop/Reveal";
import { ServiceFacts } from "@/components/shop/ServiceFacts";
import { ButtonLink, ProductImg } from "@/components/ui";
import { formatMoney, whatsappLink } from "@/lib/format";
import { getShop, serverGet } from "@/lib/server-api";
import type { Category, Paginated, Product } from "@/lib/types";

/** "Electronics", "Electronics and beauty", "Electronics, beauty and books" */
function joinNames(names: string[]): string {
  const lower = names.map((n, i) => (i === 0 ? n : n.toLowerCase()));
  if (lower.length <= 1) return lower.join("");
  return `${lower.slice(0, -1).join(", ")} and ${lower[lower.length - 1]}`;
}

/** Large photo tile per category; the photo is its newest in-stock product's. */
function CategoryTile({ category }: { category: Category }) {
  return (
    <Link
      href={`/products?category=${category.slug}`}
      className="group relative block aspect-[4/5] w-[68vw] shrink-0 overflow-hidden rounded-2xl bg-raised sm:w-64 lg:w-72"
    >
      <ProductImg src={category.imageUrl ?? null} alt="" className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-white">
        <span>
          <span className="display block text-3xl">{category.name}</span>
          <span className="mt-1 block text-xs text-white/75">{category.productCount} {category.productCount === 1 ? "item" : "items"}</span>
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur transition-colors group-hover:bg-white group-hover:text-night">
          <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
        </span>
      </span>
    </Link>
  );
}

/** One product, big, on a dark band — the "everyone's buying this" moment. */
function Spotlight({ product, label, currency }: { product: Product; label: string; currency: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-night text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={product.imageUrl ?? ""} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-30 blur-3xl saturate-150" />
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <Link href={`/products/${product.slug}`} className="block overflow-hidden rounded-[28px] shadow-2xl shadow-black/50 ring-1 ring-white/10">
            <ProductImg src={product.imageUrl} alt={product.name} className="aspect-square w-full transition-transform duration-1000 ease-out hover:scale-[1.03]" />
          </Link>
        </Reveal>
        <Reveal delay={120}>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/60">{label}</p>
          <h2 className="display mt-4 text-5xl sm:text-6xl">{product.name}</h2>
          {product.description && <p className="mt-5 line-clamp-3 max-w-md text-lg leading-relaxed text-white/70">{product.description}</p>}
          <p className="mt-6 text-2xl tabular-nums">{formatMoney(product.price, currency)}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <AddToCartButton product={product} />
            <Link href={`/products/${product.slug}`} className="inline-flex h-12 items-center rounded-full border border-white/25 px-6 text-sm font-medium transition-colors hover:bg-white/10">
              Details
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const shop = await getShop();
  const [{ items: bestSellers }, { items: latest }, { categories }] = await Promise.all([
    serverGet<{ items: Product[] }>("/products/best-sellers"),
    serverGet<Paginated<Product>>("/products?limit=12&sort=newest"),
    serverGet<{ categories: Category[] }>("/categories"),
  ]);

  const stocked = categories.filter((c) => c.productCount > 0);
  const statement =
    shop.tagline ??
    (stocked.length
      ? `${joinNames(stocked.slice(0, 3).map((c) => c.name))}${stocked.length > 3 ? " and more" : ""}, chosen with care.`
      : `Welcome to ${shop.name}.`);

  // Hero: up to 4 in-stock products with photos, best sellers first
  const seen = new Set<number>();
  const featured = [...bestSellers, ...latest].filter((p) => p.imageUrl && p.stock > 0 && !seen.has(p.id) && seen.add(p.id)).slice(0, 4);
  const inStockLatest = latest.filter((p) => p.stock > 0);
  // Spotlight: the top seller if there is one, otherwise a new arrival that isn't leading the hero
  const spotlight = bestSellers[0] ?? inStockLatest.find((p) => p.id !== featured[0]?.id) ?? null;
  // Full rows only (the grid is 4 wide on desktop)
  const bestSellerRow = bestSellers.length >= 4 ? bestSellers.slice(0, bestSellers.length - (bestSellers.length % 4)) : [];

  return (
    <>
      {featured.length > 0 ? (
        <CinemaHero products={featured} shopName={shop.name} currency={shop.currency} />
      ) : (
        <section className="-mt-16 bg-night pb-20 pt-36 text-center text-white">
          <h1 className="display px-4 text-6xl sm:text-7xl">{shop.name}</h1>
          <p className="mt-4 text-white/60">New products are on their way.</p>
        </section>
      )}

      {/* Statement + how buying works here */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:py-28">
        <Reveal className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <h1 className="sr-only">{shop.name}</h1>
            <p className="display text-4xl text-ink sm:text-5xl lg:text-6xl">{statement}</p>
          </div>
          <div className="lg:justify-self-end">
            <ServiceFacts shop={shop} />
            <ButtonLink href="/products" size="lg" className="mt-6 rounded-full!">
              Shop all products <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
            </ButtonLink>
          </div>
        </Reveal>
      </section>

      {stocked.length > 1 && (
        <Reveal className="pb-20 sm:pb-28">
          <Rail title="Shop by category" href="/products" linkLabel="All products">
            {stocked.map((c) => (
              <CategoryTile key={c.id} category={c} />
            ))}
          </Rail>
        </Reveal>
      )}

      {inStockLatest.length > 0 && (
        <Reveal className="pb-20 sm:pb-28">
          <Rail title="New in" href="/products">
            {inStockLatest.map((p) => (
              <div key={p.id} className="w-[62vw] shrink-0 sm:w-64 lg:w-72">
                <ProductCard product={p} />
              </div>
            ))}
          </Rail>
        </Reveal>
      )}

      {spotlight && <Spotlight product={spotlight} label={bestSellers[0] ? "Most loved" : "Just landed"} currency={shop.currency} />}

      {bestSellerRow.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:py-28">
          <Reveal>
            <h2 className="display text-4xl sm:text-5xl">Best sellers</h2>
            <div className="mt-8">
              <ProductGrid products={bestSellerRow} />
            </div>
          </Reveal>
        </section>
      )}

      {/* Help — WhatsApp first when the shop has it, since that's how most customers ask */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:py-28">
        <Reveal className="flex flex-col items-start gap-6 rounded-[28px] bg-surface p-8 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between sm:p-12">
          <div>
            <h2 className="display text-4xl sm:text-5xl">Questions? Just ask.</h2>
            <p className="mt-3 max-w-md text-ink-2">About a product, delivery or an order — we reply quickly.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {shop.whatsapp && (
              <a
                href={whatsappLink(shop.whatsapp, `Hello ${shop.name}, I have a question.`)}
                target="_blank"
                rel="noopener"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-night px-6 text-sm font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <MessageCircle size={16} strokeWidth={1.5} className="text-[#25D366]" aria-hidden /> Chat on WhatsApp
              </a>
            )}
            <ButtonLink href="/help" variant="secondary" size="lg" className="rounded-full!">
              Send a message
            </ButtonLink>
          </div>
        </Reveal>
      </section>
    </>
  );
}
