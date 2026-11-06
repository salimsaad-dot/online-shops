"use client";

import Link from "next/link";
import { PageHeader } from "@/components/admin/AdminShell";
import { Alert, Badge, ORDER_STATUS_COLOR, Spinner } from "@/components/ui";
import { formatDate, formatMoney, ORDER_STATUS_LABEL } from "@/lib/format";
import { useData } from "@/lib/use-data";

interface Dashboard {
  currency: string;
  products: { total: number; lowStock: number; outOfStock: number };
  orders: { byStatus: Record<string, number>; last30Days: number };
  revenue: { allTime: number; last30Days: number };
  unreadMessages: number;
  recentOrders: { id: number; orderNumber: string; customerName: string; customerPhone: string; total: number; status: string; deliveryType: string; createdAt: string }[];
}

function Stat({ label, value, href, hint }: { label: string; value: string | number; href?: string; hint?: string }) {
  const body = (
    <div className="card h-full p-4 transition hover:shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function DashboardPage() {
  const { data, error, loading } = useData<Dashboard>("/admin/dashboard");
  if (error) return <Alert>{error.message}</Alert>;
  if (loading || !data) return <div className="flex justify-center py-20 text-gray-400"><Spinner className="h-6 w-6" /></div>;

  const pending = (data.orders.byStatus.PENDING ?? 0) + (data.orders.byStatus.READY ?? 0);
  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue (30 days)" value={formatMoney(data.revenue.last30Days, data.currency)} hint={`All time ${formatMoney(data.revenue.allTime, data.currency)}`} />
        <Stat label="Orders (30 days)" value={data.orders.last30Days} href="/admin/orders" />
        <Stat label="Orders to handle" value={pending} href="/admin/orders?status=PENDING" hint="Pending + ready" />
        <Stat label="Unread messages" value={data.unreadMessages} href="/admin/messages" />
        <Stat label="Products" value={data.products.total} href="/admin/products" />
        <Stat label="Low stock (≤5)" value={data.products.lowStock} href="/admin/products?status=low_stock" />
        <Stat label="Out of stock" value={data.products.outOfStock} href="/admin/products?status=out_of_stock" />
      </div>

      <section className="card mt-6">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="font-semibold">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm text-brand-ink hover:underline">View all</Link>
        </div>
        {data.recentOrders.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.recentOrders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-gray-50">
                  <span>
                    <span className="font-medium">{o.orderNumber}</span>
                    <span className="ml-2 text-gray-500">{o.customerName || o.customerPhone}</span>
                    <span className="block text-xs text-gray-400">{formatDate(o.createdAt)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium">{formatMoney(o.total, data.currency)}</span>
                    <Badge color={ORDER_STATUS_COLOR[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
