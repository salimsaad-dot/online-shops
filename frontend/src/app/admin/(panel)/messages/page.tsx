"use client";

import { useState } from "react";
import { PageHeader } from "@/components/admin/AdminShell";
import { Alert, Badge, Button, EmptyState, Spinner } from "@/components/ui";
import { api, errorMessage, qs } from "@/lib/api";
import { formatDate, whatsappLink } from "@/lib/format";
import type { Message, Paginated } from "@/lib/types";
import { useData } from "@/lib/use-data";

const STATUS_BADGE = { NEW: ["yellow", "New"], READ: ["gray", "Read"], REPLIED: ["green", "Replied"] } as const;

export default function MessagesPage() {
  const [filter, setFilter] = useState("");
  const { data, setData, error, loading } = useData<Paginated<Message> & { unread: number }>(`/admin/messages${qs({ status: filter })}`);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const active = data?.items.find((m) => m.id === activeId) ?? null;
  const replace = (m: Message) =>
    setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === m.id ? m : x)), unread: d.unread - (active?.status === "NEW" && m.status !== "NEW" ? 1 : 0) } : d));

  async function open(m: Message) {
    setActiveId(m.id);
    setReply("");
    setActionError("");
    if (m.status === "NEW") {
      try {
        replace((await api.patch<{ message: Message }>(`/admin/messages/${m.id}/read`)).message);
      } catch {}
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !reply.trim()) return;
    setBusy(true);
    setActionError("");
    try {
      replace((await api.post<{ message: Message }>(`/admin/messages/${active.id}/reply`, { body: reply.trim() })).message);
      setReply("");
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!active || !confirm("Delete this message?")) return;
    try {
      await api.del(`/admin/messages/${active.id}`);
      setData((d) => (d ? { ...d, items: d.items.filter((x) => x.id !== active.id), total: d.total - 1 } : d));
      setActiveId(null);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Messages">
        <select className="input w-auto" value={filter} onChange={(e) => { setFilter(e.target.value); setActiveId(null); }}>
          <option value="">All messages</option>
          <option value="NEW">New</option>
          <option value="READ">Read</option>
          <option value="REPLIED">Replied</option>
        </select>
      </PageHeader>
      {error && <Alert>{error.message}</Alert>}
      {loading && !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Spinner className="h-6 w-6" /></div>
      ) : data && data.items.length === 0 ? (
        <EmptyState title="No messages">Customer messages from your help center appear here.</EmptyState>
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ul className={`card divide-y divide-gray-100 ${active ? "hidden lg:block" : ""}`}>
            {data.items.map((m) => (
              <li key={m.id}>
                <button onClick={() => open(m)} className={`block w-full px-4 py-3 text-left text-sm hover:bg-gray-50 ${m.id === activeId ? "bg-gray-50" : ""}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className={m.status === "NEW" ? "font-semibold" : "font-medium"}>{m.name}</span>
                    <Badge color={STATUS_BADGE[m.status][0]}>{STATUS_BADGE[m.status][1]}</Badge>
                  </span>
                  <span className="mt-0.5 line-clamp-1 text-gray-600">{m.body}</span>
                  <span className="text-xs text-gray-400">{formatDate(m.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>

          {active ? (
            <section className="card space-y-4 p-5">
              <button onClick={() => setActiveId(null)} className="text-sm text-gray-500 lg:hidden">← All messages</button>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm">
                  <p className="text-base font-semibold">{active.name}</p>
                  <p><a href={`tel:${active.phone}`} className="text-brand-ink hover:underline">{active.phone}</a>{active.email && <> · <a href={`mailto:${active.email}`} className="text-brand-ink hover:underline">{active.email}</a></>}</p>
                  {active.orderNumber && <p className="text-gray-600">Order: {active.orderNumber}</p>}
                  <p className="text-xs text-gray-400">Ref {active.reference} · {formatDate(active.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <a href={whatsappLink(active.phone, `Hello ${active.name}, `)} target="_blank" rel="noopener" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-green-700 hover:bg-gray-50">WhatsApp</a>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={remove}>Delete</Button>
                </div>
              </div>
              <p className="whitespace-pre-line rounded-lg bg-gray-50 p-3 text-sm">{active.body}</p>
              {active.replies.map((r) => (
                <div key={r.id} className="ml-6 rounded-lg border-l-4 border-brand bg-white p-3 text-sm shadow-xs">
                  <p className="text-xs text-gray-500">Your reply · {formatDate(r.createdAt)}</p>
                  <p className="mt-1 whitespace-pre-line">{r.body}</p>
                </div>
              ))}
              {actionError && <Alert>{actionError}</Alert>}
              <form onSubmit={sendReply} className="space-y-2">
                <textarea className="input min-h-24" placeholder="Write a reply… (the customer sees it in the help center with their reference)" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={5000} />
                <Button type="submit" loading={busy} disabled={!reply.trim()}>Send reply</Button>
              </form>
            </section>
          ) : (
            <div className="hidden items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 lg:flex">Select a message</div>
          )}
        </div>
      ) : null}
    </>
  );
}
