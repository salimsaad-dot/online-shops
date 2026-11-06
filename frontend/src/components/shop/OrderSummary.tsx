import { Check } from "lucide-react";
import { Badge, ORDER_STATUS_COLOR, ProductImg } from "@/components/ui";
import { formatDate, formatMoney, ORDER_STATUS_LABEL } from "@/lib/format";
import type { Order } from "@/lib/types";

const STEPS: Record<string, string[]> = {
  PICKUP: ["PENDING", "READY", "PICKED_UP"],
  DELIVERY: ["PENDING", "READY", "DELIVERED"],
};

/** Signature detail: order numbers are printed like a ticket stub. */
export function OrderTicket({ number, className = "" }: { number: string; className?: string }) {
  return (
    <span className={`inline-block rounded-md border border-dashed border-line-strong px-2 py-0.5 font-mono font-medium text-ink ${className}`}>
      {number}
    </span>
  );
}

export function OrderProgress({ order }: { order: Order }) {
  if (order.status === "CANCELLED") return <Badge color="red">Cancelled</Badge>;
  const steps = STEPS[order.deliveryType];
  const current = steps.indexOf(order.status);
  const label = (s: string) =>
    s === "READY" ? (order.deliveryType === "PICKUP" ? "Ready for pickup" : "Out for delivery") : ORDER_STATUS_LABEL[s];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
              i <= current ? "bg-brand text-brand-fg" : "bg-raised text-ink-3"
            }`}
          >
            {i < current ? <Check size={14} strokeWidth={2} aria-hidden /> : i + 1}
          </span>
          <span className={i <= current ? "font-medium text-ink" : "text-ink-3"}>{label(s)}</span>
          {i < steps.length - 1 && <span className="h-px w-4 bg-line-strong sm:w-8" />}
        </li>
      ))}
    </ol>
  );
}

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className={`flex justify-between ${strong ? "pt-2 text-base font-medium text-ink" : "text-ink-2"}`}>
    <span>{label}</span>
    <span className={`tabular-nums ${strong ? "" : "text-ink"}`}>{value}</span>
  </div>
);

/** The order as a receipt: dashed tear lines, ticket-stub number, aligned figures. */
export function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="card divide-y divide-dashed divide-line-strong">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <p className="text-sm text-ink-3">Order</p>
          <OrderTicket number={order.orderNumber} className="text-lg" />
          <p className="text-xs text-ink-3">{formatDate(order.createdAt)}</p>
        </div>
        <Badge color={ORDER_STATUS_COLOR[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
      </div>
      <div className="p-5">
        <OrderProgress order={order} />
      </div>
      <ul className="space-y-3 p-5">
        {order.items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 text-sm">
            <ProductImg src={i.imageUrl} alt={i.name} className="h-12 w-12 shrink-0 rounded-md" />
            <span className="flex-1 text-ink">
              {i.name} <span className="text-ink-3">× {i.quantity}</span>
            </span>
            <span className="text-ink tabular-nums">{formatMoney(i.lineTotal, order.currency)}</span>
          </li>
        ))}
      </ul>
      <div className="space-y-1 p-5 text-sm">
        <Row label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
        <Row label="Delivery" value={formatMoney(order.deliveryFee, order.currency)} />
        <Row label="Total" value={formatMoney(order.total, order.currency)} strong />
      </div>
      <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
        <div>
          <p className="font-medium text-ink">{order.deliveryType === "DELIVERY" ? "Delivery to" : "Pickup"}</p>
          <p className="text-ink-2">{order.deliveryType === "DELIVERY" ? order.deliveryAddress : "Collect from the shop"}</p>
        </div>
        <div>
          <p className="font-medium text-ink">Contact</p>
          <p className="text-ink-2">
            {order.customer.name} · {order.customer.phone}
          </p>
        </div>
      </div>
    </div>
  );
}
