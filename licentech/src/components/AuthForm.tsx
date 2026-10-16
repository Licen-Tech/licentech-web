"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { normPhone } from "@/lib/phone";

const field = "w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700";

export default function AuthForm({ mode }: { mode: "login" | "registro" }) {
  const [v, setV] = useState({ name: "", email: "", password: "", phone: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const phone = v.phone ? normPhone(v.phone) : undefined;
    const body = mode === "login"
      ? { email: v.email, password: v.password }
      : { name: v.name, email: v.email, password: v.password, ...(phone ? { phone } : {}) };
    const r = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      window.location.href = mode === "registro" && phone ? "/verificar-celular" : "/";
      return;
    }
    setErr(typeof d.error === "string" ? d.error : "Revisa los datos: contraseña de 10 o más caracteres y celular colombiano.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-3 rounded-lg border border-stone-200 bg-white p-5">
      <h1 className="text-xl font-semibold">{mode === "login" ? "Ingresar" : "Crear cuenta"}</h1>
      {mode === "registro" && (
        <input className={field} placeholder="Nombre completo" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
      )}
      <input className={field} type="email" placeholder="Correo" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required />
      <input className={field} type="password" placeholder={mode === "registro" ? "Contraseña (mínimo 10 caracteres)" : "Contraseña"} value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} required />
      {mode === "registro" && (
        <input className={field} inputMode="tel" placeholder="Celular (opcional), ej. 3001234567" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      )}
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      <button disabled={busy} className="w-full rounded bg-teal-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? "Un momento…" : mode === "login" ? "Ingresar" : "Crear cuenta"}
      </button>
    </form>
  );
}
