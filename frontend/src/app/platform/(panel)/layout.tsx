import { PlatformShell } from "@/components/admin/PlatformShell";

export default function PlatformPanelLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
