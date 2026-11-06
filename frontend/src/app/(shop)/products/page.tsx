import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/shop/ProductCard";
import { SortSelect } from "@/components/shop/SortSelect";
import { EmptyState } from "@/components/ui";
import { serverGet } from "@/lib/server-api";
import type { Category, Paginated, Product } from "@/lib/types";

export const metadata: Metadata = { title: "Products" };

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ProductsPage(props: PageProps<"/products">) {
  const sp = await props.searchParams;
  const search = str(sp.search);
  const category = str(sp.category);
  const sort = str(sp.sort) || "newest";
  const page = Math.max(1, Number(str(sp.page)) || 1);

  const query = new URLSearchParams({ sort, page: String(page), limit: "24" });
  if (search) query.set("search", search);
  if (category) query.set("category", category);

  const [data, { categories }] = await Promise.all([
    serverGet<Paginated<Product>>(`/products?${query}`),
    serverGet<{ categories: Category[] }>("/categories"),
  ]);
  const current = categories.find((c) => c.slug === category);

  const link = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams();
    const merged = { search, category, sort, page: String(page), ...changes };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "sort" && v === "newest") && !(k === "page" && String(v) === "1")) next.set(k, String(v));
    }
    const s = next.toString();
    return `/products${s ? `?${s}` : ""}`;
  };

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
      active ? "border-night bg-night text-white" : "border-line-strong bg-surface text-ink hover:border-ink/40"
    }`;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:pt-14">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-ink-3">
            {data.total} {data.total === 1 ? "product" : "products"}
          </p>
          <h1 className="display mt-3 text-5xl sm:text-6xl">
            {search ? `“${search}”` : current ? current.name : "Shop all"}
          </h1>
        </div>
        <SortSelect value={sort} />
      </div>

      {/* Category chips — bleed to the screen edge on phones so the row reads as swipeable */}
      <div className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        <Link href={link({ category: null, page: null })} className={chip(!category)} aria-current={!category ? "page" : undefined}>
          All
        </Link>
        {categories.map((c) => (
          <Link key={c.id} href={link({ category: c.slug, page: null })} className={chip(category === c.slug)} aria-current={category === c.slug ? "page" : undefined}>
            {c.name}
          </Link>
        ))}
      </div>

      <div className="mt-8">
        {data.items.length ? (
          <ProductGrid products={data.items} />
        ) : (
          <EmptyState title="No products found">
            {search ? "Try a different search term." : "Check back soon."}{" "}
            <Link href="/products" className="text-brand-ink hover:underline">
              View all products
            </Link>
          </EmptyState>
        )}
      </div>

      {data.pages > 1 && (
        <nav className="mt-16 flex items-center justify-center gap-3" aria-label="Pagination">
          {page > 1 && (
            <Link href={link({ page: page - 1 })} className="inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-5 text-sm font-medium hover:border-ink/40">
              ← Previous
            </Link>
          )}
          <span className="px-3 text-sm tabular-nums text-ink-2">
            {data.page} / {data.pages}
          </span>
          {page < data.pages && (
            <Link href={link({ page: page + 1 })} className="inline-flex h-11 items-center rounded-full bg-night px-5 text-sm font-medium text-white hover:opacity-90">
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
