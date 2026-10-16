import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { cop } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await getSession();
  if (!s) redirect("/login");
  const u = await prisma.user.findUniqueOrThrow({ where: { id: s.userId } });
  return (
    <div className="max-w-md space-y-3">
      <h1 className="text-2xl font-semibold">Mi perfil</h1>
      <dl className="space-y-2 rounded-lg border border-stone-200 bg-white p-4 text-sm">
        <div><dt className="text-stone-500">Nombre</dt><dd>{u.name}</dd></div>
        <div><dt className="text-stone-500">Correo</dt><dd>{u.email}</dd></div>
        <div>
          <dt className="text-stone-500">Celular</dt>
          <dd>
            {u.phone ?? "Sin registrar"} {u.phoneVerifiedAt ? "· verificado" : ""}
            {!u.phoneVerifiedAt && <> · <Link className="underline" href="/verificar-celular">Verificar ahora</Link></>}
          </dd>
        </div>
      </dl>
      <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
        <p className="text-stone-500">Saldo disponible</p>
        <p className="mt-1 text-lg font-semibold">{cop.format(u.walletBalanceCop)}</p>
        <Link className="mt-2 inline-block underline" href="/saldo">Consultar historial y recargar saldo</Link>
      </div>
      <Link className="underline" href="/mis-compras">Ver mis compras</Link>
    </div>
  );
}
