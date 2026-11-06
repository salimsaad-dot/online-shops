"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Check, MessageCircle } from "lucide-react";
import { OrderSummary, OrderTicket } from "@/components/shop/OrderSummary";
import { useShop } from "@/components/shop/ShopProvider";
import { buttonClass, ButtonLink, EmptyState } from "@/components/ui";
import { whatsappLink } from "@/lib/format";
import type { Order } from "@/lib/types";

const KEY = "lastOrder";
const noop = () => () => {};

export default function OrderConfirmedPage() {
  const { shop } = useShop();
  const raw = useSyncExternalStore(noop, () => sessionStorage.getItem(KEY), () => undefined);
  if (raw === undefined) return null; // server render
  const order: Order | null = raw ? JSON.parse(raw) : null;

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <EmptyState title="No recent order found">
          <Link href="/track" className="text-brand-ink hover:underline">Track an existing order</Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:pt-14">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700"><Check size={24} strokeWidth={1.5} aria-hidden /></div>
        <h1 className="display mt-5 text-5xl sm:text-6xl">Thank you. Your order is in.</h1>
        <p className="mt-2 text-ink-2">
          Keep your order number <OrderTicket number={order.orderNumber} />. You can track it any time with your phone number.
        </p>
      </div>
      <div className="mt-8">
        <OrderSummary order={order} />
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/products">Continue shopping</ButtonLink>
        <ButtonLink href={`/track?order=${order.orderNumber}`} variant="secondary">Track order</ButtonLink>
        {shop.whatsapp && (
          <a
            href={whatsappLink(shop.whatsapp, `Hello, I just placed order ${order.orderNumber}.`)}
            target="_blank"
            rel="noopener"
            // Secondary, not a second filled green: one primary action per screen, and WhatsApp green clashed with the brand
            className={buttonClass("secondary")}
          >
            <MessageCircle size={16} strokeWidth={1.5} className="text-[#25D366]" aria-hidden />
            Message us on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
