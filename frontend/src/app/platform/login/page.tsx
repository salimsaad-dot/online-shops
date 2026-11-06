import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function PlatformLoginPage() {
  return <LoginForm title="Platform admin" subtitle="Manage all client shops" redirectTo="/platform" />;
}
