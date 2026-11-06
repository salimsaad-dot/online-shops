"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/admin/AdminShell";
import { Alert, Button, EmptyState, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { Category } from "@/lib/types";
import { useData } from "@/lib/use-data";

export default function CategoriesPage() {
  const { data, error, loading, reload } = useData<{ categories: Category[] }>("/admin/categories");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError("");
    try {
      await fn();
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const cats = data?.categories ?? [];
  const move = (index: number, dir: -1 | 1) =>
    run(async () => {
      const order = [...cats];
      [order[index], order[index + dir]] = [order[index + dir], order[index]];
      await Promise.all(order.map((c, position) => api.put(`/admin/categories/${c.id}`, { position })));
    });

  return (
    <>
      <PageHeader title="Categories" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void run(async () => { await api.post("/admin/categories", { name: name.trim(), position: cats.length }); setName(""); });
        }}
        className="mb-4 flex max-w-md gap-2"
      >
        <input className="input" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Button type="submit" disabled={busy || !name.trim()}>Add</Button>
      </form>
      {(error || actionError) && <div className="mb-4"><Alert>{error?.message ?? actionError}</Alert></div>}
      {loading && !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Spinner className="h-6 w-6" /></div>
      ) : cats.length === 0 ? (
        <EmptyState title="No categories yet">Categories help customers browse your products.</EmptyState>
      ) : (
        <ul className="card max-w-2xl divide-y divide-gray-100">
          {cats.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="flex flex-col">
                <button disabled={busy || i === 0} onClick={() => move(i, -1)} className="text-gray-400 hover:text-gray-900 disabled:opacity-20" aria-label="Move up">▲</button>
                <button disabled={busy || i === cats.length - 1} onClick={() => move(i, 1)} className="text-gray-400 hover:text-gray-900 disabled:opacity-20" aria-label="Move down">▼</button>
              </div>
              {editing?.id === c.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => { await api.put(`/admin/categories/${c.id}`, { name: editing.name.trim() }); setEditing(null); });
                  }}
                >
                  <input className="input" value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} autoFocus />
                  <Button type="submit" size="sm" disabled={busy}>Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </form>
              ) : (
                <>
                  <span className="flex-1">
                    <span className="font-medium">{c.name}</span>
                    <Link href={`/admin/products?categoryId=${c.id}`} className="ml-2 text-xs text-gray-500 hover:text-brand-ink">{c.productCount} products</Link>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ id: c.id, name: c.name })}>Rename</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    disabled={busy}
                    onClick={() => confirm(`Delete "${c.name}"? Its products stay, without a category.`) && run(() => api.del(`/admin/categories/${c.id}`))}
                  >
                    Delete
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
