"use client";

import { PageHeader, useAdmin } from "@/components/admin/AdminShell";
import { AccountForms } from "@/components/auth/AccountForms";

export default function AccountPage() {
  const { user, setUser } = useAdmin();
  return (
    <>
      <PageHeader title="My account" />
      <AccountForms user={user} onUser={setUser} />
    </>
  );
}
