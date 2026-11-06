import { AdminShell } from "@/components/admin/AdminShell";
import { getShop } from "@/lib/server-api";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const shop = await getShop();
  return <AdminShell shop={shop}>{children}</AdminShell>;
}
