"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMounted, useShop } from "@/components/shop/ShopProvider";
import { Alert, Button, ButtonLink, EmptyState, Field, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { DeliveryType, Order } from "@/lib/types";

const LAST_ORDER_KEY = "lastOrder"; // read by /order-confirmed

export default function CheckoutPage() {
  const { shop, items, subtotal, clear } = useShop();
  const mounted = useMounted();
  const router = useRouter();

  const [deliveryType, setDeliveryType] = useState<DeliveryType>(shop.pickupEnabled ? "PICKUP" : "DELIVERY");
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const deliveryFee = deliveryType === "DELIVERY" ? shop.deliveryFee : 0;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    // Typing in a field clears its error — a stale "Please enter your name" next to a filled name reads as broken
    setErrors((errs) => (errs[k] ? { ...errs, [k]: "" } : errs));
  };

  if (!mounted) {
    return (
      <div className="flex justify-center py-24 text-ink-3">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <EmptyState title="Your cart is empty">
          <ButtonLink href="/products" className="mt-4">Browse products</ButtonLink>
        </EmptyState>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Please enter your name";
    if (!/^\+?[0-9 ()-]{7,20}$/.test(form.phone.trim())) errs.phone = "Enter a valid phone number";
    if (deliveryType === "DELIVERY" && !form.address.trim()) errs.address = "Enter a delivery address";
    setErrors(errs);
    if (Object.keys(errs).length) {
      const formEl = e.currentTarget as HTMLFormElement;
      // After React renders the errors, move the cursor to the first field that needs fixing
      requestAnimationFrame(() => formEl.querySelector<HTMLElement>("[data-invalid] .input")?.focus());
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const { order } = await api.post<{ order: Order }>("/orders", {
        customer: { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() },
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        deliveryType,
        deliveryAddress: deliveryType === "DELIVERY" ? form.address.trim() : undefined,
        note: form.note.trim() || undefined,
      });
      sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
      clear();
      router.push(`/order-confirmed`);
    } catch (err) {
      if (err instanceof ApiError) {
        const unavailable = (err.details?.unavailable as { name: string; available: number }[] | undefined) ?? [];
        setError(
          unavailable.length
            ? `${err.message}: ${unavailable.map((u) => `${u.name} (${u.available} left)`).join(", ")}. Please update your cart.`
            : err.message,
        );
        setErrors({
          name: err.field("customer") ?? "",
          phone: err.field("phone") ?? "",
        });
      } else setError("Could not place your order. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  const option = (type: DeliveryType, title: string, desc: string) => (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
        deliveryType === type ? "border-brand ring-2 ring-brand/20" : "border-line-strong"
      }`}
    >
      <input type="radio" name="deliveryType" checked={deliveryType === type} onChange={() => setDeliveryType(type)} className="mt-1 accent-[var(--brand)]" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-ink-3">{desc}</span>
      </span>
    </label>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:pt-14">
      <h1 className="display text-5xl sm:text-6xl">Checkout</h1>
      <form onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-3" noValidate>
        <div className="space-y-6 lg:col-span-2">
          {error && <Alert>{error}</Alert>}
          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">Your details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errors.name}>
                <input className="input" value={form.name} onChange={set("name")} autoComplete="name" />
              </Field>
              <Field label="Phone number" error={errors.phone} hint="We'll call or WhatsApp you about your order">
                <input className="input" value={form.phone} onChange={set("phone")} type="tel" autoComplete="tel" placeholder="024 000 0000" />
              </Field>
              <Field label="Email (optional)" className="sm:col-span-2">
                <input className="input" value={form.email} onChange={set("email")} type="email" autoComplete="email" />
              </Field>
            </div>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">How do you want to receive it?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {shop.pickupEnabled && option("PICKUP", "Pickup — free", shop.pickupAddress ?? "Collect from our shop")}
              {shop.deliveryEnabled &&
                option(
                  "DELIVERY",
                  `Delivery — ${shop.deliveryFee > 0 ? formatMoney(shop.deliveryFee, shop.currency) : "free"}`,
                  "We bring it to your address",
                )}
            </div>
            {deliveryType === "DELIVERY" && (
              <Field label="Delivery address" error={errors.address}>
                <textarea className="input min-h-20" value={form.address} onChange={set("address")} autoComplete="street-address" placeholder="Area, street, landmark, house number" />
              </Field>
            )}
            <Field label="Note for the shop (optional)">
              <textarea className="input min-h-16" value={form.note} onChange={set("note")} maxLength={1000} />
            </Field>
          </section>
        </div>

        <aside className="card h-fit space-y-3 p-5">
          <h2 className="font-semibold">Order summary</h2>
          <ul className="space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-2">
                <span className="text-ink-2">
                  {i.name} <span className="text-ink-3">× {i.quantity}</span>
                </span>
                <span className="tabular-nums tabular-nums">{formatMoney(i.price * i.quantity, shop.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-2">Subtotal</span><span className="tabular-nums tabular-nums">{formatMoney(subtotal, shop.currency)}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Delivery</span><span className="tabular-nums tabular-nums">{formatMoney(deliveryFee, shop.currency)}</span></div>
            <div className="flex justify-between pt-2 text-base font-semibold"><span>Total</span><span className="tabular-nums tabular-nums">{formatMoney(subtotal + deliveryFee, shop.currency)}</span></div>
          </div>
          <p className="text-xs text-ink-3">Pay on {deliveryType === "DELIVERY" ? "delivery" : "pickup"}</p>
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Place order
          </Button>
        </aside>
      </form>
    </div>
  );
}
