import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { encrypt, hmac } from "@/lib/crypto";
import { licenseBatchSchema } from "@/lib/validation";

// Carga un lote de claves (una por línea en el panel). Se cifran en reposo y se descartan duplicados.
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = licenseBatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { productId, keys } = parsed.data;
  const unique = [...new Set(keys)];
  const r = await prisma.license.createMany({
    data: unique.map((k) => ({ productId, keyEnc: encrypt(k), keyHash: hmac(k) })),
    skipDuplicates: true,
  });
  return NextResponse.json({ added: r.count, duplicates: unique.length - r.count });
}
