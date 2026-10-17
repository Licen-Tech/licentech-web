"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";

type Action = "email" | "phone" | "password" | "delete";
type SetupData = { secret: string; uri: string };

const field = "w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700";
const button = "rounded bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";

function responseError(result: unknown) {
  return result && typeof result === "object" && "error" in result && typeof result.error === "string"
    ? result.error
    : "No se pudo completar la solicitud.";
}

export default function AccountSettings({
  email,
  phone,
  phoneVerified,
  authenticatorEnabled,
  isAdmin,
}: {
  email: string;
  phone: string | null;
  phoneVerified: boolean;
  authenticatorEnabled: boolean;
  isAdmin: boolean;
}) {
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [enabled, setEnabled] = useState(authenticatorEnabled);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [action, setAction] = useState<Action>("email");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");

  async function beginSetup() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/totp/setup", { method: "POST" });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(responseError(result));
        return;
      }
      if (!result || typeof result !== "object" || !("secret" in result) || typeof result.secret !== "string"
        || !("uri" in result) || typeof result.uri !== "string") {
        throw new Error("El servidor devolvió una configuración inválida.");
      }
      setSetup({ secret: result.secret, uri: result.uri });
    } catch (error) {
      console.error("No se pudo iniciar la configuración de la app autenticadora", error);
      setMessage("No pudimos conectar para configurar la app autenticadora.");
    } finally {
      setBusy(false);
    }
  }

  async function enableAuthenticator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/totp/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(responseError(result));
        return;
      }
      if (!result || typeof result !== "object" || !("recoveryCodes" in result) || !Array.isArray(result.recoveryCodes)
        || !result.recoveryCodes.every((item) => typeof item === "string")) {
        throw new Error("No se pudieron recuperar los códigos de respaldo.");
      }
      setRecoveryCodes(result.recoveryCodes);
      setEnabled(true);
      setSetup(null);
      setCode("");
    } catch (error) {
      console.error("No se pudo activar la app autenticadora", error);
      setMessage("No pudimos conectar para activar la app.");
    } finally {
      setBusy(false);
    }
  }

  async function submitChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const code = String(form.get("code") ?? "");
    let body: Record<string, string>;
    if (action === "email") {
      const newEmail = String(form.get("newEmail") ?? "").trim().toLowerCase();
      const confirmEmail = String(form.get("confirmEmail") ?? "").trim().toLowerCase();
      if (newEmail !== confirmEmail) {
        setMessage("Los correos no coinciden.");
        return;
      }
      body = { action, newEmail, code };
    } else if (action === "phone") {
      body = { action, newPhone: String(form.get("newPhone") ?? "").trim(), code };
    } else if (action === "password") {
      const newPassword = String(form.get("newPassword") ?? "");
      if (newPassword !== String(form.get("confirmPassword") ?? "")) {
        setMessage("Las contraseñas no coinciden.");
        return;
      }
      body = { action, newPassword, code };
    } else {
      if (form.get("confirmDeletion") !== "ELIMINAR") {
        setMessage("Escribe ELIMINAR para confirmar la baja.");
        return;
      }
      body = { action, code };
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(responseError(result));
        return;
      }
      if (result && typeof result === "object" && "deleted" in result && result.deleted === true) {
        window.location.assign("/");
        return;
      }
      const confirmation = result && typeof result === "object" && "message" in result && typeof result.message === "string"
        ? result.message
        : "Los datos de tu cuenta se actualizaron.";
      setMessage(confirmation);
      element.reset();
      setCode("");
      if (action === "email") window.location.reload();
    } catch (error) {
      console.error("No se pudo actualizar la cuenta", error);
      setMessage("No pudimos conectar para actualizar tu cuenta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
      <div>
        <h2 className="text-lg font-semibold">Seguridad y datos de la cuenta</h2>
        <p className="mt-1 text-sm text-stone-600">
          El correo actual es {email}. Para autorizar cambios usamos códigos de una app autenticadora; no se envían mensajes ni se cobra por código.
        </p>
      </div>

      {!enabled ? (
        <div className="space-y-3">
          <p className="text-sm text-amber-900">
            Activa una app autenticadora antes de cambiar el correo, la contraseña o solicitar la eliminación de la cuenta.
          </p>
          {!setup ? (
            <button type="button" disabled={busy} className={button} onClick={() => void beginSetup()}>
              {busy ? "Preparando…" : "Configurar app autenticadora"}
            </button>
          ) : recoveryCodes.length > 0 ? (
            <div className="space-y-3 rounded border border-amber-300 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-950">Guarda tus códigos de recuperación</h3>
              <p className="text-sm text-amber-900">
                Cada código sirve una sola vez si pierdes acceso a la app autenticadora. Esta lista solo se muestra ahora; guárdala en un lugar privado.
              </p>
              <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
                {recoveryCodes.map((recoveryCode) => <li key={recoveryCode} className="rounded bg-white p-2">{recoveryCode}</li>)}
              </ul>
              <button type="button" className={button} onClick={() => setRecoveryCodes([])}>Ya guardé mis códigos</button>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={(event) => void enableAuthenticator(event)}>
              <ol className="list-inside list-decimal space-y-1 text-sm text-stone-700">
                <li>Abre Google Authenticator, Microsoft Authenticator o una app TOTP compatible.</li>
                <li>Agrega una cuenta manualmente y escribe la clave secreta de abajo.</li>
                <li>Usa el código temporal que aparece en la app para confirmar.</li>
              </ol>
              <div>
                <p className="text-xs text-stone-500">Cuenta: LicenTech Colombia · {email}</p>
                <p className="select-all break-all rounded bg-stone-100 p-3 font-mono text-sm">{setup.secret}</p>
                <p className="mt-1 text-xs text-stone-500">Guarda esta clave en privado. La app genera un código nuevo cada 30 segundos.</p>
              </div>
              <label className="block space-y-1 text-sm">
                <span>Código de 6 dígitos de la app</span>
                <input className={field} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required />
              </label>
              <button disabled={busy} className={button}>{busy ? "Verificando…" : "Activar autenticación"}</button>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-green-800">App autenticadora activada. Usa un código nuevo de 6 dígitos para cada operación.</p>
          {isAdmin ? (
            <p className="text-sm text-stone-600">Para proteger el acceso administrativo, esta cuenta no puede eliminarse desde el perfil.</p>
          ) : (
            <>
              <label className="block space-y-1 text-sm">
                <span>Qué deseas actualizar</span>
                <select className={field} value={action} onChange={(event) => { setAction(event.target.value as Action); setMessage(""); }}>
                  <option value="email">Correo electrónico</option>
                  <option value="phone">Teléfono</option>
                  <option value="password">Contraseña</option>
                  <option value="delete">Eliminar cuenta</option>
                </select>
              </label>
              <form className="space-y-3" onSubmit={(event) => void submitChange(event)}>
                {action === "email" && (
                  <>
                    <label className="block space-y-1 text-sm"><span>Correo nuevo</span><input className={field} type="email" name="newEmail" autoComplete="email" maxLength={120} required /></label>
                    <label className="block space-y-1 text-sm"><span>Confirma el correo nuevo</span><input className={field} type="email" name="confirmEmail" autoComplete="email" maxLength={120} required /></label>
                    <p className="text-xs text-stone-500">La app autenticadora autoriza el cambio. Verifica cuidadosamente que escribas bien el correo nuevo.</p>
                  </>
                )}
                {action === "phone" && (
                  <>
                    <label className="block space-y-1 text-sm">
                      <span>Nuevo teléfono internacional</span>
                      <input className={field} type="tel" name="newPhone" autoComplete="tel" inputMode="tel" placeholder="+573001234567" pattern="\+[1-9][0-9]{7,14}" required />
                    </label>
                    <p className="text-xs text-stone-500">
                      Tu teléfono actual: {phone ?? "sin registrar"}{phoneVerified ? " · verificado" : " · no verificado"}.
                      Sin SMS, el nuevo número quedará sin verificar.
                    </p>
                  </>
                )}
                {action === "password" && (
                  <>
                    <label className="block space-y-1 text-sm"><span>Nueva contraseña (mínimo 10 caracteres)</span><input className={field} type="password" name="newPassword" autoComplete="new-password" minLength={10} maxLength={72} required /></label>
                    <label className="block space-y-1 text-sm"><span>Confirma la nueva contraseña</span><input className={field} type="password" name="confirmPassword" autoComplete="new-password" minLength={10} maxLength={72} required /></label>
                  </>
                )}
                {action === "delete" && (
                  <div className="space-y-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    <p>La baja es permanente. Se eliminarán el perfil y las publicaciones del foro. Los pedidos y movimientos contables se conservarán sin asociarlos a tu cuenta y se anonimizarán los datos personales.</p>
                    <label className="block space-y-1"><span>Escribe ELIMINAR para confirmar</span><input className={field} name="confirmDeletion" autoComplete="off" required /></label>
                  </div>
                )}
                <label className="block space-y-1 text-sm">
                  <span>Código de la app autenticadora o código de recuperación</span>
                  <input className={field} inputMode="text" autoComplete="one-time-code" name="code" pattern="([0-9]{6}|[A-Fa-f0-9]{16})" maxLength={16} required />
                </label>
                {action === "delete" && (
                  <p className="text-xs text-stone-600">
                    ¿Quieres conservar tu cuenta? <Link className="underline" href="/perfil">Vuelve al perfil sin enviar este formulario.</Link>
                  </p>
                )}
                <button disabled={busy} className={action === "delete" ? "rounded bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" : button}>
                  {busy ? "Verificando…" : action === "delete" ? "Eliminar cuenta definitivamente" : "Verificar y guardar"}
                </button>
              </form>
            </>
          )}
        </div>
      )}
      {message && <p role="status" className="text-sm text-teal-800">{message}</p>}
    </section>
  );
}
