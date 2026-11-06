import type { Metadata } from "next";
import { Footer } from "@/components/shop/Footer";
import { Header } from "@/components/shop/Header";
import { ShopProvider } from "@/components/shop/ShopProvider";
import { brandStyle } from "@/lib/brand";
import { getShop } from "@/lib/server-api";

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShop();
  return {
    title: { default: shop.name, template: `%s · ${shop.name}` },
    description: shop.tagline ?? `Shop online at ${shop.name}`,
    icons: shop.logoUrl ? [{ url: shop.logoUrl }] : undefined,
  };
}

export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const shop = await getShop();
  return (
    <div style={brandStyle(shop.primaryColor)} className="theme-premium flex min-h-screen flex-col bg-paper">
      <ShopProvider shop={shop}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer shop={shop} />
      </ShopProvider>
    </div>
  );
}
