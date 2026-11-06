"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { shopUrl } from "@/lib/platform";

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export default function NewShopPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", slug: "", currency: "GHS", orderPrefix: "ORD", domains: "", ownerName: "", ownerEmail: "", ownerPassword: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((errs) => (errs[k] ? { ...errs, [k]: "" } : errs));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setErrors({});
    try {
      const { shop } = await api.post<{ shop: { id: number } }>("/platform/shops", {
        name: form.name.trim(),
        slug: form.slug.trim(),
        currency: form.currency.trim(),
        orderPrefix: form.orderPrefix.trim(),
        domains: form.domains.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean),
        owner: { name: form.ownerName.trim(), email: form.ownerEmail.trim(), password: form.ownerPassword },
      });
      router.push(`/platform/shops/${shop.id}?created=1`);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? "That slug, domain or owner email is already in use." : errorMessage(err));
      if (err instanceof ApiError && err.details) setErrors(Object.fromEntries(Object.keys(err.details).map((k) => [k, err.field(k) ?? ""])));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">New client shop</h1>
      {error && <Alert>{error}</Alert>}
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Shop</h2>
        <Field label="Shop name" error={errors.name}>
          <input className="input" value={form.name} required onChange={(e) => { set("name")(e); if (!slugTouched) setForm((f) => ({ ...f, slug: slugify(e.target.value) })); }} />
        </Field>
        <Field label="Slug (subdomain)" error={errors.slug} hint={form.slug ? `Shop URL: ${shopUrl(form.slug)}` : "Lowercase letters, digits, hyphens"}>
          <input className="input" value={form.slug} required onChange={(e) => { setSlugTouched(true); set("slug")(e); }} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" error={errors.currency}><input className="input uppercase" value={form.currency} maxLength={3} onChange={set("currency")} /></Field>
          <Field label="Order number prefix" error={errors.orderPrefix} hint={`e.g. ${form.orderPrefix || "ORD"}-0001`}><input className="input uppercase" value={form.orderPrefix} maxLength={10} onChange={set("orderPrefix")} /></Field>
        </div>
        <Field label="Custom domains (optional)" error={errors.domains} hint="Comma-separated, e.g. clientshop.com, www.clientshop.com. Point their DNS at the frontend host.">
          <input className="input" value={form.domains} onChange={set("domains")} />
        </Field>
      </section>
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Owner account</h2>
        <p className="text-sm text-gray-500">The client signs in at <code>/admin</code> on their shop with these details.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner name"><input className="input" value={form.ownerName} required onChange={set("ownerName")} /></Field>
          <Field label="Owner email" error={errors.owner}><input className="input" type="email" value={form.ownerEmail} required onChange={set("ownerEmail")} /></Field>
          <Field label="Temporary password" hint="At least 8 characters — ask them to change it"><input className="input" value={form.ownerPassword} minLength={8} required onChange={set("ownerPassword")} /></Field>
        </div>
      </section>
      <Button type="submit" loading={saving}>Create shop</Button>
    </form>
  );
}
