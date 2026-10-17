import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { siteSettingsSchema } from "@/lib/validation";

const defaults = {
  id: "main",
  siteName: "LicenTech Colombia",
  heroTitle: "Herramientas de software para desbloqueo y mantenimiento",
  heroDescription: "Catálogo digital de software y servicios técnicos para dispositivos móviles.",
  heroNotice: "Compra con seguridad: verificamos los pagos antes de procesar la entrega.",
  supportEmail: "brianxxp082@gmail.com",
  whatsappNumber: "",
  telegramUsername: "",
  logoMediaId: null,
};

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return NextResponse.json(await prisma.siteSettings.upsert({
    where: { id: "main" },
    create: defaults,
    update: {},
  }));
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = siteSettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.logoMediaId && !await prisma.mediaAsset.findUnique({
    where: { id: parsed.data.logoMediaId },
    select: { id: true },
  })) {
    return NextResponse.json({ error: "El logo seleccionado ya no está disponible." }, { status: 400 });
  }
  return NextResponse.json(await prisma.siteSettings.upsert({
    where: { id: "main" },
    create: { ...defaults, ...parsed.data },
    update: parsed.data,
  }));
}
