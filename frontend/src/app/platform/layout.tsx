import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Platform", template: "%s · Platform" }, robots: { index: false } };

export default function PlatformRootLayout({ children }: { children: React.ReactNode }) {
  // Platform uses a neutral brand colour (no shop context here).
  return <div className="min-h-screen bg-gray-50 [--brand:#111827] [--brand-fg:#ffffff] [--brand-ink:#111827]">{children}</div>;
}
