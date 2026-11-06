"use client";

import { usePlatformUser } from "@/components/admin/PlatformShell";
import { AccountForms } from "@/components/auth/AccountForms";

export default function PlatformAccountPage() {
  const { user, setUser } = usePlatformUser();
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">My account</h1>
      <AccountForms user={user} onUser={setUser} />
    </>
  );
}
