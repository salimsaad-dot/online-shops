"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Alert, Badge, Button, ORDER_STATUS_COLOR, ProductImg, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatMoney, ORDER_STATUS_LABEL, whatsappLink } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import { useData } from "@/lib/use-data";

function nextActions(o: Order): { status: OrderStatus; label: string; variant?: "secondary" | "danger" }[] {
  const done: OrderStatus = o.deliveryType === "DELIVERY" ? "DELIVERED" : "PICKED_UP";
  const doneLabel = o.deliveryType === "DELIVERY" ? "Mark delivered" : "Mark picked up";
  switch (o.status) {
    case "PENDING":
      return [{ status: "READY", label: o.deliveryType === "DELIVERY" ? "Mark out for delivery" : "Mark ready for pickup" }, { status: done, label: doneLabel, variant: "secondary" }, { status: "CANCELLED", label: "Cancel order", variant: "danger" }];
    case "READY":
      return [{ status: done, label: doneLabel }, { status: "PENDING", label: "Back to pending", variant: "secondary" }, { status: "CANCELLED", label: "Cancel order", variant: "danger" }];
    case "DELIVERED":
    case "PICKED_UP":
      return [{ status: "READY", label: "Undo — back to ready", variant: "secondary" }];
    default:
      return [];
  }
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, setData, error, loading } = useData<{ order: Order }>(`/admin/orders/${id}`);
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [actionError, setActionError] = useState("");

  async function setStatus(status: OrderStatus) {
    if (status === "CANCELLED" && !confirm("Cancel this order? Items will be returned to stock. This cannot be undone.")) return;
    setBusy(status);
    setActionError("");
    try {
      setData(await api.patch<{ order: Order }>(`/admin/orders/${id}/status`, { status }));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (error) return <Alert>{error.message}</Alert>;
  if (loading || !data) return <div className="flex justify-center py-20 text-gray-400"><Spinner className="h-6 w-6" /></div>;
  const o = data.order;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-gray-500 hover:text-brand-ink">← Orders</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{o.orderNumber}</h1>
          <Badge color={ORDER_STATUS_COLOR[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
        </div>
        <p className="text-sm text-gray-500">Placed {formatDate(o.createdAt)}</p>
      </div>

      {actionError && <Alert>{actionError}</Alert>}
      {nextActions(o).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {nextActions(o).map((a) => (
            <Button
              key={a.status}
              variant={a.variant ?? "primary"}
              className={a.variant === "danger" ? "sm:ml-auto" : ""}
              loading={busy === a.status}
              disabled={busy !== null}
              onClick={() => setStatus(a.status)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="border-b border-gray-100 px-4 py-3 font-semibold">Items</h2>
          <ul className="divide-y divide-gray-100">
            {o.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <ProductImg src={i.imageUrl} alt={i.name} className="h-12 w-12 shrink-0 rounded-md" />
                <span className="flex-1">
                  {i.productId ? <Link href={`/admin/products/${i.productId}`} className="hover:text-brand-ink">{i.name}</Link> : i.name}
                  <span className="block text-xs text-gray-500">{formatMoney(i.unitPrice, o.currency)} × {i.quantity}</span>
                </span>
                <span className="font-medium">{formatMoney(i.lineTotal, o.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t border-gray-100 px-4 py-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{formatMoney(o.subtotal, o.currency)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Delivery fee</span><span>{formatMoney(o.deliveryFee, o.currency)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total</span><span>{formatMoney(o.total, o.currency)}</span></div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="card space-y-2 p-4 text-sm">
            <h2 className="font-semibold">Customer</h2>
            <p>{o.customer.name}</p>
            <p><a href={`tel:${o.customer.phone}`} className="text-brand-ink hover:underline">{o.customer.phone}</a></p>
            {o.customer.email && <p><a href={`mailto:${o.customer.email}`} className="text-brand-ink hover:underline">{o.customer.email}</a></p>}
            <a
              href={whatsappLink(o.customer.phone, `Hello ${o.customer.name}, about your order ${o.orderNumber}:`)}
              target="_blank"
              rel="noopener"
              className="inline-block text-green-700 hover:underline"
            >
              WhatsApp customer ↗
            </a>
          </section>
          <section className="card space-y-2 p-4 text-sm">
            <h2 className="font-semibold">{o.deliveryType === "DELIVERY" ? "Delivery" : "Pickup"}</h2>
            <p className="text-gray-700">{o.deliveryType === "DELIVERY" ? o.deliveryAddress : "Customer collects from the shop"}</p>
            {o.note && (
              <>
                <h3 className="pt-2 font-medium">Customer note</h3>
                <p className="whitespace-pre-line text-gray-700">{o.note}</p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
