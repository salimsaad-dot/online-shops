import type { Metadata } from "next";
import { brandStyle } from "@/lib/brand";
import { getShop } from "@/lib/server-api";

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShop();
  return { title: { default: `Admin · ${shop.name}`, template: `%s · Admin · ${shop.name}` }, robots: { index: false } };
}

export default async function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  const shop = await getShop();
  return (
    <div style={brandStyle(shop.primaryColor)} className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
