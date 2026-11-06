"use client";

import { useState } from "react";
import { OwnerOnly, PageHeader, useAdmin } from "@/components/admin/AdminShell";
import { Alert, Badge, Button, Field, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useData } from "@/lib/use-data";

interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: "OWNER" | "STAFF";
  isActive: boolean;
  lastLoginAt: string | null;
}

function StaffManager() {
  const { user: me } = useAdmin();
  const { data, error, reload } = useData<{ users: StaffUser[] }>("/admin/staff");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STAFF" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function run(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await reload();
      if (success) setMsg({ kind: "success", text: success });
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      {error && <Alert>{error.message}</Alert>}
      {!data ? (
        <div className="flex justify-center py-10 text-gray-400"><Spinner className="h-6 w-6" /></div>
      ) : (
        <ul className="card divide-y divide-gray-100">
          {data.users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{u.name}</span> {u.id === me.id && <span className="text-xs text-gray-400">(you)</span>}
                <span className="block text-xs text-gray-500">{u.email} · last sign-in {u.lastLoginAt ? formatDate(u.lastLoginAt) : "never"}</span>
              </span>
              <Badge color={u.role === "OWNER" ? "ink" : "gray"}>{u.role === "OWNER" ? "Owner" : "Staff"}</Badge>
              {!u.isActive && <Badge color="red">Disabled</Badge>}
              {u.id !== me.id && (
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api.put(`/admin/staff/${u.id}`, { isActive: !u.isActive }))}>
                    {u.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      const pw = prompt(`New password for ${u.name} (min 8 characters):`);
                      if (pw) void run(() => api.put(`/admin/staff/${u.id}`, { password: pw }), `Password updated for ${u.name}.`);
                    }}
                  >
                    Reset password
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" disabled={busy} onClick={() => confirm(`Remove ${u.name}?`) && run(() => api.del(`/admin/staff/${u.id}`))}>
                    Remove
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api.post("/admin/staff", form);
            setForm({ name: "", email: "", password: "", role: "STAFF" });
          }, "Team member added. Share their email and password with them.");
        }}
        className="card space-y-4 p-5"
      >
        <h2 className="font-semibold">Add team member</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label="Temporary password" hint="At least 8 characters"><input className="input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required /></Field>
          <Field label="Role" hint="Staff manage products, orders and messages. Owners also manage settings and team.">
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="STAFF">Staff</option>
              <option value="OWNER">Owner</option>
            </select>
          </Field>
        </div>
        <Button type="submit" loading={busy}>Add member</Button>
      </form>
    </div>
  );
}

export default function StaffPage() {
  return (
    <OwnerOnly>
      <PageHeader title="Team" />
      <StaffManager />
    </OwnerOnly>
  );
}
