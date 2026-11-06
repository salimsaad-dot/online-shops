"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, Badge, Button, Field, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { domainUrl, shopUrl } from "@/lib/platform";
import { useData } from "@/lib/use-data";

interface ShopDetail {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  currency: string;
  createdAt: string;
  domains: { id: number; host: string }[];
  users: { id: number; name: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null }[];
  _count: { products: number; orders: number; messages: number };
}

function ShopDetailView() {
  const { id } = useParams<{ id: string }>();
  const created = useSearchParams().get("created");
  const { data, error, reload } = useData<{ shop: ShopDetail }>(`/platform/shops/${id}`);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(created ? { kind: "success", text: "Shop created. Share the shop admin URL and owner login with your client." } : null);
  const [busy, setBusy] = useState(false);
  const [host, setHost] = useState("");
  const [edit, setEdit] = useState<{ name: string; slug: string } | null>(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "OWNER" });

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

  if (error) return <Alert>{error.message}</Alert>;
  if (!data) return <div className="flex justify-center py-20 text-gray-400"><Spinner className="h-6 w-6" /></div>;
  const s = data.shop;
  const url = shopUrl(s.slug);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/platform" className="text-sm text-gray-500 hover:underline">← Shops</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{s.name}</h1>
          {s.isActive ? <Badge color="green">Active</Badge> : <Badge color="red">Inactive</Badge>}
        </div>
        <p className="text-sm text-gray-500">
          {s._count.products} products · {s._count.orders} orders · {s._count.messages} messages · created {formatDate(s.createdAt, false)}
        </p>
      </div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      <section className="card space-y-3 p-5 text-sm">
        <h2 className="font-semibold">Links</h2>
        <p>Storefront: <a href={url} target="_blank" className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900">{url}</a></p>
        <p>Shop admin: <a href={`${url}/admin`} target="_blank" className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900">{url}/admin</a></p>
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Details</h2>
          {!edit && <Button size="sm" variant="secondary" onClick={() => setEdit({ name: s.name, slug: s.slug })}>Edit</Button>}
        </div>
        {edit ? (
          <form onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.put(`/platform/shops/${s.id}`, edit); setEdit(null); }, "Saved."); }} className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Slug" hint="Changing it changes the shop's subdomain URL"><input className="input" value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" loading={busy}>Save</Button>
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <p className="text-sm">Slug <code className="rounded bg-gray-100 px-1">{s.slug}</code> · Currency {s.currency}</p>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Custom domains</h2>
        {s.domains.length === 0 && <p className="text-sm text-gray-500">None — the shop is reachable on its subdomain.</p>}
        <ul className="space-y-2 text-sm">
          {s.domains.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2">
              <a href={domainUrl(d.host)} target="_blank" className="hover:underline">{d.host}</a>
              <Button size="sm" variant="ghost" className="text-red-600" disabled={busy} onClick={() => confirm(`Remove ${d.host}?`) && run(() => api.del(`/platform/shops/${s.id}/domains/${d.id}`))}>Remove</Button>
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); if (host.trim()) void run(async () => { await api.post(`/platform/shops/${s.id}/domains`, { host: host.trim() }); setHost(""); }, "Domain added. Point its DNS to the frontend host."); }} className="flex max-w-md gap-2">
          <input className="input" placeholder="shop.com" value={host} onChange={(e) => setHost(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={busy}>Add</Button>
        </form>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Shop users</h2>
        <ul className="divide-y divide-gray-100 text-sm">
          {s.users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="flex-1">
                <span className="font-medium">{u.name}</span> <span className="text-gray-500">{u.email}</span>
                <span className="block text-xs text-gray-400">Last sign-in {u.lastLoginAt ? formatDate(u.lastLoginAt) : "never"}</span>
              </span>
              <Badge color={u.role === "OWNER" ? "ink" : "gray"}>{u.role.toLowerCase()}</Badge>
              {!u.isActive && <Badge color="red">disabled</Badge>}
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  const pw = prompt(`New password for ${u.email} (min 8 characters):`);
                  if (pw) void run(() => api.put(`/platform/shops/${s.id}/users/${u.id}/password`, { password: pw }), `Password reset for ${u.email}.`);
                }}
              >
                Reset password
              </Button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.post(`/platform/shops/${s.id}/users`, newUser); setNewUser({ name: "", email: "", password: "", role: "OWNER" }); }, "User added."); }}
          className="grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-5 sm:items-end"
        >
          <Field label="Name"><input className="input" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required /></Field>
          <Field label="Email"><input className="input" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required /></Field>
          <Field label="Password"><input className="input" value={newUser.password} minLength={8} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required /></Field>
          <Field label="Role">
            <select className="input" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              <option value="OWNER">Owner</option>
              <option value="STAFF">Staff</option>
            </select>
          </Field>
          <Button type="submit" variant="secondary" disabled={busy}>Add user</Button>
        </form>
      </section>

      {/* Kept apart from everyday settings so switching a client's shop off is never a stray click */}
      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-semibold">Shop status</h2>
          <p className="text-sm text-gray-500">
            {s.isActive ? "Deactivating stops the storefront and the shop admin until it is reactivated." : "This shop is switched off. Its storefront and admin are unavailable."}
          </p>
        </div>
        <Button
          variant={s.isActive ? "danger" : "primary"}
          loading={busy}
          onClick={() => (s.isActive ? confirm(`Deactivate ${s.name}? The storefront and admin will stop working until reactivated.`) : true) && run(() => api.put(`/platform/shops/${s.id}`, { isActive: !s.isActive }))}
        >
          {s.isActive ? "Deactivate shop" : "Activate shop"}
        </Button>
      </section>
    </div>
  );
}

export default function PlatformShopPage() {
  return (
    <Suspense>
      <ShopDetailView />
    </Suspense>
  );
}
