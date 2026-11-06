"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PageHeader, useAdmin } from "@/components/admin/AdminShell";
import { Alert, Badge, ButtonLink, EmptyState, ProductImg, Spinner } from "@/components/ui";
import { qs } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Category, Paginated, Product } from "@/lib/types";
import { useData } from "@/lib/use-data";

const STATUSES = [
  ["all", "All"],
  ["active", "Visible"],
  ["inactive", "Hidden"],
  ["low_stock", "Low stock"],
  ["out_of_stock", "Out of stock"],
] as const;

// A visible product with no stock shows as sold out in the shop, so say that here too
function StatusBadge({ p }: { p: Product }) {
  if (!p.isActive) return <Badge>Hidden</Badge>;
  return p.stock <= 0 ? <Badge color="yellow">Sold out</Badge> : <Badge color="green">Visible</Badge>;
}
const stockClass = (stock: number) => (stock <= 0 ? "font-medium text-red-600" : stock <= 5 ? "font-medium text-amber-600" : "");

function ProductsList() {
  const { shop } = useAdmin();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get("status") ?? "all";
  const categoryId = params.get("categoryId") ?? "";
  const search = params.get("search") ?? "";
  const page = Number(params.get("page") ?? 1);
  const [q, setQ] = useState(search);

  const { data, error, loading } = useData<Paginated<Product>>(`/admin/products${qs({ status, categoryId, search, page })}`);
  const { data: cats } = useData<{ categories: Category[] }>("/admin/categories");

  const go = (changes: Record<string, string | number>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, String(v));
      else next.delete(k);
    }
    router.push(`${pathname}?${next}`);
  };

  return (
    <>
      <PageHeader title="Products">
        <ButtonLink href="/admin/products/new">+ Add product</ButtonLink>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <form onSubmit={(e) => { e.preventDefault(); go({ search: q.trim(), page: "" }); }} className="w-full sm:w-64">
          <input className="input" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <select className="input w-auto" value={status} onChange={(e) => go({ status: e.target.value === "all" ? "" : e.target.value, page: "" })}>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="input w-auto" value={categoryId} onChange={(e) => go({ categoryId: e.target.value, page: "" })}>
          <option value="">All categories</option>
          {cats?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && <Alert>{error.message}</Alert>}
      {loading && !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Spinner className="h-6 w-6" /></div>
      ) : data && data.items.length === 0 ? (
        <EmptyState title="No products found">
          <Link href="/admin/products/new" className="text-brand-ink hover:underline">Add your first product</Link>
        </EmptyState>
      ) : data ? (
        <>
        {/* Phones: one row per product so stock and status stay visible */}
        <ul className="card divide-y divide-gray-100 sm:hidden">
          {data.items.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">
                <ProductImg src={p.imageUrl} alt={p.name} className="h-12 w-12 shrink-0 rounded-md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    <span className="tabular-nums text-gray-900">{formatMoney(p.price, shop.currency)}</span> · <span className={stockClass(p.stock)}>{p.stock} in stock</span>
                  </span>
                </span>
                <StatusBadge p={p} />
              </Link>
            </li>
          ))}
        </ul>
        <div className="card hidden overflow-x-auto sm:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/admin/products/${p.id}`)}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <ProductImg src={p.imageUrl} alt={p.name} className="h-10 w-10 shrink-0 rounded-md" />
                      <span className="font-medium">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.category?.name ?? "—"}</td>
                  <td className="px-4 py-3">{formatMoney(p.price, shop.currency)}</td>
                  <td className={`px-4 py-3 ${stockClass(p.stock)}`}>{p.stock}</td>
                  <td className="px-4 py-3"><StatusBadge p={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : null}

      {data && data.pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => go({ page: page - 1 })} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button>
          <span>Page {data.page} of {data.pages} · {data.total} products</span>
          <button disabled={page >= data.pages} onClick={() => go({ page: page + 1 })} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      )}
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsList />
    </Suspense>
  );
}
