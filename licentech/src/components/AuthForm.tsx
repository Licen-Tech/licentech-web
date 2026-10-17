"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { normPhone } from "@/lib/phone";

const field = "w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700";

export default function AuthForm({ mode }: { mode: "login" | "registro" }) {
  const [v, setV] = useState({ name: "", email: "", password: "", phone: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const phone = v.phone ? normPhone(v.phone) : undefined;
    const body = mode === "login"
      ? { email: v.email, password: v.password }
      : { name: v.name, email: v.email, password: v.password, ...(phone ? { phone } : {}) };
    try {
      const r = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => null);
      if (r.ok) {
        window.location.href = mode === "login" && d?.redirectTo === "/admin"
          ? "/admin"
          : mode === "registro" && phone
            ? "/verificar-celular"
            : "/";
        return;
      }

      if (typeof d?.error === "string" && d.error !== "Datos inválidos") {
        setErr(d.error);
      } else if (d?.error?.fieldErrors) {
        const errors = d.error.fieldErrors;
        const messages: Record<string, string> = {
          password: "La contraseña debe tener al menos 10 caracteres.",
          phone: "Ingresa un teléfono internacional con código de país, por ejemplo +573001234567.",
          email: "Ingresa un correo válido.",
          name: "El nombre debe tener al menos 2 caracteres.",
        };
        const fieldWithError = Object.keys(messages).find((field) => errors[field]?.length);
        setErr(fieldWithError ? messages[fieldWithError] : "Revisa los datos ingresados.");
      } else {
        setErr(mode === "login"
          ? d?.error === "Datos inválidos"
            ? "Escribe un correo válido y tu contraseña para ingresar."
            : "No fue posible iniciar sesión. Inténtalo de nuevo."
          : "No se pudo crear la cuenta. Revisa los datos ingresados.");
      }
    } catch {
      setErr("No fue posible conectar con el servidor. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-3 rounded-lg border border-stone-200 bg-white p-5">
      <h1 className="text-xl font-semibold">{mode === "login" ? "Ingresar" : "Crear cuenta"}</h1>
      {mode === "registro" && (
        <input className={field} placeholder="Nombre completo" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
      )}
      <input className={field} type="email" placeholder="Correo" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required />
      <div className="flex">
        <input className={`${field} rounded-r-none`} type={showPassword ? "text" : "password"} placeholder={mode === "registro" ? "Contraseña (mínimo 10 caracteres)" : "Contraseña"} value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} required />
        <button
          type="button"
          className="rounded-r border border-l-0 border-stone-300 px-3 text-sm text-stone-700 hover:bg-stone-50"
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={showPassword}
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {mode === "registro" && (
        <input className={field} type="tel" autoComplete="tel" inputMode="tel" placeholder="Teléfono internacional (opcional), ej. +573001234567" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      )}
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      <button disabled={busy} className="w-full rounded bg-teal-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? "Un momento…" : mode === "login" ? "Ingresar" : "Crear cuenta"}
      </button>
    </form>
  );
}
