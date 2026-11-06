"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { SessionUser, Shop } from "@/lib/types";

interface AdminCtx {
  user: SessionUser;
  shop: Shop;
  isOwner: boolean;
  setUser: (u: SessionUser) => void;
}
const Ctx = createContext<AdminCtx | null>(null);
export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin outside AdminShell");
  return c;
}

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/admin/orders", label: "Orders", icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" },
  { href: "/admin/products", label: "Products", icon: "M20 7 12 3 4 7m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { href: "/admin/categories", label: "Categories", icon: "M4 6h16M4 12h16M4 18h7" },
  { href: "/admin/messages", label: "Messages", icon: "M8 10h8M8 14h5M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z" },
  { href: "/admin/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z", ownerOnly: true },
  { href: "/admin/staff", label: "Staff", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8", ownerOnly: true },
];

export function AdminShell({ shop, children }: { shop: Shop; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  // The mobile menu is "open for a pathname" so navigating closes it automatically.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuOpen = menuFor === pathname;

  useEffect(() => {
    api
      .get<{ user: SessionUser }>("/auth/me")
      .then(({ user }) => {
        if (user.shopId !== shop.id) throw new ApiError(403, "wrong shop");
        setUser(user);
      })
      .catch(() => router.replace("/admin/login"));
  }, [router, shop.id]);


  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  const isOwner = user.role === "OWNER";

  async function logout() {
    await api.post("/auth/logout").catch(() => {});
    router.replace("/admin/login");
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <nav className="space-y-1 p-3">
      {NAV.filter((n) => !n.ownerOnly || isOwner).map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
            isActive(n.href) ? "bg-brand text-brand-fg" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
            <path d={n.icon} />
          </svg>
          {n.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <Ctx.Provider value={{ user, shop, isOwner, setUser }}>
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
          <div className="border-b border-gray-200 px-5 py-4">
            <p className="truncate font-bold">{shop.name}</p>
            <a href="/" target="_blank" className="text-xs text-gray-500 hover:text-brand-ink">View shop ↗</a>
          </div>
          <div className="flex-1">{nav}</div>
          <div className="border-t border-gray-200 p-3 text-sm">
            <Link href="/admin/account" className="block rounded-lg px-3 py-2 hover:bg-gray-100">
              <span className="block truncate font-medium">{user.name}</span>
              <span className="block truncate text-xs text-gray-500">{user.email} · {user.role.toLowerCase()}</span>
            </Link>
            <button onClick={logout} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-gray-600 hover:bg-gray-100">Sign out</button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
            <button onClick={() => setMenuFor(menuOpen ? null : pathname)} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Menu">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <span className="truncate font-semibold">{shop.name}</span>
            <button onClick={logout} className="text-sm text-gray-600">Sign out</button>
          </header>
          {menuOpen && (
            <div className="border-b border-gray-200 bg-white lg:hidden">
              {nav}
              <Link href="/admin/account" className="block px-6 pb-4 text-sm text-gray-600">My account</Link>
            </div>
          )}
          <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </Ctx.Provider>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { isOwner } = useAdmin();
  if (!isOwner) return <p className="text-sm text-gray-600">Only the shop owner can access this page.</p>;
  return <>{children}</>;
}
