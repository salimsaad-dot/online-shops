import { Banknote, Store, Truck } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { Shop } from "@/lib/types";

/** Delivery / pickup / payment facts for a shop, from its real settings. */
export function ServiceFacts({ shop, className = "" }: { shop: Shop; className?: string }) {
  const facts: { icon: typeof Truck; text: string }[] = [];
  if (shop.deliveryEnabled) {
    facts.push({
      icon: Truck,
      text: `Delivery ${shop.deliveryFee > 0 ? formatMoney(shop.deliveryFee, shop.currency) : "free"}`,
    });
  }
  if (shop.pickupEnabled) {
    facts.push({ icon: Store, text: shop.pickupAddress ? `Free pickup at ${shop.pickupAddress}` : "Free pickup" });
  }
  facts.push({
    icon: Banknote,
    text: shop.deliveryEnabled && shop.pickupEnabled ? "Pay on delivery or pickup" : shop.deliveryEnabled ? "Pay on delivery" : "Pay when you collect",
  });

  return (
    <ul className={`flex flex-col gap-2 text-sm text-ink-2 ${className}`}>
      {facts.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-2">
          <Icon size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" aria-hidden />
          {text}
        </li>
      ))}
    </ul>
  );
}
