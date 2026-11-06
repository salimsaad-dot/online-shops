"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Alert, Button, Field, ProductImg } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { toMajorInput, toMinor } from "@/lib/format";
import { resizeImage } from "@/lib/image-resize";
import type { Category, Product } from "@/lib/types";
import { useData } from "@/lib/use-data";
import { useAdmin } from "./AdminShell";

const MAX_IMAGES = 8;

async function uploadFiles(productId: number, files: File[]): Promise<Product> {
  const form = new FormData();
  for (const f of files) form.append("images", await resizeImage(f));
  const { product } = await api.post<{ product: Product }>(`/admin/products/${productId}/images`, form);
  return product;
}

function ImageManager({ product, onChange }: { product: Product; onChange: (p: Product) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");

  async function run(fn: () => Promise<Product>) {
    setBusy(true);
    setError("");
    try {
      onChange(await fn());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const move = (index: number, dir: -1 | 1) => {
    const ids = product.images.map((i) => i.id);
    const j = index + dir;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void run(async () => (await api.put<{ product: Product }>(`/admin/products/${product.id}/images/order`, { imageIds: ids })).product);
  };

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Images</h2>
        <span className="text-xs text-gray-500">{product.images.length}/{MAX_IMAGES} · first image is the main one</span>
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {product.images.map((img, i) => (
          <div key={img.id} className="group relative overflow-hidden rounded-lg border border-gray-200">
            <ProductImg src={img.url} alt="" className="aspect-square w-full" />
            {i === 0 && <span className="absolute left-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-medium text-brand-fg">Main</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} className="px-2 text-white disabled:opacity-30" aria-label="Move left">←</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => confirm("Delete this image?") && run(async () => (await api.del<{ product: Product }>(`/admin/products/${product.id}/images/${img.id}`)).product)}
                className="px-2 text-xs text-white"
              >
                Delete
              </button>
              <button type="button" disabled={busy || i === product.images.length - 1} onClick={() => move(i, 1)} className="px-2 text-white disabled:opacity-30" aria-label="Move right">→</button>
            </div>
          </div>
        ))}
        {product.images.length < MAX_IMAGES && (
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-brand hover:text-brand-ink"
          >
            {busy ? "Working…" : "+ Upload"}
          </button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES - product.images.length);
          e.target.value = "";
          if (files.length) void run(() => uploadFiles(product.id, files));
        }}
      />
      {product.images.length < MAX_IMAGES && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!url.trim()) return;
            void run(async () => {
              const { product: p } = await api.post<{ product: Product }>(`/admin/products/${product.id}/images/url`, { url: url.trim() });
              setUrl("");
              return p;
            });
          }}
          className="flex gap-2"
        >
          <input className="input" placeholder="…or paste an image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={busy}>Add</Button>
        </form>
      )}
    </section>
  );
}

export function ProductForm({ initial }: { initial?: Product }) {
  const router = useRouter();
  const { shop } = useAdmin();
  const { data: cats } = useData<{ categories: Category[] }>("/admin/categories");
  const [product, setProduct] = useState<Product | undefined>(initial);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    price: initial ? toMajorInput(initial.price) : "",
    stock: String(initial?.stock ?? 0),
    categoryId: initial?.category?.id ? String(initial.category.id) : "",
    isActive: initial?.isActive ?? true,
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
    setErrors((errs) => (errs[k] ? { ...errs, [k]: "" } : errs));
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const price = toMinor(form.price);
    const stock = Number(form.stock);
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (price === null) errs.price = "Enter a valid price";
    if (!Number.isInteger(stock) || stock < 0) errs.stock = "Enter a whole number";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    setError("");
    setSaved(false);
    const payload = {
      name: form.name.trim(),
      description: form.description,
      price,
      stock,
      isActive: form.isActive,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
    };
    try {
      if (product) {
        const { product: p } = await api.put<{ product: Product }>(`/admin/products/${product.id}`, payload);
        setProduct(p);
        setSaved(true);
      } else {
        let { product: p } = await api.post<{ product: Product }>("/admin/products", payload);
        if (pendingFiles.length) {
          try {
            p = await uploadFiles(p.id, pendingFiles);
          } catch (err) {
            alert(`Product saved, but images failed to upload: ${errorMessage(err)}`);
          }
        }
        router.replace(`/admin/products/${p.id}`);
        return;
      }
    } catch (err) {
      setError(err instanceof ApiError && err.details ? "Please fix the highlighted fields." : errorMessage(err));
      if (err instanceof ApiError) setErrors({ name: err.field("name") ?? "", price: err.field("price") ?? "", stock: err.field("stock") ?? "" });
    }
    setSaving(false);
  }

  async function remove() {
    if (!product || !confirm(`Delete "${product.name}"? Past orders keep their details.`)) return;
    setDeleting(true);
    try {
      await api.del(`/admin/products/${product.id}`);
      router.replace("/admin/products");
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-gray-500 hover:text-brand-ink">← Products</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{product ? product.name : "New product"}</h1>
          {product && (
            <a href={`/products/${product.slug}`} target="_blank" className="text-sm text-brand-ink hover:underline">View in shop ↗</a>
          )}
        </div>
      </div>

      <form onSubmit={save} className="card space-y-4 p-5" noValidate>
        {error && <Alert>{error}</Alert>}
        {saved && <Alert kind="success">Saved.</Alert>}
        <Field label="Name" error={errors.name}>
          <input className="input" value={form.name} onChange={set("name")} maxLength={160} />
        </Field>
        <Field label="Description">
          <textarea className="input min-h-28" value={form.description} onChange={set("description")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Price (${shop.currency})`} error={errors.price}>
            <input className="input" inputMode="decimal" value={form.price} onChange={set("price")} placeholder="0.00" />
          </Field>
          <Field label="Stock" error={errors.stock}>
            <input className="input" inputMode="numeric" value={form.stock} onChange={set("stock")} />
          </Field>
          <Field label="Category">
            <select className="input" value={form.categoryId} onChange={set("categoryId")}>
              <option value="">No category</option>
              {cats?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={set("isActive")} className="h-4 w-4 accent-[var(--brand)]" />
          Visible in the shop
        </label>
        {!product && (
          <Field label="Images (optional)" hint="Up to 8 JPG/PNG/WEBP. You can add more after saving.">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setPendingFiles(Array.from(e.target.files ?? []).slice(0, MAX_IMAGES))}
              className="block text-sm"
            />
          </Field>
        )}
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <Button type="submit" loading={saving}>{product ? "Save changes" : "Create product"}</Button>
          {product && <Button type="button" variant="danger" loading={deleting} onClick={remove}>Delete product</Button>}
        </div>
      </form>

      {product && <ImageManager product={product} onChange={setProduct} />}
    </div>
  );
}
