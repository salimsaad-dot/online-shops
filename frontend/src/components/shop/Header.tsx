"use client";

import { Menu, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useMounted, useShop } from "./ShopProvider";

function SearchBox({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("search") ?? "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/products?search=${encodeURIComponent(q.trim())}` : "/products");
        onDone?.();
      }}
      className="relative mx-auto w-full max-w-2xl"
    >
      <Search size={18} strokeWidth={1.5} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onDone?.()}
        placeholder="Search products"
        aria-label="Search products"
        className="input h-12 rounded-full pl-11 text-base"
      />
    </form>
  );
}

const LINKS = [
  ["/products", "Shop"],
  ["/track", "Track order"],
  ["/help", "Help"],
] as const;

/**
 * Transparent over the home page's dark hero, then frosted glass once the page scrolls — content
 * moves under a translucent bar instead of a solid strip. Always 64px tall (the hero tucks under it).
 */
export function Header() {
  const { shop, count } = useShop();
  const mounted = useMounted();
  const pathname = usePathname();
  // The open panel remembers the page it was opened on, so navigating closes it without an effect
  const [opened, setOpened] = useState<{ kind: "search" | "menu"; path: string } | null>(null);
  const panel = opened?.path === pathname ? opened.kind : null;
  const toggle = (kind: "search" | "menu") => setOpened(panel === kind ? null : { kind, path: pathname });
  const setPanel = (v: null) => setOpened(v);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const overHero = pathname === "/" && !scrolled && !panel;
  const tone = overHero ? "text-white" : "text-ink";
  const muted = overHero ? "text-white/70 hover:text-white" : "text-ink-2 hover:text-ink";
  const iconBtn = `inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors ${overHero ? "hover:bg-white/10" : "hover:bg-raised"}`;
  const active = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-500 ${
        overHero ? "border-b border-transparent bg-transparent" : "border-b border-line bg-white/75 backdrop-blur-xl backdrop-saturate-150"
      }`}
    >
      <div className={`mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 ${tone}`}>
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {shop.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logoUrl} alt={shop.name} className={`h-9 w-auto max-w-40 object-contain ${overHero ? "brightness-0 invert" : ""}`} />
          ) : (
            <span className="font-display text-2xl tracking-tight">{shop.name}</span>
          )}
        </Link>

        <nav className="mx-auto hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${active(href) ? tone : muted}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <button onClick={() => toggle("search")} className={iconBtn} aria-label="Search" aria-expanded={panel === "search"}>
            {panel === "search" ? <X size={20} strokeWidth={1.5} aria-hidden /> : <Search size={20} strokeWidth={1.5} aria-hidden />}
          </button>
          <Link href="/cart" className={`relative ${iconBtn}`} aria-label={mounted && count > 0 ? `Cart, ${count} items` : "Cart"}>
            <ShoppingBag size={20} strokeWidth={1.5} aria-hidden />
            {mounted && count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-medium tabular-nums text-brand-fg">
                {count}
              </span>
            )}
          </Link>
          <button onClick={() => toggle("menu")} className={`${iconBtn} md:hidden`} aria-label="Menu" aria-expanded={panel === "menu"}>
            {panel === "menu" ? <X size={20} strokeWidth={1.5} aria-hidden /> : <Menu size={20} strokeWidth={1.5} aria-hidden />}
          </button>
        </div>
      </div>

      {panel === "search" && (
        <div className="border-t border-line px-4 py-4">
          <Suspense>
            <SearchBox onDone={() => setPanel(null)} />
          </Suspense>
        </div>
      )}
      {panel === "menu" && (
        <nav className="border-t border-line px-2 py-2 md:hidden" aria-label="Main">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={`block rounded-xl px-4 py-3.5 text-lg ${active(href) ? "text-ink" : "text-ink-2"}`}>
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
