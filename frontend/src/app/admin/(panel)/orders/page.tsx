"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PageHeader } from "@/components/admin/AdminShell";
import { Alert, Badge, EmptyState, ORDER_STATUS_COLOR, Spinner } from "@/components/ui";
import { qs } from "@/lib/api";
import { formatDate, formatMoney, ORDER_STATUS_LABEL } from "@/lib/format";
import type { Order, Paginated } from "@/lib/types";
import { useData } from "@/lib/use-data";

const TABS = ["", "PENDING", "READY", "DELIVERED", "PICKED_UP", "CANCELLED"];

function OrdersList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const page = Number(params.get("page") ?? 1);
  const search = params.get("search") ?? "";
  const [q, setQ] = useState(search);

  const { data, error, loading } = useData<Paginated<Order> & { statusCounts: Record<string, number> }>(
    `/admin/orders${qs({ status, page, search })}`,
  );
  const go = (changes: Record<string, string | number>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, String(v));
      else next.delete(k);
    }
    router.push(`${pathname}?${next}`);
  };
  const total = data ? Object.values(data.statusCounts).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <PageHeader title="Orders" />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t || "all"}
            onClick={() => go({ status: t, page: "" })}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${status === t ? "border-brand text-brand-ink" : "border-transparent text-gray-600 hover:text-gray-900"}`}
          >
            {t ? ORDER_STATUS_LABEL[t] : "All"}
            <span className="ml-1 text-xs text-gray-400">{t ? (data?.statusCounts[t] ?? 0) : total}</span>
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); go({ search: q.trim(), page: "" }); }} className="mb-4 max-w-sm">
        <input className="input" placeholder="Search order no., phone or name" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>

      {error && <Alert>{error.message}</Alert>}
      {loading && !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Spinner className="h-6 w-6" /></div>
      ) : data && data.items.length === 0 ? (
        <EmptyState title="No orders found" />
      ) : data ? (
        <>
        {/* Phones: one card per order so status is never pushed off-screen by the table */}
        <ul className="card divide-y divide-gray-100 sm:hidden">
          {data.items.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="block px-4 py-3 active:bg-gray-50">
                <span className="flex items-center justify-between gap-2">
                  <span className="whitespace-nowrap font-medium">{o.orderNumber}</span>
                  <Badge color={ORDER_STATUS_COLOR[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                </span>
                <span className="mt-1 block text-sm">
                  {o.customer.name} <span className="text-gray-500">· {o.customer.phone}</span>
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {o.deliveryType === "DELIVERY" ? "Delivery" : "Pickup"} · <span className="font-medium text-gray-900 tabular-nums">{formatMoney(o.total, o.currency)}</span> · {formatDate(o.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="card hidden overflow-x-auto sm:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium"><Link href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link></td>
                  <td className="px-4 py-3">{o.customer.name}<span className="block text-xs text-gray-500">{o.customer.phone}</span></td>
                  <td className="px-4 py-3">{o.deliveryType === "DELIVERY" ? "Delivery" : "Pickup"}</td>
                  <td className="px-4 py-3">{formatMoney(o.total, o.currency)}</td>
                  <td className="px-4 py-3"><Badge color={ORDER_STATUS_COLOR[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">{formatDate(o.createdAt)}</td>
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
          <span>Page {data.page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => go({ page: page + 1 })} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      )}
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersList />
    </Suspense>
  );
}
