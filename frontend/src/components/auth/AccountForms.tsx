"use client";

import { useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

/** Profile + change-password forms (shared by shop admin and platform admin). */
export function AccountForms({ user, onUser }: { user: SessionUser; onUser: (u: SessionUser) => void }) {
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [msg, setMsg] = useState<{ form: "profile" | "password"; kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<"profile" | "password" | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy("profile");
    setMsg(null);
    try {
      const { user: u } = await api.put<{ user: SessionUser }>("/auth/profile", { name });
      onUser(u);
      setMsg({ form: "profile", kind: "success", text: "Profile updated." });
    } catch (err) {
      setMsg({ form: "profile", kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return setMsg({ form: "password", kind: "error", text: "New passwords do not match." });
    if (pw.newPassword.length < 8) return setMsg({ form: "password", kind: "error", text: "Use at least 8 characters." });
    setBusy("password");
    setMsg(null);
    try {
      await api.put("/auth/password", { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      setMsg({ form: "password", kind: "success", text: "Password changed. Other devices have been signed out." });
    } catch (err) {
      setMsg({ form: "password", kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <form onSubmit={saveProfile} className="card space-y-4 p-5">
        <h2 className="font-semibold">Profile</h2>
        {msg?.form === "profile" && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Email" hint="Contact the platform admin to change your email."><input className="input" value={user.email} disabled /></Field>
        <Button type="submit" loading={busy === "profile"}>Save profile</Button>
      </form>
      <form onSubmit={changePassword} className="card space-y-4 p-5">
        <h2 className="font-semibold">Change password</h2>
        {msg?.form === "password" && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password"><input className="input" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required /></Field>
          <Field label="Confirm new password"><input className="input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></Field>
        </div>
        <Button type="submit" loading={busy === "password"}>Change password</Button>
      </form>
    </div>
  );
}
