import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { getShop } from "@/lib/server-api";

export const metadata: Metadata = { title: "Sign in" };

export default async function AdminLoginPage() {
  const shop = await getShop();
  return <LoginForm title={`${shop.name} admin`} subtitle="Sign in to manage your shop" redirectTo="/admin" />;
}
