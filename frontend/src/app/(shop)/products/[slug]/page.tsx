import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductPurchase } from "@/components/shop/ProductPurchase";
import { Rail } from "@/components/shop/Rail";
import { ServiceFacts } from "@/components/shop/ServiceFacts";
import { formatMoney } from "@/lib/format";
import { getShop, serverGetOrNull } from "@/lib/server-api";
import type { Product } from "@/lib/types";

type Data = { product: Product; related: Product[] };

async function load(slug: string) {
  return serverGetOrNull<Data>(`/products/${encodeURIComponent(slug)}`);
}

export async function generateMetadata(props: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const data = await load(slug);
  if (!data) return { title: "Product not found" };
  return {
    title: data.product.name,
    description: data.product.description.slice(0, 160),
    openGraph: { images: data.product.imageUrl ? [data.product.imageUrl] : [] },
  };
}

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const [shop, data] = await Promise.all([getShop(), load(slug)]);
  if (!data) notFound();
  const { product, related } = data;

  const stockLine = product.stock > 0 ? (product.stock <= 5 ? `Only ${product.stock} left` : "In stock") : "Sold out";
  const stockDot = product.stock <= 0 ? "bg-red-500" : product.stock <= 5 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:pt-10">
        <nav className="mb-6 text-sm text-ink-3" aria-label="Breadcrumb">
          <Link href="/products" className="hover:text-ink">Shop</Link>
          {product.category && (
            <>
              <span className="mx-2" aria-hidden>/</span>
              <Link href={`/products?category=${product.category.slug}`} className="hover:text-ink">
                {product.category.name}
              </Link>
            </>
          )}
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <ProductGallery images={product.images} name={product.name} />
          {/* Stays in view beside the gallery on desktop */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {product.category && <p className="text-xs font-medium uppercase tracking-[0.22em] text-ink-3">{product.category.name}</p>}
            <h1 className="display mt-3 text-5xl sm:text-6xl">{product.name}</h1>
            <div className="mt-5 flex items-center gap-4">
              <p className="text-2xl tabular-nums">{formatMoney(product.price, shop.currency)}</p>
              <p className="flex items-center gap-2 text-sm text-ink-2">
                <span aria-hidden className={`h-2 w-2 rounded-full ${stockDot}`} />
                {stockLine}
              </p>
            </div>
            <ProductPurchase product={product} />
            {product.description && (
              <div className="mt-10">
                <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-ink-3">About this product</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-2">{product.description}</p>
              </div>
            )}
            <div className="card mt-8 p-5">
              <ServiceFacts shop={shop} />
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="pb-24">
          <Rail title="You may also like">
            {related.map((p) => (
              <div key={p.id} className="w-[62vw] shrink-0 sm:w-64 lg:w-72">
                <ProductCard product={p} />
              </div>
            ))}
          </Rail>
        </div>
      )}
    </>
  );
}
