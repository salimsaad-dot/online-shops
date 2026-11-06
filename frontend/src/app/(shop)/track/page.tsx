"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { OrderSummary } from "@/components/shop/OrderSummary";
import { Alert, Button, Field } from "@/components/ui";
import { api, errorMessage, qs } from "@/lib/api";
import type { Order } from "@/lib/types";

function TrackForm() {
  const params = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get("order") ?? "");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      const res = await api.get<{ order: Order }>(`/orders/track${qs({ orderNumber: orderNumber.trim(), phone: phone.trim() })}`);
      setOrder(res.order);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="card mt-6 grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Order number">
          <input className="input uppercase" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="e.g. ORD-0001" required />
        </Field>
        <Field label="Phone used at checkout">
          <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </Field>
        <Button type="submit" loading={loading}>Track</Button>
      </form>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      {order && <div className="mt-6"><OrderSummary order={order} /></div>}
    </>
  );
}

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:pt-14">
      <h1 className="display text-5xl sm:text-6xl">Track your order</h1>
      <p className="mt-1 text-sm text-ink-2">Enter your order number and the phone number you used at checkout</p>
      <Suspense>
        <TrackForm />
      </Suspense>
    </div>
  );
}
