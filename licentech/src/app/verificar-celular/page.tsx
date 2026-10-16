"use client";
import { useState } from "react";
import { normPhone } from "@/lib/phone";

const field = "w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700";
const btn = "w-full rounded bg-teal-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

export default function Page() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code" | "done">("phone");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: unknown) {
    setBusy(true);
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setMsg(typeof d.error === "string" ? d.error : "Revisa los datos");
    else setMsg("");
    return r.ok;
  }

  return (
    <div className="mx-auto max-w-sm space-y-3 rounded-lg border border-stone-200 bg-white p-5">
      <h1 className="text-xl font-semibold">Verificar celular</h1>
      {step === "phone" && (
        <>
          <input className={field} inputMode="tel" placeholder="Celular, ej. 3001234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className={btn} disabled={busy} onClick={async () => (await post("/api/auth/phone/send", { phone: normPhone(phone) })) && setStep("code")}>
            Enviar código por SMS
          </button>
        </>
      )}
      {step === "code" && (
        <>
          <p className="text-sm text-stone-600">Escribe el código de 6 dígitos que te llegó por SMS.</p>
          <input className={field} inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className={btn} disabled={busy} onClick={async () => (await post("/api/auth/phone/verify", { phone: normPhone(phone), code })) && setStep("done")}>
            Verificar
          </button>
        </>
      )}
      {step === "done" && <p className="text-teal-800">¡Celular verificado!</p>}
      {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
    </div>
  );
}
