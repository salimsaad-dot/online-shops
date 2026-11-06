import Link from "next/link";
import { whatsappLink } from "@/lib/format";
import type { Shop } from "@/lib/types";

export function Footer({ shop }: { shop: Shop }) {
  const link = "text-white/70 transition-colors hover:text-white";
  return (
    <footer className="bg-night text-white">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-16 sm:pt-20">
        <div className="grid gap-10 sm:grid-cols-[2fr_1fr_1fr]">
          <div>
            <p className="display text-5xl sm:text-6xl">{shop.name}</p>
            {shop.tagline && <p className="mt-4 max-w-sm text-white/60">{shop.tagline}</p>}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/50">Shop</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li><Link href="/products" className={link}>All products</Link></li>
              <li><Link href="/cart" className={link}>Cart</Link></li>
              <li><Link href="/track" className={link}>Track an order</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/50">Contact</p>
            <ul className="mt-4 space-y-3 text-sm">
              {shop.whatsapp && (
                <li>
                  <a href={whatsappLink(shop.whatsapp)} target="_blank" rel="noopener" className={link}>WhatsApp</a>
                </li>
              )}
              {shop.contactPhone && <li><a href={`tel:${shop.contactPhone}`} className={link}>{shop.contactPhone}</a></li>}
              {shop.contactEmail && <li><a href={`mailto:${shop.contactEmail}`} className={link}>{shop.contactEmail}</a></li>}
              {shop.address && <li className="text-white/70">{shop.address}</li>}
              <li><Link href="/help" className={link}>Help center</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-16 flex flex-wrap justify-between gap-2 border-t border-white/10 pt-6 text-xs text-white/45">
          <span>© {new Date().getFullYear()} {shop.name}</span>
          <span>Prices in {shop.currency}</span>
        </div>
      </div>
    </footer>
  );
}
