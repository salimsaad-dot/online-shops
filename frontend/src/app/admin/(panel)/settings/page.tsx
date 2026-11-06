"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { OwnerOnly, PageHeader } from "@/components/admin/AdminShell";
import { Alert, Button, Field, Spinner } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { toMajorInput, toMinor } from "@/lib/format";
import { resizeImage } from "@/lib/image-resize";
import type { AdminShop } from "@/lib/types";
import { useData } from "@/lib/use-data";

type Form = Omit<AdminShop, "id" | "slug" | "isActive" | "deliveryFee" | "logoUrl"> & { deliveryFee: string; logoUrl: string };

function toForm(s: AdminShop): Form {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip fields the form does not edit
  const { id: _id, slug: _slug, isActive: _a, ...rest } = s;
  return {
    ...rest,
    deliveryFee: toMajorInput(s.deliveryFee),
    logoUrl: s.logoUrl ?? "",
    tagline: s.tagline ?? "",
    contactPhone: s.contactPhone ?? "",
    contactEmail: s.contactEmail ?? "",
    whatsapp: s.whatsapp ?? "",
    address: s.address ?? "",
    pickupAddress: s.pickupAddress ?? "",
  };
}

function SettingsForm({ initial }: { initial: AdminShop }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(toForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Form>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
    setErrors((errs) => (errs[k as string] ? { ...errs, [k]: "" } : errs));
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const fee = toMinor(form.deliveryFee);
    if (fee === null) return setErrors({ deliveryFee: "Enter a valid amount" });
    setSaving(true);
    setStatus(null);
    setErrors({});
    try {
      const { shop } = await api.put<{ shop: AdminShop }>("/admin/settings", { ...form, deliveryFee: fee });
      setForm(toForm(shop));
      setStatus({ kind: "success", text: "Settings saved." });
      router.refresh(); // re-render server layouts (name, colour)
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setErrors(Object.fromEntries(Object.keys(err.details).map((k) => [k, err.field(k) ?? ""])));
      }
      setStatus({ kind: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("logo", await resizeImage(file, 600));
      const { shop } = await api.post<{ shop: AdminShop }>("/admin/settings/logo", fd);
      setForm((f) => ({ ...f, logoUrl: shop.logoUrl ?? "" }));
      router.refresh();
    } catch (err) {
      setStatus({ kind: "error", text: errorMessage(err) });
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      {status && <Alert kind={status.kind}>{status.text}</Alert>}

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Store</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Store name" error={errors.name}><input className="input" value={form.name} onChange={set("name")} /></Field>
          <Field label="Tagline" error={errors.tagline}><input className="input" value={form.tagline ?? ""} onChange={set("tagline")} maxLength={200} /></Field>
          <Field label="Brand colour" error={errors.primaryColor}>
            <div className="flex gap-2">
              <input type="color" value={form.primaryColor} onChange={set("primaryColor")} className="h-10 w-14 cursor-pointer rounded border border-gray-300" />
              <input className="input" value={form.primaryColor} onChange={set("primaryColor")} />
            </div>
          </Field>
          <Field label="Logo" error={errors.logoUrl} hint="Shown in the shop header">
            <div className="flex items-center gap-3">
              {form.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="Logo" className="h-10 max-w-32 rounded border border-gray-200 object-contain" />
              )}
              <Button type="button" variant="secondary" size="sm" loading={uploading} onClick={() => logoInput.current?.click()}>Upload</Button>
              {form.logoUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, logoUrl: "" }))}>Remove</Button>}
              <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadLogo(f); }} />
            </div>
          </Field>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" error={errors.contactPhone}><input className="input" value={form.contactPhone ?? ""} onChange={set("contactPhone")} /></Field>
          <Field label="WhatsApp number" error={errors.whatsapp} hint="With country code, e.g. +233 24 000 0000"><input className="input" value={form.whatsapp ?? ""} onChange={set("whatsapp")} /></Field>
          <Field label="Email" error={errors.contactEmail}><input className="input" type="email" value={form.contactEmail ?? ""} onChange={set("contactEmail")} /></Field>
          <Field label="Address" error={errors.address}><input className="input" value={form.address ?? ""} onChange={set("address")} /></Field>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Orders, pickup & delivery</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" error={errors.currency} hint="3-letter code, e.g. GHS, NGN, USD">
            <input className="input uppercase" value={form.currency} onChange={set("currency")} maxLength={3} />
          </Field>
          <Field label="Order number prefix" error={errors.orderPrefix} hint={`Next orders look like ${form.orderPrefix || "ORD"}-0001`}>
            <input className="input uppercase" value={form.orderPrefix} onChange={set("orderPrefix")} maxLength={10} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.pickupEnabled} onChange={set("pickupEnabled")} className="h-4 w-4 accent-[var(--brand)]" />
          Offer in-store pickup
        </label>
        {form.pickupEnabled && (
          <Field label="Pickup address / instructions" error={errors.pickupAddress}><input className="input" value={form.pickupAddress ?? ""} onChange={set("pickupAddress")} /></Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.deliveryEnabled} onChange={set("deliveryEnabled")} className="h-4 w-4 accent-[var(--brand)]" />
          Offer delivery
        </label>
        {form.deliveryEnabled && (
          <Field label={`Delivery fee (${form.currency})`} error={errors.deliveryFee} className="max-w-xs">
            <input className="input" inputMode="decimal" value={form.deliveryFee} onChange={set("deliveryFee")} />
          </Field>
        )}
      </section>

      <Button type="submit" loading={saving}>Save settings</Button>
    </form>
  );
}

export default function SettingsPage() {
  const { data, error } = useData<{ shop: AdminShop }>("/admin/settings");
  return (
    <OwnerOnly>
      <PageHeader title="Settings" />
      {error ? <Alert>{error.message}</Alert> : !data ? <div className="flex justify-center py-16 text-gray-400"><Spinner className="h-6 w-6" /></div> : <SettingsForm initial={data.shop} />}
    </OwnerOnly>
  );
}
