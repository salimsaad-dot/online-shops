"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Badge, ButtonLink, EmptyState, Spinner } from "@/components/ui";
import { qs } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { shopUrl } from "@/lib/platform";
import { useData } from "@/lib/use-data";

interface ShopRow {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  currency: string;
  domains: { id: number; host: string }[];
  counts: { products: number; orders: number; users: number };
  createdAt: string;
}
interface Stats {
  shops: number;
  activeShops: number;
  orders: number;
  revenueByCurrency: Record<string, number>;
}

export default function PlatformShopsPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const { data, error, loading } = useData<{ shops: ShopRow[] }>(`/platform/shops${qs({ search })}`);
  const { data: stats } = useData<Stats>("/platform/stats");

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Shops</h1>
        <ButtonLink href="/platform/shops/new">+ New shop</ButtonLink>
      </div>
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-4"><p className="text-sm text-gray-500">Shops</p><p className="text-2xl font-bold">{stats.shops}</p></div>
          <div className="card p-4"><p className="text-sm text-gray-500">Active</p><p className="text-2xl font-bold">{stats.activeShops}</p></div>
          <div className="card p-4"><p className="text-sm text-gray-500">Orders <span className="text-xs">(excl. cancelled)</span></p><p className="text-2xl font-bold">{stats.orders}</p></div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Revenue</p>
            {Object.entries(stats.revenueByCurrency).map(([c, v]) => <p key={c} className="font-bold">{formatMoney(v, c)}</p>)}
            {!Object.keys(stats.revenueByCurrency).length && <p className="text-2xl font-bold">—</p>}
          </div>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }} className="mb-4 max-w-sm">
        <input className="input" placeholder="Search by name or slug" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      {error && <Alert>{error.message}</Alert>}
      {loading && !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Spinner className="h-6 w-6" /></div>
      ) : data && !data.shops.length ? (
        <EmptyState title="No shops yet"><Link href="/platform/shops/new" className="underline">Create the first client shop</Link></EmptyState>
      ) : data ? (
        <>
        {/* Phones: one card per shop instead of a table that scrolls sideways */}
        <ul className="card divide-y divide-gray-100 sm:hidden">
          {data.shops.map((s) => (
            <li key={s.id}>
              <Link href={`/platform/shops/${s.id}`} className="block px-4 py-3 active:bg-gray-50">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{s.name}</span>
                  {s.isActive ? <Badge color="green">Active</Badge> : <Badge color="red">Inactive</Badge>}
                </span>
                <span className="mt-0.5 block truncate text-xs text-gray-500">{s.domains[0]?.host ?? shopUrl(s.slug).replace(/^https?:\/\//, "")}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{s.counts.products} products · {s.counts.orders} orders · since {formatDate(s.createdAt, false)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="card hidden overflow-x-auto sm:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-4 py-3">Shop</th><th className="px-4 py-3">Domains</th><th className="px-4 py-3">Products</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.shops.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><Link href={`/platform/shops/${s.id}`} className="font-medium hover:underline">{s.name}</Link><span className="block text-xs text-gray-500">{s.slug}</span></td>
                  <td className="px-4 py-3 text-xs">
                    <a href={shopUrl(s.slug)} target="_blank" className="block text-gray-600 hover:underline">{shopUrl(s.slug).replace(/^https?:\/\//, "")}</a>
                    {s.domains.map((d) => <span key={d.id} className="block text-gray-600">{d.host}</span>)}
                  </td>
                  <td className="px-4 py-3">{s.counts.products}</td>
                  <td className="px-4 py-3">{s.counts.orders}</td>
                  <td className="px-4 py-3">{s.isActive ? <Badge color="green">Active</Badge> : <Badge color="red">Inactive</Badge>}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(s.createdAt, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : null}
    </>
  );
}
