"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

const Ctx = createContext<{ user: SessionUser; setUser: (u: SessionUser) => void } | null>(null);
export function usePlatformUser() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlatformUser outside PlatformShell");
  return c;
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    api
      .get<{ user: SessionUser }>("/auth/me")
      .then(({ user }) => {
        if (user.role !== "SUPER_ADMIN") throw new Error("not super admin");
        setUser(user);
      })
      .catch(() => router.replace("/platform/login"));
  }, [router]);

  if (!user) return <div className="flex min-h-screen items-center justify-center text-gray-400"><Spinner className="h-6 w-6" /></div>;

  const link = (href: string, label: string) => (
    <Link href={href} className={`rounded-lg px-3 py-2 text-sm font-medium ${pathname === href || (href !== "/platform" && pathname.startsWith(href)) ? "bg-white/15 text-white" : "text-gray-300 hover:text-white"}`}>
      {label}
    </Link>
  );

  return (
    <Ctx.Provider value={{ user, setUser }}>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-gray-900">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
            {/* Short name on phones so the bar fits on one line; "New shop" lives on the Shops page */}
            <span className="mr-2 whitespace-nowrap font-bold text-white sm:mr-4">
              <span className="hidden sm:inline">Online Shops · </span>Platform
            </span>
            {link("/platform", "Shops")}
            {link("/platform/account", "Account")}
            <button
              onClick={async () => { await api.post("/auth/logout").catch(() => {}); router.replace("/platform/login"); }}
              className="ml-auto whitespace-nowrap text-sm text-gray-300 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </Ctx.Provider>
  );
}
