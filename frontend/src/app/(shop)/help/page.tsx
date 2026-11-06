"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { useShop } from "@/components/shop/ShopProvider";
import { Alert, Badge, Button, Field } from "@/components/ui";
import { api, ApiError, errorMessage, qs } from "@/lib/api";
import { formatDate, whatsappLink } from "@/lib/format";
import type { Message } from "@/lib/types";

function SendMessage({ onSent }: { onSent: (m: Message) => void }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", orderNumber: "", body: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { message } = await api.post<{ message: Message }>("/messages", form);
      onSent(message);
      setForm({ name: "", phone: "", email: "", orderNumber: "", body: "" });
    } catch (err) {
      setError(err instanceof ApiError && err.details ? "Please check the highlighted fields." : errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h2 className="font-semibold">Send us a message</h2>
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input className="input" value={form.name} onChange={set("name")} required /></Field>
        <Field label="Phone"><input className="input" type="tel" value={form.phone} onChange={set("phone")} required /></Field>
        <Field label="Email (optional)"><input className="input" type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Order number (optional)"><input className="input uppercase" value={form.orderNumber} onChange={set("orderNumber")} /></Field>
      </div>
      <Field label="Message">
        <textarea className="input min-h-28" value={form.body} onChange={set("body")} required maxLength={5000} />
      </Field>
      <Button type="submit" loading={loading}>Send message</Button>
    </form>
  );
}

function Lookup({ initial }: { initial?: { reference: string; phone: string } }) {
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [message, setMessage] = useState<Message | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.get<{ message: Message }>(`/messages/lookup${qs({ reference: reference.trim(), phone: phone.trim() })}`);
      setMessage(res.message);
    } catch (err) {
      setMessage(null);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-semibold">Check for a reply</h2>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Message reference"><input className="input uppercase" value={reference} onChange={(e) => setReference(e.target.value)} required /></Field>
        <Field label="Phone"><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
        <Button type="submit" variant="secondary" loading={loading}>Check</Button>
      </form>
      {error && <Alert>{error}</Alert>}
      {message && (
        <div className="space-y-3 rounded-lg bg-paper p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-3">{formatDate(message.createdAt)}</span>
            <Badge color={message.status === "REPLIED" ? "green" : "yellow"}>{message.status === "REPLIED" ? "Replied" : "Waiting for reply"}</Badge>
          </div>
          <p className="whitespace-pre-line">{message.body}</p>
          {message.replies.map((r) => (
            <div key={r.id} className="rounded-lg border-l-4 border-brand bg-surface p-3">
              <p className="text-xs font-medium text-ink-3">Reply · {formatDate(r.createdAt)}</p>
              <p className="mt-1 whitespace-pre-line">{r.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const { shop } = useShop();
  const [sent, setSent] = useState<Message | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-10 sm:pt-14">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Help center</h1>
        <p className="mt-1 text-sm text-ink-2">Questions about an order or a product? We&apos;re here to help.</p>
      </div>

      {(shop.contactPhone || shop.whatsapp || shop.contactEmail) && (
        <div className="flex flex-wrap gap-3 text-sm">
          {shop.contactPhone && (
            <a href={`tel:${shop.contactPhone}`} className="card flex items-center gap-2 px-4 py-3 transition-colors hover:border-line-strong">
              <Phone size={16} strokeWidth={1.5} className="text-ink-3" aria-hidden /> {shop.contactPhone}
            </a>
          )}
          {shop.whatsapp && (
            <a href={whatsappLink(shop.whatsapp)} target="_blank" rel="noopener" className="card flex items-center gap-2 px-4 py-3 transition-colors hover:border-line-strong">
              <MessageCircle size={16} strokeWidth={1.5} className="text-ink-3" aria-hidden /> WhatsApp
            </a>
          )}
          {shop.contactEmail && (
            <a href={`mailto:${shop.contactEmail}`} className="card flex items-center gap-2 px-4 py-3 transition-colors hover:border-line-strong">
              <Mail size={16} strokeWidth={1.5} className="text-ink-3" aria-hidden /> {shop.contactEmail}
            </a>
          )}
        </div>
      )}

      {sent ? (
        <Alert kind="success">
          <p className="font-medium">Message sent</p>
          <p className="mt-1">
            Your reference is <strong className="font-mono text-base">{sent.reference}</strong>. Save it — you&apos;ll need it with
            your phone number to see our reply below.
          </p>
          <button onClick={() => setSent(null)} className="mt-2 underline">Send another message</button>
        </Alert>
      ) : (
        <SendMessage onSent={setSent} />
      )}

      <Lookup key={sent?.reference} initial={sent ? { reference: sent.reference, phone: sent.phone } : undefined} />
    </div>
  );
}
